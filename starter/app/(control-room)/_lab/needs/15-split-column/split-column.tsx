"use client"

// needs 15: Apple's split view. Apple HIG, sidebars: "When a data hierarchy is deeper than two levels,
// consider using a split view interface that includes a content list between the sidebar items and
// detail view" (Mail, Notes, Reminders). The list sits between the menu and the card, always there,
// grouped by time under sticky headers; the time moves to the second line, so the car is never cut
// in a narrow column; the case you are on stays highlighted and in view while J / K move you.

import Link from "next/link"
import { useEffect, useMemo, useRef } from "react"
import { useLab } from "../../context"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"
import { byTime, moveFocus, timeIn } from "./groups"
import "./split-column.css"

/** Part Around: a list column beside the card (the card keeps its own column and scroll). */
export function SplitColumn({ children }: { children: React.ReactNode }) {
  const lab = useLab()
  const { open } = usePanel()
  const { rows, current, times, href } = useNeedsYou()
  const listRef = useRef<HTMLElement>(null)
  const groups = useMemo(() => byTime(rows, times), [rows, times])

  // The case you are on stays in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" })
  }, [current])

  if (rows.length === 0) return <>{children}</>
  return (
    <div className={`lab-needs-15 n15${open ? " n15-panel" : ""}`}>
      <nav className="n15-list" aria-label="Your tasks" ref={listRef} onKeyDown={(e) => moveFocus(e, listRef.current, "a.n15-row")}>
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            {groups.length > 1 && <h2 className="n15-head">{g.title}</h2>}
            <ul className="n15-rows">
              {g.rows.map((r) => {
                const t = times[r.caseId]
                const here = r.caseId === current
                return (
                  <li key={r.caseId}>
                    <Link href={href(r.caseId)} className="n15-row" aria-current={here ? "true" : undefined}>
                      <span className="n15-car">{r.vehicle}</span>
                      <span className="n15-place">{r.place}</span>
                      {here && lab.decided ? (
                        <span className="n15-time">Decided</span>
                      ) : (
                        t && <time className={t.now ? "n15-time n15-now" : "n15-time"}>{timeIn(t.text, g.key)}</time>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>
      {children}
    </div>
  )
}

/** Part Row: nothing under the card; the list is always beside it. */
export function SplitColumnRow() {
  return null
}
