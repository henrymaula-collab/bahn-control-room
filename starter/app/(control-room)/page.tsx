import type { Metadata } from "next"
import { dataSource, getDesk } from "@/lib/control-room/client"
import { clock, count, dayKey, needsPersonNow, ruleSentence } from "@/lib/control-room/format"
import type { CaseCard, DeskView } from "@/lib/control-room/views"
import { DecisionControls } from "./_ui/decision"
import { Frame } from "./_ui/frame"
import { DecideBy, FactLine, QueueRow, orderLine } from "./_ui/lines"
import { QuietLine, type QuietItem } from "./_ui/quiet"
import { currentPersonId } from "./_ui/session"
import { DeskSkeleton } from "./_ui/states"

export const metadata: Metadata = { title: "Your desk" }

type Search = Promise<{ [k: string]: string | string[] | undefined }>

export default async function DeskPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams
  const personId = await currentPersonId()
  // Fixture-only switches for screenshots and calm tests: ?state=loading|error, ?rows=40
  const fixtureState = dataSource() === "fixtures" ? String(sp.state ?? "") : ""
  const extraRows = dataSource() === "fixtures" && sp.rows ? Math.min(400, Number(sp.rows) || 0) : 0
  if (fixtureState === "error") throw new Error("Fixture error state")

  const desk = await getDesk(personId, { extraRows })

  if (fixtureState === "loading") {
    return (
      <Frame title="Your desk" person={desk.person} people={desk.people} active="desk">
        <DeskSkeleton />
      </Frame>
    )
  }

  const now = desk.asOf
  const lead = desk.people.find((p) => p.role === "shift_lead")
  return (
    <Frame title="Your desk" person={desk.person} people={desk.people} asOf={now} active="desk">
      <div className="desk">
        {desk.decision ? (
          <>
            <DeskIntro desk={desk} />
            <DecisionPanel card={desk.decision} now={now} personName={desk.person.name} leadName={lead?.name ?? "The shift lead"} />
            <Queue cards={desk.queue} now={now} />
            <Quiet desk={desk} lead={desk.quiet.notChecked > 0 ? "Nothing else needs you so far." : "Nothing else needs you."} />
          </>
        ) : (
          <>
            <div className="empty">
              <h2 className="t-headline">Nothing needs you right now.</h2>
              <p className="t-body">The agent brings the next decision here when one comes up.</p>
            </div>
            <Quiet desk={desk} lead="" />
          </>
        )}
      </div>
    </Frame>
  )
}

function DeskIntro({ desk }: { desk: DeskView }) {
  const n = 1 + desk.queue.length
  return (
    <div className="desk-intro">
      <p className="t-2">{n === 1 ? "One decision for you." : `${count(n)} decisions for you. This one is due first.`}</p>
    </div>
  )
}

function DecisionPanel({ card, now, personName, leadName }: { card: CaseCard; now: string; personName: string; leadName: string }) {
  const c = card.case
  const facts = c.facts.filter((f) => f.strength !== "stale").slice(0, 2)
  return (
    <section className="panel decision-panel" aria-labelledby="decision-headline">
      <div className="decision-top">
        <p className="t-2">{orderLine(card, now)}</p>
        <DecideBy card={card} now={now} />
      </div>
      <h2 className="t-headline" id="decision-headline">
        {c.headline}
      </h2>
      {c.routedTo && <p className="t-2 routed">{c.routedTo.why}</p>}
      {facts.length > 0 && (
        <div className="decision-facts">
          {facts.map((f) => (
            <FactLine key={f.id} fact={f} now={now} />
          ))}
        </div>
      )}
      <hr className="divider" />
      <DecisionControls
        key={c.id}
        variant="desk"
        caseId={c.id}
        suggestion={c.suggestion}
        alternatives={c.alternatives}
        whyChoices={{}}
        personName={personName}
        leadName={leadName}
        caseHref={`/cases/${c.id}`}
      />
    </section>
  )
}

