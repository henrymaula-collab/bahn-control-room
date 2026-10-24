"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, liftOn, n, useBoth, useFit, useKeep, when } from "../shared"
import "./fleet-bar.css"

type Part = "plan" | "agent" | "red"

/** The key as Apple's storage bar: every car on the road today in one bar, the three colours in proportion. */
export function FleetBar({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const [hot, setHot] = useState<Part | null>(null)
  const total = counts.onPlan + counts.agentWorking + counts.needsPerson
  const parts: { id: Part; label: string; value: number; dot: string }[] = [
    { id: "plan", label: "On plan", value: counts.onPlan, dot: "dot-green" },
    { id: "agent", label: "Agent working", value: counts.agentWorking, dot: "dot-agent" },
    { id: "red", label: "Needs a person", value: counts.needsPerson, dot: "dot-red" },
  ]
  const mine = tasks.length

  return (
    <section ref={ref} className="lab-welcome lab-welcome-09 lw-panel" aria-label="Today">
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

      <div className={`fleet${hot ? ` hot-${hot}` : ""}`} aria-label="The map's colours">
        <p className="fhead">
          <span>On the road today</span>
          <span className="ftotal">
            {hot === "red" && mine > 0 ? `${n(counts.needsPerson)} need a person, ${n(Math.min(mine, counts.needsPerson))} of them yours` : `${n(total)} cars`}
          </span>
        </p>
        <div className="bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
          {parts.map((p) => (
            <span key={p.id} className={`seg seg-${p.id}`} style={{ flexGrow: p.value }} onMouseEnter={() => setHot(p.id)} onMouseLeave={() => setHot(null)} />
          ))}
        </div>
        <div className="legend">
          {parts.map((p) => (
            <p key={p.id} className="litem" onMouseEnter={() => setHot(p.id)} onMouseLeave={() => setHot(null)}>
              <span className={`dot ${p.dot}`} />
              <span>{p.label}</span>
              <span className="lw-n">{n(p.value)}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
