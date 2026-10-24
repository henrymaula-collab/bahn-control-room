"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, liftOn, n, plural, useBoth, useFit, useKeep, when, word } from "../shared"
import "./maps-card.css"

/** A narrow card over the map, as Apple Maps floats its own; the key moves onto the map as its legend. */
export function MapsCard({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 7))
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length

  return (
    <>
      <section ref={ref} className="lab-welcome lab-welcome-04 lw-panel" aria-label="Today">
        <h1 className="lw-display">Welcome back, {firstName}.</h1>
        <p className="lw04-sub">
          {tasks.length ? `${word(tasks.length)} ${plural(tasks.length, "car needs", "cars need")} you.` : "Nothing needs you right now."}
        </p>

        {tasks.length > 0 && (
          <ul className="lw04-list">
            {shown.map((r) => (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`item${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className={`mark${isNow(r, now) ? " now" : ""}`} aria-hidden="true" />
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {r.decideBy && <time className={isNow(r, now) ? "now" : undefined}>{when(r.decideBy, now)}</time>}
                </Link>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <Link href={keep("/tasks")} className="item more">
                  <span className="v">{n(rest)} more</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            )}
          </ul>
        )}

        {tasks[0] && (
          <Link href={keep(`/tasks/${tasks[0].caseId}`)} className="lw-pill go">
            <span>Start with the {tasks[0].vehicle}</span>
            <Icon name="chevron-right" size={18} />
          </Link>
        )}
      </section>

      {/* The key belongs to the map: a legend in its corner, like a map's own. */}
      <div className="lab-welcome lab-welcome-04-legend" aria-label="The map's colours">
        <p><span className="dot dot-green" />On plan <span className="c">{n(counts.onPlan)}</span></p>
        <p><span className="dot dot-agent" />Agent working <span className="c">{n(counts.agentWorking)}</span></p>
        <p><span className="dot dot-red" />Needs a person <span className="c">{n(counts.needsPerson)}</span></p>
      </div>
    </>
  )
}
