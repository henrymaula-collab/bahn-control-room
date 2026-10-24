"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useAgentFeed, useBoth, useFit, useKeep, useMotionOk, when } from "../shared"
import "./agent-on.css"

/** Her tasks, and under them what the agent is doing right now, one real case at a time. */
export function AgentOn({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const feed = useAgentFeed(6)
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const motion = useMotionOk()
  useEffect(() => {
    if (feed.length < 2 || hold || !motion) return
    // The first case stays a while (it is the one on screen when the page is looked at), then one every 5 s.
    let id = 0
    const first = window.setTimeout(() => {
      setI((x) => (x + 1) % feed.length)
      id = window.setInterval(() => setI((x) => (x + 1) % feed.length), 5200)
    }, 9000)
    return () => (window.clearTimeout(first), window.clearInterval(id))
  }, [feed.length, hold, motion])
  const item = feed.length ? feed[i % feed.length] : null

  return (
    <section ref={ref} className="lab-welcome lab-welcome-08 lw-panel" aria-label="Today">
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

      {/* What the agent is doing right now (Tembo's "Tasks that Tembo is currently working on"): its own
          line above the key, led by the agent's breathing dot, never inside the key. */}
      <div className="aline" aria-live="off" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
        {item && (
          <Link key={item.caseId} href={keep(`/tasks/${item.caseId}`)} className="aitem" {...liftOn(item.orderId, setLift)}>
            <span className="dot dot-agent" />
            <span className="acar">
              {item.vehicle} <span>at {item.place}</span>
            </span>
            <span className="ahead">{item.headline}</span>
          </Link>
        )}
      </div>

      <Key counts={counts} className="lw08-key" />
    </section>
  )
}
