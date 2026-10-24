"use client"

// needs 07: a small dock floats at the bottom of the card column and stays while cases change
// (it lives in Your tasks' frame, not in the case): previous, where you are, next. Its middle opens
// "Up next" upward, the order of the rest, the way a player's mini bar opens its queue. After a
// decision it turns dark and says what was done and what opens next (an undo-style toast, docked).

import "./dock.css"
import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLab } from "../../context"
import { Icon } from "../../../_ui/icons"
import type { DoneProps } from "../../../_ui/question"
import { Keep } from "../../../_ui/text"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"

type Said = { caseId: string; vehicle?: string; label: string }
let said: Said | null = null
const subs = new Set<() => void>()
const setSaid = (s: Said | null) => ((said = s), subs.forEach((f) => f()))
const useSaid = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => said, () => null)

/** Part `Around`: the card column, and the dock floating over its bottom edge. */
export function DockAround({ children }: { children: React.ReactNode }) {
  const { rows, index, current, prev, next, times, href } = useNeedsYou()
  const { open } = usePanel()
  const lab = useLab()
  const s = useSaid()
  const [up, setUp] = useState(lab.others)
  const box = useRef<HTMLDivElement>(null)
  const decided = !!s && s.caseId === current

  // A new case closes Up next; outside clicks and Escape close it too.
  useEffect(() => setUp(lab.others), [current, lab.others])
  useEffect(() => {
    if (!up) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setUp(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setUp(false))
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [up])

  const where = index >= 0 ? `${index + 1} of ${rows.length}` : `${rows.length} left`
  const after = index >= 0 ? rows.slice(index + 1) : rows
  const listed = after.slice(0, 7)
  const tNext = next ? times[next.caseId] : undefined
  const show = !!current && rows.length > 0 && (rows.length > 1 || index < 0)

  return (
    <div className={`lab-needs-07${open && current ? " beside" : ""}`}>
      {children}
      {show && (
        <div className="lab-needs-07-bay">
          <div ref={box} className={`lab-needs-07-dock${decided ? " told" : ""}${up ? " up" : ""}`}>
            {up && !decided && (
              <div className="lab-needs-07-queue" role="menu" aria-label="Up next">
                <p className="s lab-needs-07-label">Up next</p>
                {listed.map((r) => {
                  const t = times[r.caseId]
                  return (
                    <Link key={r.caseId} href={href(r.caseId)} role="menuitem" className="lab-needs-07-row" onClick={() => setUp(false)}>
                      <span className="lab-needs-07-car">{r.vehicle}</span>
                      <span className="lab-needs-07-place">{r.place}</span>
                      {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                    </Link>
                  )
                })}
                {after.length > listed.length && <p className="s lab-needs-07-more">{after.length - listed.length} more after these</p>}
                {!after.length && <p className="s lab-needs-07-more">This is the last one.</p>}
              </div>
            )}
            {decided ? (
              <div className="lab-needs-07-bar" role="status" key="said">
                <Icon name="check" size={18} />
                <span className="lab-needs-07-said">{s.vehicle ? `${s.vehicle} ${s.label}` : s.label.replace(/^d/, "D")}</span>
                {next ? (
                  <Link href={href(next.caseId)} className="lab-needs-07-open" aria-keyshortcuts="J">
                    {next.vehicle} next
                    <Icon name="chevron-right" size={18} />
                  </Link>
                ) : (
                  <Link href="/" className="lab-needs-07-open">
                    Nothing else
                    <Icon name="chevron-right" size={18} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="lab-needs-07-bar" key="walk">
                {prev ? (
                  <Link href={href(prev.caseId)} className="lab-needs-07-step" aria-label={`Previous: ${prev.vehicle}`} aria-keyshortcuts="K" title="Previous (K)">
                    <Icon name="chevron-left" size={18} />
                  </Link>
                ) : (
                  <span className="lab-needs-07-step off" aria-hidden="true">
                    <Icon name="chevron-left" size={18} />
                  </span>
                )}
                <button type="button" className="lab-needs-07-where" aria-haspopup="menu" aria-expanded={up} onClick={() => setUp((u) => !u)}>
                  <span className="num">{where}</span>
                  <Icon name={up ? "chevron-down" : "chevron-up"} size={16} />
                </button>
                {next ? (
                  <Link href={href(next.caseId)} className="lab-needs-07-next" aria-keyshortcuts="J" title="Next (J)">
                    <span className="lab-needs-07-car" key={next.caseId}>
                      {next.vehicle}
                    </span>
                    {tNext && <time className={tNext.now ? "now" : undefined}>{tNext.text}</time>}
                    <Icon name="chevron-right" size={18} />
                  </Link>
                ) : (
                  <span className="lab-needs-07-next off">Last one</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Part `Done`: who decided and what happens now; the way on is in the dock below. */
export function DockDone({ headline, option, suggestion, done, leadName }: DoneProps) {
  const { current, rows } = useNeedsYou()
  const [vehicle] = useState(() => rows.find((r) => r.caseId === current)?.vehicle)
  useEffect(() => {
    setSaid({ caseId: current, vehicle, label: option.id === suggestion.id ? "decided" : "decided another way" })
    return () => setSaid(null)
  }, [current, vehicle, option.id, suggestion.id])
  return (
    <section className="question lab-needs-07-done" aria-live="polite">
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
    </section>
  )
}

/** Part `Row`: the dock's Up next replaces the Other tasks row under the card. */
export function DockNoRow() {
  return null
}
