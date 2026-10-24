"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, Tether, useBoth, useFit, useKeep, when } from "../shared"
import "./tether.css"

/** Each row is tied to its car: a hairline from the panel's edge to the pin; the most urgent is tied by default. */
export function TetherPanel({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const rows = useRef(new Map<string, HTMLElement>())
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const first = tasks[0]
  const tied = lift && rows.current.has(lift) ? lift : first?.orderId ?? null

  return (
    <>
      <Tether target={() => ({ row: tied ? rows.current.get(tied) ?? null : null, edge: box.current, orderId: tied, strong: !!lift })} />
      <section ref={ref} className="lab-welcome lab-welcome-15 lw-panel" aria-label="Today">
        <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

        <Link href={keep(first ? `/tasks/${first.caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
          <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
          <Icon name="chevron-right" size={20} />
        </Link>

        {tasks.length > 0 && (
          <ul className="lw-rows">
            {shown.map((r) => (
              <li key={r.caseId}>
                <Link
                  ref={(el) => {
                    if (el) rows.current.set(r.orderId, el)
                    else rows.current.delete(r.orderId)
                  }}
                  href={keep(`/tasks/${r.caseId}`)}
                  className={`lw-row${lift === r.orderId ? " lift" : ""}${tied === r.orderId ? " tied" : ""}`}
                  {...liftOn(r.orderId, setLift)}
                >
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
    </>
  )
}
