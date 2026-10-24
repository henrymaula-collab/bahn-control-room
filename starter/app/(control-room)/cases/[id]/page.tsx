import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCase } from "@/lib/control-room/client"
import { clock, day, languageName, localNote, onDay, range, reasonWords, ruleSentence, when } from "@/lib/control-room/format"
import type { Call } from "@/lib/control-room/types"
import type { CaseDetail, Endpoint, OrderSummary } from "@/lib/control-room/views"
import { CallBlock } from "../../_ui/call"
import { DecisionControls } from "../../_ui/decision"
import { Frame } from "../../_ui/frame"
import { Icon } from "../../_ui/icons"
import { DecideBy, FactLine, StepLine } from "../../_ui/lines"
import { currentPersonId } from "../../_ui/session"

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const detail = await getCase(id, await currentPersonId())
  return { title: detail ? `${detail.card.order.reference}, ${detail.card.order.vehicle}` : "Case" }
}

export default async function CasePage({ params }: { params: Params }) {
  const { id } = await params
  const detail = await getCase(id, await currentPersonId())
  if (!detail) notFound()

  const { card, asOf: now } = detail
  const c = card.case
  const o = card.order
  const lead = detail.people.find((p) => p.role === "shift_lead")
  const isMine = c.routedTo?.personId === detail.person.id
  const owner = detail.people.find((p) => p.id === c.routedTo?.personId)

  return (
    <Frame title={o.vehicle} person={detail.person} people={detail.people} asOf={now}>
      <div className="case-layout">
        <article>
          <nav className="case-nav" aria-label="Queue">
            <Link href="/" className="btn-text">
              <Icon name="chevron-left" size={16} />
              Your desk
            </Link>
            {detail.queue && detail.queue.total > 1 && (
              <div className="case-nav-right">
                <span className="num">
                  {detail.queue.index} of {detail.queue.total}
                </span>
                {detail.queue.prevId && (
                  <Link href={`/cases/${detail.queue.prevId}`} className="btn-text">
                    Previous
                  </Link>
                )}
                {detail.queue.nextId && (
                  <Link href={`/cases/${detail.queue.nextId}`} className="btn-text">
                    Next
                  </Link>
                )}
              </div>
            )}
          </nav>

          <header className="case-head">
            {c.status === "waiting_for_person" ? <DecideBy card={card} now={now} /> : <StatusWords detail={detail} />}
            <h2 className="t-title">{c.headline}</h2>
            <p className="t-body case-context">
              {o.vehicle} for {o.customer.name}. <span className="mono">{o.reference}</span>
            </p>
            {c.status === "waiting_for_person" && (
              <p className="t-2 case-why">
                {c.reasons.length > 0 && <>The agent stopped here because {joinWords(c.reasons.map(reasonWords))}. </>}
                {isMine ? c.routedTo?.why : owner ? `This case is ${owner.name}'s.` : null}
              </p>
            )}
          </header>

          <Route order={o} now={now} />

          {c.facts.length > 0 && (
            <section className="section" aria-labelledby="checked">
              <h3 className="t-heading" id="checked">
                What the agent checked
              </h3>
              <div className="fact-list">
                {c.facts.map((f) => (
                  <FactLine key={f.id} fact={f} now={now} />
                ))}
              </div>
            </section>
          )}

          {detail.calls
            .filter((call) => call.outcome === "answered" && call.turns.length > 0)
            .map((call) => (
              <section className="section" key={call.id} aria-label={`The call with ${o.pickup.placeName}`}>
                <h3 className="t-heading">The call with {o.pickup.placeName}</h3>
                <CallBlock call={call} placeName={o.pickup.placeName} meta={callMeta(call, now)} />
              </section>
            ))}

          {c.agentSteps.length > 0 && (
            <section className="section" aria-labelledby="did">
              <h3 className="t-heading" id="did">
                What the agent did
              </h3>
              <ol className="steps">
                {c.agentSteps.map((s, i) => (
                  <StepLine key={i} step={s} />
                ))}
              </ol>
            </section>
          )}

          <EverythingOnThisOrder order={o} now={now} />
        </article>

        <aside className="case-aside" aria-label="Decision">
          <div className="aside-panel">
            {c.status === "waiting_for_person" || detail.decision ? (
              <DecisionControls
                key={c.id}
                variant="case"
                caseId={c.id}
                suggestion={c.suggestion}
                alternatives={c.alternatives}
                drafts={detail.drafts}
                whyChoices={detail.whyChoices}
                lessons={detail.lessonsUsed.map((l) => ({
                  id: l.id,
                  text: l.text,
                  personName: l.source?.personName,
                  dayWords: l.source ? dayPhrase(l.source.at, now) : undefined,
                }))}
                personName={detail.person.name}
                leadName={lead?.name ?? "The shift lead"}
                nextHref={detail.queue?.nextId ? `/cases/${detail.queue.nextId}` : undefined}
                existing={
                  detail.decision
                    ? {
                        optionId: detail.decision.optionId,
                        why: detail.decision.why,
                        timeWords: clock(detail.decision.at),
                        personName: detail.decidedBy?.name ?? "a person",
                      }
                    : undefined
                }
              />
            ) : (
              <AgentOwned detail={detail} />
            )}
          </div>
        </aside>
      </div>
    </Frame>
  )
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

function dayPhrase(iso: string, now: string): string {
  const d = onDay(iso, now)
  return d === "today" || d === "yesterday" ? d : `on ${d}`
}

function callMeta(call: Call, now: string): string {
  const lang = call.language !== "en" ? ` In ${languageName(call.language)}, with a translation under each line.` : ""
  return `The agent called at ${when(call.startedAt, now)}. Answered.${lang}`
}

function StatusWords({ detail }: { detail: CaseDetail }) {
  const c = detail.card.case
  const words: Record<string, string> = {
    agent_working: "The agent is working on this",
    decided: "Decided",
    done: "Done",
    handled_by_agent: "Handled by the agent under a trust rule",
  }
  return <span className="decide-by">{words[c.status] ?? ""}</span>
}

/** When no person is needed: say who has it and under which rule. */
function AgentOwned({ detail }: { detail: CaseDetail }) {
  const { card } = detail
  const rule = card.ruleUsed
  if (card.case.status === "handled_by_agent") {
    return (
      <div className="receipt">
        <p className="t-label">Handled by the agent</p>
        <p className="t-lead">{card.case.suggestion.label}</p>
        <p className="t-body">{card.case.suggestion.effect}</p>
        {rule && (
          <div className="block" style={{ marginTop: 16 }}>
            <p className="t-label">Under the trust rule</p>
            <p className="t-body">{ruleSentence(rule)}</p>
            <p className="t-2" style={{ marginTop: 4 }}>
              Turned on by {detail.people.find((p) => p.id === rule.changedBy)?.name ?? "the shift lead"}
              {rule.changedAt ? ` ${dayPhrase(rule.changedAt, detail.asOf)}` : ""}, after {rule.evidence.matched} of {rule.evidence.total} matching decisions. The shift lead can turn it off at any time.
            </p>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="receipt">
      <p className="t-label">No person needed yet</p>
      <p className="t-lead">The agent is working on this.</p>
      <p className="t-body">If it needs a decision, it comes to the right person&apos;s desk.</p>
    </div>
  )
}

/** Bahn's route mark: orange A, asphalt B, the pickup and delivery under each end. */
function Route({ order, now }: { order: OrderSummary; now: string }) {
  return (
    <div className="route" aria-label="Route">
      <div className="route-line" aria-hidden="true">
        <span className="pin pin-a">A</span>
        <span className="pin pin-b">B</span>
      </div>
      <RouteEnd end={order.pickup} now={now} />
      <RouteEnd end={order.delivery} now={now} />
    </div>
  )
}

function RouteEnd({ end, now }: { end: Endpoint; now: string }) {
  const w = end.window
  return (
    <div className="route-end">
      <p className="place">{end.placeName}</p>
      <p className="detail">{end.placeName.includes(end.city) ? end.address : `${end.address}, ${end.city}`}</p>
      {w && (
        <>
          <p className="when">{w.label}</p>
          <p className="detail">
            <span className="nowrap">{range(w.start, w.end, now)}</span>{" "}
            <span className="nowrap">{localNote(w.start, w.end, end.timezone, end.city)}</span>
          </p>
        </>
      )}
    </div>
  )
}

function EverythingOnThisOrder({ order: o, now }: { order: OrderSummary; now: string }) {
  const rows: [string, React.ReactNode, boolean?][] = [
    ["Car", [o.vehicle, o.vehicleDetail].filter(Boolean).join(", ")],
    ["Order", <span className="mono" key="r">{o.reference}</span>],
    ["Customer", o.customer.name],
    ["Status", o.status],
    ["Plate", o.plate ? <span className="mono" key="p">{o.plate}</span> : "No plate on the order"],
    ["VIN", o.vin ? <span className="mono" key="v">{o.vin}</span> : "Not on the order"],
    ["Pickup place", `${o.pickup.placeName}, ${o.pickup.address}, ${o.pickup.city}`],
    ["Delivery place", `${o.delivery.placeName}, ${o.delivery.address}, ${o.delivery.city}`],
    ["Pickup contact", o.pickup.contact ?? "None on the order"],
    ["Delivery contact", o.delivery.contact ?? "None on the order"],
  ]
  if (o.pickup.hours) rows.push(["Pickup place hours", o.pickup.hours])
  if (o.pickup.instruction) rows.push(["Pickup instructions", o.pickup.instruction, true])
  if (o.gig) rows.push(["Gig", `${o.gig.state}, €${o.gig.feeEur}`])
  if (o.driver) rows.push(["Driver", o.driver.name])
  if (o.distanceKm) rows.push(["Distance", `${o.distanceKm} km, ${o.routeKind.toLowerCase()}`])
  for (const d of o.documents ?? []) rows.push([d.label, d.state])
  return (
    <details className="fold">
      <summary>
        Everything on this order
        <Icon name="chevron-down" size={20} />
      </summary>
      <div className="fold-body">
        <dl className="kv">
          {rows.map(([k, v, wide]) => (
            <div key={k} className={wide ? "wide" : undefined}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="t-2" style={{ marginTop: 24 }}>
          Checked against the order record on {day(now)}.{" "}
          <a className="link" href={`/orders/${o.orderId}`}>
            Open the full record
          </a>
        </p>
      </div>
    </details>
  )
}
