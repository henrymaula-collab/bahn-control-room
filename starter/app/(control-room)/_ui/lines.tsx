import Link from "next/link"
import { needsPersonNow, onDay, reasonWords, sourceLine, strengthWords, when } from "@/lib/control-room/format"
import type { Case, Fact } from "@/lib/control-room/types"
import type { CaseCard } from "@/lib/control-room/views"
import { Icon } from "./icons"

/** "Decide by 13:00", red only within the hour or when it is past. */
export function dueFor(c: Case, now: string): { text: string; now: boolean } | undefined {
  if (!c.decideBy) return undefined
  const past = Date.parse(c.decideBy) <= Date.parse(now)
  return { text: `${past ? "Was due at" : "Decide by"} ${when(c.decideBy, now, undefined, true)}`, now: needsPersonNow(c, now) }
}

/** A fact: the statement, then who said it, how, when, and how strong. */
export function FactLine({ fact, now }: { fact: Fact; now: string }) {
  return (
    <div className="fact">
      <p className="m">{fact.statement}</p>
      <p className="s">
        {sourceLine(fact, now)}. {strengthWords(fact.strength)}.
      </p>
    </div>
  )
}

/** The chevron that says there is more behind a row. */
export function Chev({ size = 18 }: { size?: number }) {
  return (
    <span className="chev">
      <Icon name="chevron-right" size={size} />
    </span>
  )
}

/** A disclosure row: a title that says what is inside, one grey line that sums it up. */
export function Row({ title, sub, open, children, id }: { title: React.ReactNode; sub?: React.ReactNode; open?: boolean; children: React.ReactNode; id?: string }) {
  return (
    <details className="row" open={open} id={id}>
      <summary>
        <span>
          <span className="m title" style={{ display: "block" }}>
            {title}
          </span>
          {sub && (
            <span className="s" style={{ display: "block", marginTop: 2 }}>
              {sub}
            </span>
          )}
        </span>
        <Chev />
      </summary>
      <div className="body">{children}</div>
    </details>
  )
}

/** A case in a list: the headline, and when it is due or what the agent is doing. */
export function CaseItem({ card, now, sub }: { card: CaseCard; now: string; sub?: string }) {
  const due = dueFor(card.case, now)
  return (
    <li>
      <Link href={`/cases/${card.case.id}`} className="item">
        <p className="m">{card.case.headline}</p>
        {sub ? <p className="s">{sub}</p> : due ? <p className={`s${due.now ? " now" : ""}`}>{due.text}</p> : null}
      </Link>
    </li>
  )
}

/** "Papers are missing and it needs the customer." Bahn's gate words, as one sentence. */
export function reasonSentence(c: Case): string {
  if (c.reasons.length === 0) return ""
  return `The agent stopped here because ${joinIt(c.reasons.map(reasonWords))}.`
}

export function joinIt(items: string[]): string {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** "today", "yesterday", "on 14 Oct". */
export function dayPhrase(iso: string, now: string): string {
  const d = onDay(iso, now)
  return d === "today" || d === "yesterday" ? d : `on ${d}`
}
