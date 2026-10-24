"use client"

// needs 02: decide, and the next case opens by itself (Superhuman "Achieve Inbox Zero", Zendesk Play
// mode with "Stay on ticket"). A short count gives the person a beat to read what was done; hovering
// or focusing the block pauses it. Under the card only what comes after this one, the rest one tap away.

import "./next-opens.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLab } from "../../context"
import { Icon } from "../../../_ui/icons"
import type { DoneProps } from "../../../_ui/question"
import { Keep } from "../../../_ui/text"
import { useNeedsYou } from "../../../_ui/work-frame"

const SECONDS = 5

// The row under the card steps aside while this case shows its decided state (the count says what is next).
let decided: string | null = null
const subs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), subs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => decided, () => null)
const idOf = (href?: string) => (href ? decodeURIComponent(href.split("?")[0].split("/")[2] ?? "") : "")

/** Part `Done`: what was decided, then the next case opens on its own unless you stay. */
export function NextOpensDone({ headline, option, suggestion, done, leadName, nextHref }: DoneProps) {
  const { rows, times, current } = useNeedsYou()
  const lab = useLab()
  const router = useRouter()
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  const nextRow = rows.find((r) => r.caseId === idOf(nextHref))
  const t = nextRow ? times[nextRow.caseId] : undefined
  const [left, setLeft] = useState(SECONDS * 10) // tenths of a second
  const [held, setHeld] = useState(false) // pointer over or focus inside: the count waits
  const [stay, setStay] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!nextHref || stay || held) return
    if (left <= 0) {
      // The lab's ?decided=1 saved nothing, so it stays put; a real decision moves on.
      if (!lab.decided) router.push(nextHref)
      return
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 100)
    return () => clearTimeout(id)
  }, [left, held, stay, nextHref, lab.decided, router])

  const secs = Math.max(0, Math.ceil(left / 10))
  return (
    <section className="question lab-needs-02-done" aria-live="polite">
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

      {nextHref ? (
        <div
          ref={box}
          className={`lab-needs-02-next${stay ? " stayed" : ""}${held ? " held" : ""}`}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && setHeld(false)}
        >
          <div className="lab-needs-02-line" aria-hidden="true">
            <span style={{ transform: `scaleX(${stay ? 0 : 1 - left / (SECONDS * 10)})` }} />
          </div>
          <p className="m lab-needs-02-says">
            {stay ? (
              <>You stay on this case.</>
            ) : (
              <>
                {nextRow ? nextRow.vehicle : "The next case"} opens in <span className="num">{secs}</span> s
              </>
            )}
          </p>
          {t && (
            <p className="s lab-needs-02-when">
              Decide by {t.text}
              {nextRow?.place ? `, ${nextRow.place}` : ""}
            </p>
          )}
          <div className="answers">
            <Link href={nextHref} className="btn btn-primary" aria-keyshortcuts="J">
              {stay ? `Open ${nextRow?.vehicle ?? "the next case"}` : "Open now"}
            </Link>
            {!stay && (
              <button type="button" className="btn btn-plain" onClick={() => setStay(true)}>
                Stay on this case
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="lab-needs-02-next lab-needs-02-last">
          <p className="m lab-needs-02-says">That was the last one. Nothing else needs you right now.</p>
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

/** Part `Row`: under the card, what comes after this one; the order of the rest one tap away. */
export function NextOpensRow() {
  const { rows, index, next, times, href, current } = useNeedsYou()
  const lab = useLab()
  const done = useDecided()
  if (!next || done === current) return null
  const after = index >= 0 ? rows.slice(index + 1) : rows
  const before = index >= 0 ? rows.slice(0, index) : []
  // The summary names the next one; the list goes on from the one after it.
  const shown = after.slice(1, 7)
  const more = after.length - 1 - shown.length
  const t = times[next.caseId]
  const lastT = after.length ? times[after[after.length - 1].caseId] : undefined
  return (
    <details className="row lab-needs-02" open={lab.others || undefined}>
      <summary>
        <span className="lab-needs-02-head">
          <span className="m title">After this, {next.vehicle}</span>
          <span className="s lab-needs-02-sub">
            {t ? `Decide by ${t.text}` : next.place}
            {after.length > 1 ? `, then ${after.length - 1} more` : ""}
          </span>
        </span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </summary>
      <div className="body">
        {shown.length > 0 && <p className="s lab-needs-02-label">Then</p>}
        <ol className="lab-needs-02-order">
          {shown.map((r) => {
            const rt = times[r.caseId]
            return (
              <li key={r.caseId}>
                <Link href={href(r.caseId)} className="lab-needs-02-item">
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {rt && <time className={rt.now ? "now" : undefined}>{rt.text}</time>}
                </Link>
              </li>
            )
          })}
        </ol>
        {more > 0 && (
          <p className="s lab-needs-02-more">
            {more} more after these{lastT ? `, the last by ${lastT.text}` : ""}.
          </p>
        )}
        {before.length > 0 && (
          <p className="s lab-needs-02-more">
            {before.length === 1 ? `${before[0].vehicle} comes before this one.` : `${before.length} come before this one.`}
          </p>
        )}
      </div>
    </details>
  )
}
