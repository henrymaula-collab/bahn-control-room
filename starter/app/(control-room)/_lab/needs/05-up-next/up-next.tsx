"use client"

// needs 05: the next case peeks under this one, its own headline readable, like the next card in a
// stack. You read what is coming before you get there; after a decision the decided case shrinks to
// one receipt line and the next case's situation and question take the card's place.

import "./up-next.css"
import Link from "next/link"
import { useEffect, useState, useSyncExternalStore } from "react"
import type { Option } from "@/lib/control-room/types"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab } from "../../context"
import { questionFor } from "../../../_ui/ask"
import { Icon } from "../../../_ui/icons"
import type { DoneProps } from "../../../_ui/question"
import { Keep } from "../../../_ui/text"
import { useNeedsYou } from "../../../_ui/work-frame"

type Peek = { headline: string; question?: string }
const cache = new Map<string, Peek | null>()

/** The next case's headline and question from GET /api/cr/cases/:id (none for the lab's padding rows). */
function usePeek(row?: WorkRow): Peek | null {
  const id = row?.caseId ?? ""
  const real = !!id && id.startsWith("case-")
  const [peek, setPeek] = useState<Peek | null>(real ? (cache.get(id) ?? null) : null)
  useEffect(() => {
    if (!real) return setPeek(null)
    if (cache.has(id)) return setPeek(cache.get(id) ?? null)
    let on = true
    fetch(`/api/cr/cases/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { case?: { headline: string; suggestion?: Option } } | null) => {
        const p = d?.case ? { headline: d.case.headline, question: d.case.suggestion ? questionFor(d.case.suggestion) : undefined } : null
        cache.set(id, p)
        if (on) setPeek(p)
      })
      .catch(() => on && setPeek(null))
    return () => {
      on = false
    }
  }, [id, real])
  return peek
}

// The peek steps aside while this case shows its decided state (the next case is then the card).
let decided: string | null = null
const subs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), subs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => decided, () => null)

const idOf = (href?: string) => (href ? decodeURIComponent(href.split("?")[0].split("/")[2] ?? "") : "")

/** Part `Row`: the next case, peeking from the bottom edge of the card column. */
export function UpNext() {
  const { rows, index, next, times, href, current } = useNeedsYou()
  const lab = useLab()
  const done = useDecided()
  const peek = usePeek(next)
  if (!next || done === current) return null
  const t = times[next.caseId]
  const after = (index >= 0 ? rows.length - index - 1 : rows.length) - 1
  return (
    <div className={`lab-needs-05${lab.others ? " lifted" : ""}${after > 0 ? " stack" : ""}${after > 4 ? " deep" : ""}`}>
      <Link href={href(next.caseId)} className="lab-needs-05-card" aria-keyshortcuts="J" aria-label={`Next: ${next.vehicle}${t ? `, decide by ${t.text}` : ""}`}>
        <span className="lab-needs-05-top">
          <span className="lab-needs-05-label">Next, {next.vehicle}</span>
          {t && <time className={t.now ? "now" : undefined}>Decide by {t.text}</time>}
        </span>
        <span className="lab-needs-05-head">{peek ? <Keep text={peek.headline} /> : `${next.vehicle} at ${next.place}. The order opens with what is known.`}</span>
        {peek?.question && <span className="lab-needs-05-ask">{peek.question}</span>}
        <span className="lab-needs-05-more">
          {after > 0 ? `${after} more after it` : "The last one after this"}
          <Icon name="chevron-right" size={16} />
        </span>
      </Link>
    </div>
  )
}

/** Part `Done`: the decided case becomes one receipt line; the next case takes the card's place. */
export function UpNextDone({ option, done, nextHref }: DoneProps) {
  const { rows, times, current } = useNeedsYou()
  // Kept from the first paint: after a real decision the refreshed queue no longer has this case.
  const [vehicle] = useState(() => rows.find((r) => r.caseId === current)?.vehicle)
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  const nextRow = rows.find((r) => r.caseId === idOf(nextHref))
  const peek = usePeek(nextRow)
  const t = nextRow ? times[nextRow.caseId] : undefined
  return (
    <section className="question lab-needs-05-done" aria-live="polite">
      <div className="lab-needs-05-receipt">
        <span className="lab-needs-05-tick" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <p className="s">
          <span className="lab-needs-05-strong">
            {vehicle ? `${vehicle} decided` : "Decided"} by {done.personName} at {done.timeWords}
          </span>
          <span className="lab-needs-05-was">{option.label}.</span>
        </p>
      </div>
      {nextHref && nextRow ? (
        <div className="lab-needs-05-risen">
          {t && <p className={`m due${t.now ? " now" : ""}`}>Next, decide by {t.text}</p>}
          <h1 className="l what">{peek ? <Keep text={peek.headline} /> : `${nextRow.vehicle} at ${nextRow.place}`}</h1>
          {peek?.question && <p className="l ask">{peek.question}</p>}
          <div className="answers">
            <Link href={nextHref} className="btn btn-primary" aria-keyshortcuts="J">
              Open {nextRow.vehicle}
            </Link>
          </div>
        </div>
      ) : (
        <div className="lab-needs-05-risen">
          <h1 className="l what">Nothing else needs you right now.</h1>
          <div className="answers">
            <Link href="/" className="btn btn-secondary">
              Open the overview
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
