"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { Key, liftOn, n, useBoth, useFit, useKeep, useRoomClock, when } from "../shared"
import "./countdown.css"

/** "30 min" as words, "1 h 20 min", "5 min late"; a day or more away falls back to the clock. */
function left(ms: number): string | null {
  const min = Math.floor(ms / 60_000)
  if (min < 0) return `${-min} min late`
  if (min < 60) return `${min} min`
  if (min < 12 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`
  return null
}
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Time left is the row's figure and the room's clock moves: the first deadline counts down in the pill. */
export function Countdown({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const t = useRoomClock(now, 1000)
  const fit = useFit(box, Math.min(tasks.length, 6))
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const first = tasks[0]
  const firstLeft = first?.decideBy ? Date.parse(first.decideBy) - t : null
  const nowIso = new Date(t).toISOString()

  return (
    <section ref={ref} className="lab-welcome lab-welcome-03 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      {first ? (
        <Link href={keep(`/tasks/${first.caseId}`)} className="lw-pill go">
          <span>Start with the {first.vehicle}</span>
          {firstLeft != null && firstLeft > 0 && firstLeft < 3_600_000 && (
            <span className="timer" aria-label={`${Math.ceil(firstLeft / 60_000)} minutes left`}>
              {mmss(firstLeft)}
            </span>
          )}
          <Icon name="chevron-right" size={20} />
        </Link>
      ) : (
        <p className="calm">Nothing needs you right now.</p>
      )}

      {tasks.length > 0 && (
        <ul className="lw-rows">
          {shown.map((r) => {
            const ms = r.decideBy ? Date.parse(r.decideBy) - t : null
            const words = ms != null ? left(ms) : null
            const hot = ms != null && ms <= 3_600_000
            return (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="lw-v">{r.vehicle}</span>
                  <span className="lw-p">{r.place}</span>
                  {r.decideBy && (
                    <span className="when">
                      <span className={`in${hot ? " now" : ""}`}>{words ?? when(r.decideBy, nowIso)}</span>
                      {words && <time>{when(r.decideBy, nowIso)}</time>}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
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
