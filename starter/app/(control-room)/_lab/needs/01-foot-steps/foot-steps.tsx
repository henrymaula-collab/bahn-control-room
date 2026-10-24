"use client"

// needs 01: Previous and Next pinned at the foot of the card column (an expense review drawer,
// Stripe Radar's detailed view). The queue is walked from inside the case; the side menu keeps
// only "Your tasks N". After a decision, Next becomes the one black button.

import "./foot-steps.css"
import Link from "next/link"
import { useEffect, useSyncExternalStore } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { Icon } from "../../../_ui/icons"
import type { DoneProps } from "../../../_ui/question"
import { Keep } from "../../../_ui/text"
import { useNeedsYou } from "../../../_ui/work-frame"

// The foot hides while the card shows its decided state (Next is then the black button above it).
let decided: string | null = null
const subs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), subs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => decided, () => null)

const idOf = (href?: string) => (href ? decodeURIComponent(href.split("?")[0].split("/")[2] ?? "") : "")

function Side({ row, dir, time }: { row?: WorkRow; dir: "prev" | "next"; time?: { text: string; now: boolean } }) {
  const { href } = useNeedsYou()
  if (!row) return <span className={`lab-needs-01-side ${dir} lab-needs-01-none`} aria-hidden="true" />
  const word = dir === "next" ? "Next" : "Previous"
  return (
    <Link
      href={href(row.caseId)}
      className={`lab-needs-01-side ${dir}`}
      aria-label={`${word}: ${row.vehicle}${time ? `, decide by ${time.text}` : ""}`}
      aria-keyshortcuts={dir === "next" ? "J" : "K"}
      title={`${word} (${dir === "next" ? "J" : "K"})`}
    >
      {dir === "prev" && <Icon name="chevron-left" size={18} />}
      <span className="lab-needs-01-car">{row.vehicle}</span>
      {time && <time className={time.now ? "now" : undefined}>{time.text}</time>}
      {dir === "next" && <Icon name="chevron-right" size={18} />}
    </Link>
  )
}

/** Part `Row`: the foot of the card column. */
export function FootSteps() {
  const { rows, index, prev, next, times, current } = useNeedsYou()
  const done = useDecided()
  if (done && done === current) return null
  if (rows.length < 2 && index >= 0) return null
  if (!rows.length) return null
  const where = index >= 0 ? `${index + 1} of ${rows.length}` : `${rows.length} left`
  return (
    <nav className="lab-needs-01" aria-label="Your tasks">
      <Side row={prev} dir="prev" time={prev ? times[prev.caseId] : undefined} />
      <span className="lab-needs-01-at" aria-live="polite">
        {where}
      </span>
      <Side row={next} dir="next" time={next ? times[next.caseId] : undefined} />
    </nav>
  )
}

/** Part `Done`: who decided, what happens now, and the next case as the single black button. */
export function FootStepsDone({ headline, option, suggestion, done, leadName, nextHref }: DoneProps) {
  const { rows, times, current } = useNeedsYou()
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  const nextId = idOf(nextHref)
  const nextRow = rows.find((r) => r.caseId === nextId)
  const t = nextRow ? times[nextRow.caseId] : undefined
  return (
    <section className="question lab-needs-01-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      <p className="m quiet context">
        {option.effect}
        {done.why && option.id !== suggestion.id ? ` The reason goes to ${leadName} before the agent learns from it.` : ""}
      </p>
      <div className="answers">
        {nextHref ? (
          <Link href={nextHref} className="btn btn-primary" aria-keyshortcuts="J">
            {nextRow ? `Next: ${nextRow.vehicle}` : "Next case"}
            <Icon name="chevron-right" size={18} />
          </Link>
        ) : (
          <Link href="/" className="btn btn-secondary">
            Open the overview
          </Link>
        )}
      </div>
      {nextHref && t && (
        <p className="s next">
          Decide by {t.text}
          {nextRow?.place ? `, ${nextRow.place}` : ""}
        </p>
      )}
      {!nextHref && <p className="s next">Nothing else needs you right now.</p>}
    </section>
  )
}
