import type { Metadata } from "next"
import { dataSource, getLead } from "@/lib/control-room/client"
import { coverageRows } from "@/lib/control-room/coverage"
import { clock, count, euro, onDay } from "@/lib/control-room/format"
import type { LeadView } from "@/lib/control-room/views"
import { Frame } from "../_ui/frame"
import { LessonRow, RuleRow, SuggestedRule } from "../_ui/learning"
import { currentPersonId } from "../_ui/session"
import { LeadSkeleton } from "../_ui/states"

export const metadata: Metadata = { title: "Shift lead" }

type Search = Promise<{ [k: string]: string | string[] | undefined }>

const dayPhrase = (iso: string, now: string) => {
  const d = onDay(iso, now)
  return d === "today" || d === "yesterday" ? d : `on ${d}`
}

export default async function LeadPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams
  const fixtureState = dataSource() === "fixtures" ? String(sp.state ?? "") : ""
  if (fixtureState === "error") throw new Error("Fixture error state")
  const view = await getLead(await currentPersonId())
  const now = view.asOf

  if (fixtureState === "loading") {
    return (
      <Frame title="Shift lead" person={view.person} people={view.people} active="lead">
        <LeadSkeleton />
      </Frame>
    )
  }

  const name = (id?: string) => view.people.find((p) => p.id === id)?.name
  const featured = view.trustRules.find((r) => r.status === "suggested") ?? null
  const otherRules = view.trustRules.filter((r) => r.id !== featured?.id)
  const proposed = view.lessons.filter((l) => l.status === "proposed")
  const accepted = view.lessons.filter((l) => l.status === "accepted")
  const coverage = coverageRows(view.caseTypes, view.trackRecords, view.people)
  const t = view.today

  return (
    <Frame title="Shift lead" person={view.person} people={view.people} asOf={now} active="lead">
      <div className="lead">
        <section aria-label="Today">
          <p className="t-lead lead-today">
            The agents checked {count(t.ordersChecked)} orders since {clock(t.since)}. {count(t.casesToPeople)} cases needed a person, and{" "}
            {t.waiting === 0 ? "none are waiting now." : `${count(t.waiting)} ${t.waiting === 1 ? "is" : "are"} still waiting.`}
          </p>
          <div className="stats">
            <Stat label="Decided by people" value={count(t.decided)} />
            <Stat label="Handled by the agent alone" value={count(t.handledByAgent)} />
            <Stat label="Waiting for a person" value={count(t.waiting)} />
            <Stat label="Time to decide, median" value={t.medianMinutesToDecide === null ? "Not enough yet" : String(t.medianMinutesToDecide)} unit={t.medianMinutesToDecide === null ? undefined : "min"} />
          </div>
        </section>

        {featured && (
          <section className="section" aria-label="Suggested trust rule">
            <SuggestedRule
              key={`${featured.id}-${featured.status}`}
              rule={featured}
              evidence={(view.evidence[featured.id] ?? []).map((e) => ({ ...e, dayWords: onDay(e.at, now) }))}
              changedByName={name(featured.changedBy)}
              changedAtWords={featured.changedAt ? clock(featured.changedAt) : undefined}
            />
          </section>
        )}

        <section className="section" aria-labelledby="lessons">
          <div className="section-head">
            <h2 className="t-heading" id="lessons">
              Lessons waiting for your review
            </h2>
          </div>
          {proposed.length === 0 ? (
            <p className="t-body">Nothing to review. New lessons appear here when someone chooses another step than the agent.</p>
          ) : (
            <ul className="rows">
              {proposed.map((l) => (
                <LessonRow key={l.id} id={l.id} text={l.text} sub={lessonSub(l, now)} />
              ))}
            </ul>
          )}
          {accepted.length > 0 && (
            <details className="t-2" style={{ marginTop: 16 }}>
              <summary className="btn-text" style={{ minHeight: 32, fontSize: 13, cursor: "pointer" }}>
                {accepted.length === 1 ? "1 lesson in use" : `${accepted.length} lessons in use`}
              </summary>
              <ul className="rows" style={{ marginTop: 8 }}>
                {accepted.map((l) => (
                  <li className="row" key={l.id}>
                    <p className="row-main" style={{ fontWeight: 400 }}>{l.text}</p>
                    <p className="row-sub">{lessonSub(l, now)}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="section" aria-labelledby="coverage">
          <div className="section-head">
            <h2 className="t-heading" id="coverage">
              Who can handle what
            </h2>
            <p className="t-2">Three decisions of a kind, and we count you in.</p>
          </div>
          <ul className="rows">
            {[...coverage].sort((a, b) => Number(b.onlyOne) - Number(a.onlyOne)).map((row) => (
              <li key={row.label} className={`coverage-row${row.onlyOne ? " risk" : ""}`}>
                <span className="type">{row.label}</span>
                <span className="who">{row.canHandle.length ? row.canHandle.map((p) => p.name).join(", ") : "Nobody yet"}</span>
                {row.onlyOne ? (
                  <p className="note">
                    Only {row.canHandle[0].name} handles {row.phrase}.
                    {row.learning.length > 0 &&
                      ` ${row.learning.map((l) => `${l.person.name} has handled ${l.decided}`).join(", ")}, so the agent sends some of these to ${row.learning.length === 1 ? row.learning[0].person.name : "them"} to learn.`}
                  </p>
                ) : row.learning.length > 0 ? (
                  <p className="note">Learning: {row.learning.map((l) => `${l.person.name}, ${l.decided} so far`).join("; ")}.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {otherRules.length > 0 && (
          <section className="section" aria-labelledby="rules">
            <div className="section-head">
              <h2 className="t-heading" id="rules">
                Trust rules
              </h2>
            </div>
            <ul className="rows">
              {otherRules.map((r) => (
                <RuleRow key={`${r.id}-${r.status}`} rule={r} sub={ruleSub(r, view, now)} />
              ))}
            </ul>
          </section>
        )}

        <section className="money quiet" aria-label="Money" style={{ padding: 0 }}>
          <p className="quiet-line">
            <strong>
              This week the Readiness desk held {view.money.wastedTripsAvoided} drivers before a wasted trip.
            </strong>{" "}
            A wasted cross-border pickup costs about {euro(view.money.costPerWastedTrip)}.
          </p>
          <details className="quiet-more" style={{ display: "block" }}>
            <summary className="btn-text" style={{ minHeight: 28, fontSize: 13, cursor: "pointer" }}>
              How we count
            </summary>
            <p style={{ marginTop: 4 }}>{view.money.basis}</p>
          </details>
        </section>
      </div>
    </Frame>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat">
      <p className="t-2">{label}</p>
      <p className="value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
    </div>
  )
}

function lessonSub(l: LeadView["lessons"][number], now: string): string {
  const s = l.source
  if (!s) return "From a past decision."
  const ref = s.orderReference ? ` on ${s.orderReference}` : ""
  const about = s.placeName ? ` About ${s.placeName}.` : ""
  return `From ${s.personName}'s decision${ref} ${dayPhrase(s.at, now)}.${about}`
}

function ruleSub(r: LeadView["trustRules"][number], view: LeadView, now: string): string {
  const who = view.people.find((p) => p.id === r.changedBy)?.name ?? "the shift lead"
  const since = r.changedAt ? ` ${dayPhrase(r.changedAt, now)}` : ""
  if (r.status === "on") {
    const used = r.usedCount ? ` Used ${r.usedCount === 1 ? "once" : `${r.usedCount} times`}, nobody changed it.` : ""
    return `On since${since ? since.replace(/^ on/, "") : ""}, turned on by ${who}.${used} Built on ${r.evidence.matched} of ${r.evidence.total} matching decisions.`
  }
  if (r.status === "off") return `Off. ${who} turned it off${since}.`
  return `Suggested. The agent would have decided like you in ${r.evidence.matched} of ${r.evidence.total} cases.`
}
