"use client"

import Link from "next/link"
import { useMemo, useRef } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useBoth, useFit, useKeep, when, word } from "../shared"
import "./by-place.css"

type Place = { place: string; rows: WorkRow[] }

/** Her tasks by pickup place, the place with the earliest deadline first. */
function byPlace(tasks: WorkRow[]): Place[] {
  const m = new Map<string, WorkRow[]>()
  for (const r of tasks) m.set(r.place, [...(m.get(r.place) ?? []), r])
  return [...m.entries()].map(([place, rows]) => ({ place, rows })) // tasks arrive most urgent first
}

/** One call covers several cars: the tasks grouped by pickup place, with a one-line briefing. */
export function ByPlace({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const places = useMemo(() => byPlace(tasks), [tasks])
  const fit = useFit(box, Math.min(places.length, 5), 1)
  const shown = places.slice(0, fit)
  const restCars = places.slice(fit).reduce((s, p) => s + p.rows.length, 0)
  const top = [...places].sort((a, b) => b.rows.length - a.rows.length)[0]
  const brief = !tasks.length
    ? "Nothing needs you right now."
    : top && top.rows.length > 1
      ? `${word(top.rows.length)} of your ${word(tasks.length, true)} are at ${top.place}.`
      : `${word(tasks.length)} cars, ${word(places.length, true)} pickup places.`
  const first = places[0]

  return (
    <section ref={ref} className="lab-welcome lab-welcome-07 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>
      <p className="brief">{brief}</p>

      {first && (
        <Link href={keep(`/tasks/${first.rows[0].caseId}`)} className="lw-pill go">
          <span>{first.rows.length > 1 ? `Start with ${first.place}, ${word(first.rows.length, true)} cars` : `Start with the ${first.rows[0].vehicle}`}</span>
          <Icon name="chevron-right" size={20} />
        </Link>
      )}

      {shown.length > 0 && (
        <ul className="places">
          {shown.map((p) => (
            <li key={p.place} className="place">
              <p className="pname">{p.place}</p>
              <ul>
                {p.rows.slice(0, 3).map((r) => (
                  <li key={r.caseId}>
                    <Link href={keep(`/tasks/${r.caseId}`)} className={`car${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                      <span className="v">{r.vehicle}</span>
                      {r.decideBy && <time className={isNow(r, now) ? "now" : undefined}>{when(r.decideBy, now)}</time>}
                    </Link>
                  </li>
                ))}
                {p.rows.length > 3 && <li className="also">and {n(p.rows.length - 3)} more here</li>}
              </ul>
            </li>
          ))}
          {restCars > 0 && (
            <li>
              <Link href={keep("/tasks")} className="lw-row lw-more">
                <span>{n(restCars)} more at {n(places.length - fit)} other places</span>
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