const FOLD_AFTER = 5

/** The rest of the queue as calm rows, grouped by when they are due once the list gets long. */
function Queue({ cards, now }: { cards: CaseCard[]; now: string }) {
  if (cards.length === 0) return null
  const isToday = (c: CaseCard) => !!c.case.decideBy && dayKey(c.case.decideBy) === dayKey(now)
  const groups: { title: string; cards: CaseCard[] }[] = [
    { title: "Due within the hour", cards: cards.filter((c) => needsPersonNow(c.case, now)) },
    {
      title: "Later today",
      cards: cards.filter((c) => !needsPersonNow(c.case, now) && isToday(c)),
    },
    {
      title: "Tomorrow and later",
      cards: cards.filter((c) => !needsPersonNow(c.case, now) && !isToday(c)),
    },
  ].filter((g) => g.cards.length > 0)
  const grouped = cards.length > 6 && groups.length > 1
  return (
    <section className="queue" aria-label="Next for you">
      {grouped ? (
        groups.map((g, gi) => {
          // Later groups fold after a few rows, so a long queue never becomes a wall.
          const fold = gi > 0 && g.cards.length > FOLD_AFTER
          const shown = fold ? g.cards.slice(0, FOLD_AFTER) : g.cards
          const hidden = fold ? g.cards.slice(FOLD_AFTER) : []
          return (
            <div className="queue-group" key={g.title}>
              <div className="queue-head">
                <h3 className="t-heading">{g.title}</h3>
              </div>
              <ul className="queue-list">
                {shown.map((c) => (
                  <QueueRow key={c.case.id} card={c} now={now} />
                ))}
              </ul>
              {hidden.length > 0 && (
                <details className="queue-more">
                  <summary className="btn-text">
                    {hidden.length} more {g.title.toLowerCase()}
                  </summary>
                  <ul className="queue-list">
                    {hidden.map((c) => (
                      <QueueRow key={c.case.id} card={c} now={now} />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })
      ) : (
        <>
          <div className="queue-head">
            <h3 className="t-heading">Next for you</h3>
          </div>
          <ul className="queue-list">
            {cards.map((c) => (
              <QueueRow key={c.case.id} card={c} now={now} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Quiet({ desk, lead }: { desk: DeskView; lead: string }) {
  const q = desk.quiet
  // An order nobody checked is not fine: say how many, never hide them in the count.
  const rest =
    q.notChecked > 0
      ? `${count(q.ordersChecked)} of ${count(q.ordersChecked + q.notChecked)} orders checked at ${clock(q.checkedAt)}. ${count(q.notChecked)} not checked yet.`
      : `${count(q.ordersChecked)} orders checked at ${clock(q.checkedAt)}.`
  const working = desk.agentWorking.length
  const handled = desk.handledByAgent.length
  const parts: string[] = []
  if (working > 0) parts.push(`working on ${working === 1 ? "1 case" : `${working} cases`}`)
  if (handled > 0) parts.push(`handled ${handled === 1 ? "1" : handled} alone under a trust rule`)
  const more = parts.length ? `The agent is ${parts.join(" and ")}.` : undefined
  const items: QuietItem[] = [
    ...desk.agentWorking.map((c) => ({
      id: c.case.id,
      href: `/cases/${c.case.id}`,
      headline: c.case.headline,
      sub: c.case.agentSteps.at(-1)?.summary ?? "The agent is working on it.",
    })),
    ...desk.handledByAgent.map((c) => ({
      id: c.case.id,
      href: `/cases/${c.case.id}`,
      headline: c.case.headline,
      sub: c.ruleUsed ? `Handled by the agent under the rule: ${ruleSentence(c.ruleUsed)}` : "Handled by the agent under a trust rule.",
    })),
  ]
  return <QuietLine lead={lead} rest={rest} more={more} items={items} />
}
