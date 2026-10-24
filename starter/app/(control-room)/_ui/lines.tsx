import Link from "next/link"
import { clock, needsPersonNow, range, sourceLine, strengthWords, when } from "@/lib/control-room/format"
import type { AgentStep, Fact } from "@/lib/control-room/types"
import type { CaseCard } from "@/lib/control-room/views"

/** A fact: the statement, then who said it, how, when, and how strong, in words. */
export function FactLine({ fact, now }: { fact: Fact; now: string }) {
  return (
    <div className="fact">
      <p className="statement">{fact.statement}</p>
      <p className="meta">
        {sourceLine(fact, now)}. {strengthWords(fact.strength)}.
      </p>
    </div>
  )
}

/** What the agent did, in its own past tense, with the time. */
export function StepLine({ step }: { step: AgentStep }) {
  return (
    <li className="step">
      <time dateTime={step.at}>{clock(step.at)}</time>
      <span>{step.summary}</span>
    </li>
  )
}

/** "Decide by 13:00", red-700 only when a person is needed now. */
export function DecideBy({ card, now }: { card: CaseCard; now: string }) {
  const c = card.case
  if (!c.decideBy) return null
  const urgent = needsPersonNow(c, now)
  const past = Date.parse(c.decideBy) <= Date.parse(now)
  return (
    <span className={`decide-by${urgent ? " now" : ""}`}>
      {past ? "Was due at " : "Decide by "}
      <time dateTime={c.decideBy}>{when(c.decideBy, now)}</time>
    </span>
  )
}

/** The order in one line: the car, where it waits, and the time that decides the next step. */
export function orderLine(card: CaseCard, now: string): string {
  const o = card.order
  const w = o.pickup.window
  const pickup = w ? ` Pickup ${range(w.start, w.end, now).replace(/^Today/, "today").replace(/^Tomorrow/, "tomorrow")}.` : ""
  return `${o.vehicle} at ${o.pickup.placeName}.${pickup}`
}

/** A calm queue row. The 3 px red bar only when it needs a person now. */
export function QueueRow({ card, now }: { card: CaseCard; now: string }) {
  const urgent = needsPersonNow(card.case, now)
  return (
    <li>
      <Link href={`/cases/${card.case.id}`} className={`queue-row${urgent ? " now" : ""}`}>
        <span className="headline">{card.case.headline}</span>
        <span className={`due num${urgent ? " now" : ""}`}>
          {card.case.decideBy
            ? `${Date.parse(card.case.decideBy) <= Date.parse(now) ? "Was due at" : "Decide by"} ${when(card.case.decideBy, now)}`
            : ""}
        </span>
        <span className="sub">{orderLine(card, now)}</span>
      </Link>
    </li>
  )
}
