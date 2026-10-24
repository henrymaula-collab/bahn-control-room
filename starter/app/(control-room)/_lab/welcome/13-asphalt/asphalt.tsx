"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useBoth, useFit, useKeep, when } from "../shared"
import "./asphalt.css"

/** Today's panel in Bahn's asphalt: the driver app's dark surface and birch pill, over the light map. */
export function Asphalt({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length

  return (
    <section ref={ref} className="lab-welcome lab-welcome-13 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      <Link href={keep(tasks[0] ? `/tasks/${tasks[0].caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
        <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
        <Icon name="chevron-right" size={20} />
      </Link>

      {tasks.length > 0 && (
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
      )}

      <Key counts={counts} />
    </section>
  )
}
