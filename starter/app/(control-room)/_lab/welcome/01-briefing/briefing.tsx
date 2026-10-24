"use client"

import Link from "next/link"
import { useRef } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { dayOf, isNow, Key, liftOn, n, plural, useBoth, useFit, useKeep, when, word } from "../shared"
import "./briefing.css"

/** The greeting carries the day: "Welcome back, Aino." then the one fact that matters, in grey. */
export function Briefing({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 6))
  const first = tasks[0]
  const allToday = tasks.length > 0 && tasks.every((r) => r.decideBy && dayOf(r.decideBy, now) === 0)
  const last = tasks.reduce<string | undefined>((m, r) => (r.decideBy && (!m || r.decideBy > m) ? r.decideBy : m), undefined)
  const fact = !tasks.length
    ? `Nothing needs you. The agent is on ${n(counts.agentWorking)}.`
    : allToday && last
      ? `${word(tasks.length)} ${plural(tasks.length, "car needs", "cars need")} you by ${when(last, now)}.`
      : `${word(tasks.length)} ${plural(tasks.length, "car needs", "cars need")} you, the first by ${first.decideBy ? when(first.decideBy, now) : "today"}.`
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length

  return (
    <section ref={ref} className="lab-welcome lab-welcome-01 lw-panel" aria-label="Today">
      <h1 className="lw-display">
        Welcome back, {firstName}. <span className="lw01-fact">{fact}</span>
      </h1>

      {first && (
        <Link href={keep(`/tasks/${first.caseId}`)} className="lw-pill go">
          <span>Start with the {first.vehicle}</span>
          <Icon name="chevron-right" size={20} />
        </Link>
      )}

      {tasks.length > 0 && (
        <ul className="lw-rows">
          {shown.map((r) => (
            <li key={r.caseId}>
              <Link
                href={keep(`/tasks/${r.caseId}`)}
                className={`lw-row${lift === r.orderId ? " lift" : ""}`}
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
  )
}
