"use client"

import Link from "next/link"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useKeep, when } from "../shared"
import "./sheet.css"

/** A full-height sheet at the map's left edge: greeting and pill on top, the list scrolls, the key at the foot. */
export function Sheet({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  return (
    <section ref={panelRef} className="lab-welcome lab-welcome-05 lw-panel" aria-label="Today">
      <header className="head">
        <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>
        <Link href={keep(tasks[0] ? `/tasks/${tasks[0].caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
          <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
          <Icon name="chevron-right" size={20} />
        </Link>
      </header>

      <div className="scroll" tabIndex={-1}>
        {tasks.length > 0 ? (
          <ul className="lw-rows">
            {tasks.map((r) => (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="lw-v">{r.vehicle}</span>
                  <span className="lw-p">{r.place}</span>
                  {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="calm">The agent is on {n(counts.agentWorking)} cars. When one needs you, it comes here first.</p>
        )}
      </div>

      <footer className="foot">
        <Key counts={counts} />
      </footer>
    </section>
  )
}
