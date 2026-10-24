"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useBoth, useCaseBrief, useFit, useKeep, when } from "../shared"
import "./first-open.css"

/** The most urgent task is open in the panel (what happened, one way on); the rest stay closed rows. */
export function FirstOpen({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const [first, ...others] = tasks
  const brief = useCaseBrief(first?.caseId)
  const fit = useFit(box, Math.min(others.length, 5), 0)
  const shown = others.slice(0, fit)
  const rest = others.length - shown.length

  return (
    <section ref={ref} className="lab-welcome lab-welcome-02 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      {!first && <p className="calm">Nothing needs you right now. The agent is on {n(counts.agentWorking)} cars.</p>}

      {first && (
        <div className={`open${lift === first.orderId ? " lift" : ""}`} {...liftOn(first.orderId, setLift)}>
          {first.decideBy && <p className={`due${isNow(first, now) ? " now" : ""}`}>First, decide by {when(first.decideBy, now)}</p>}
          <p className="car">
            {first.vehicle} <span>at {first.place}</span>
          </p>
          <p className={`what${brief ? " in" : ""}${first.caseId.startsWith("case-") ? "" : " none"}`}>{brief?.headline ?? " "}</p>
          <Link href={keep(`/tasks/${first.caseId}`)} className="lw-pill go">
            <span>Open the {first.vehicle}</span>
            <Icon name="chevron-right" size={20} />
          </Link>
        </div>
      )}

      {others.length > 0 && (
        <>
          <p className="then">Then</p>
          <ul className="closed">
            {shown.map((r) => (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`line${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <Link href={keep("/tasks")} className="line more">
                  <span className="v">{n(rest)} more in Your tasks</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            )}
          </ul>
        </>
      )}

      <Key counts={counts} />
    </section>
  )
}
