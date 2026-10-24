"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { minutesUntil, NOW_WINDOW_MINUTES } from "@/lib/control-room/format"
import type { WorkRow } from "@/lib/control-room/types-v3"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { dayOf, isNow, Key, liftOn, n, useBoth, useFit, useKeep, when } from "../shared"
import "./by-time.css"

type Group = { name: string; rows: WorkRow[] }

/** Split by when, the way Things splits Today from This Evening: the first group open, the rest one line each. */
function groups(tasks: WorkRow[], now: string): Group[] {
  const g: Group[] = [
    { name: "Within the hour", rows: [] },
    { name: "Later today", rows: [] },
    { name: "Tomorrow", rows: [] },
    { name: "Later", rows: [] },
  ]
  for (const r of tasks) {
    if (!r.decideBy) g[3].rows.push(r)
    else if (minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES) g[0].rows.push(r)
    else if (dayOf(r.decideBy, now) === 0) g[1].rows.push(r)
    else if (dayOf(r.decideBy, now) === 1) g[2].rows.push(r)
    else g[3].rows.push(r)
  }
  return g.filter((x) => x.rows.length)
}

export function ByTime({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const gs = useMemo(() => groups(tasks, now), [tasks, now])
  const [open, setOpen] = useState<string | null>(null)
  const openName = open ?? gs[0]?.name
  const openRows = gs.find((g) => g.name === openName)?.rows ?? []
  const fit = useFit(box, Math.min(openRows.length, 6), 1)
  const shown = openRows.slice(0, fit)
  const rest = openRows.length - shown.length

  return (
    <section ref={ref} className="lab-welcome lab-welcome-06 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      <Link href={keep(tasks[0] ? `/tasks/${tasks[0].caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
        <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
        <Icon name="chevron-right" size={20} />
      </Link>

      {gs.length > 0 && (
        <div className="groups">
          {gs
            .filter((g) => g.name === openName)
            .map((g) => (
              <div key={g.name} className="group open">
                <p className="ghead">
                  <span className="gname">{g.name}</span>
                  <span className="gcount">{n(g.rows.length)}</span>
                </p>
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
                        <span>{n(rest)} more {g.name.toLowerCase()}</span>
                        <Icon name="chevron-right" size={16} />
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          {gs.length > 1 && (
            <div className="folded" aria-label="The other groups">
              {gs
                .filter((g) => g.name !== openName)
                .map((g) => (
                  <button key={g.name} type="button" className="fold" onClick={() => setOpen(g.name)}>
                    {g.name} <span>{n(g.rows.length)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <Key counts={counts} />
    </section>
  )
}
