"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { dayOf, isNow, liftOn, n, plural, useBoth, useFit, useKeep, when, word } from "../shared"
import "./strip.css"

/** One line across the top of the map, like a Live Activity; her rows open under it on demand. */
export function Strip({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const [open, setOpen] = useState(false)
  const drop = useRef<HTMLElement | null>(null)
  const dropRef = useBoth(undefined, drop)
  const fit = useFit(drop, Math.min(tasks.length, 8), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const first = tasks[0]
  const allToday = tasks.length > 0 && tasks.every((r) => r.decideBy && dayOf(r.decideBy, now) === 0)
  const last = tasks.reduce<string | undefined>((m, r) => (r.decideBy && (!m || r.decideBy > m) ? r.decideBy : m), undefined)
  const line = !tasks.length
    ? `${firstName}, nothing needs you right now.`
    : `${firstName}, ${word(tasks.length, true)} ${plural(tasks.length, "car needs", "cars need")} you`
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {/* The map keeps its cars beside a zero-width box: the strip floats over the map's top edge. */}
      <span ref={panelRef as React.Ref<HTMLSpanElement>} className="lab-welcome lab-welcome-11-room" aria-hidden="true" />
      <section className="lab-welcome lab-welcome-11 lw-panel" aria-label="Today">
        <h1 className="lw-display">
          {line}
          {tasks.length > 0 && allToday && last && <span className="by"> by {when(last, now)}</span>}
          {tasks.length > 0 && "."}
          {!tasks.length && <span className="calm"> The agent is on {n(counts.agentWorking)}.</span>}
        </h1>
        {first && (
          <>
            <Link href={keep(`/tasks/${first.caseId}`)} className="lw-pill go">
              <span>Start with the {first.vehicle}</span>
              <Icon name="chevron-right" size={18} />
            </Link>
            <button type="button" className="more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span>{tasks.length === 1 ? "Show it" : `All ${word(tasks.length, true)}`}</span>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
            </button>
          </>
        )}
      </section>

      {open && tasks.length > 0 && (
        <section ref={dropRef} className="lab-welcome lab-welcome-11-drop lw-panel" aria-label="Your tasks">
          <ul className="lw-rows">
            {shown.map((r) => (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="lw-v">{r.vehicle}</span>
                  <span className="lw-p">{r.place}</span>
                  {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
                </Link>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <Link href={keep("/tasks")} className="lw-row lw-more">
                  <span>{n(rest)} more in Your tasks</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="lab-welcome lab-welcome-11-legend" aria-label="The map's colours">
        <p><span className="dot dot-green" />On plan <span className="c">{n(counts.onPlan)}</span></p>
        <p><span className="dot dot-agent" />Agent working <span className="c">{n(counts.agentWorking)}</span></p>
        <p><span className="dot dot-red" />Needs a person <span className="c">{n(counts.needsPerson)}</span></p>
      </div>
    </>
  )
}
