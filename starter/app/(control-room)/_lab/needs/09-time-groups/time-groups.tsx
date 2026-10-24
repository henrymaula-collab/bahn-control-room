"use client"

// needs 09: Other tasks opens in place, grouped by time (Things 3's Today / This Evening, Lightfield's
// grouped tasks). The first group is open; a later group of more than four folds into one row with
// its count, so 37 tasks take about eighteen rows. Opening scrolls the list into view: at Henry's Safari size the card fills the
// column and a list under it would open below the fold.

import Link from "next/link"
import { useEffect, useRef } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab } from "../../context"
import { Icon } from "../../../_ui/icons"
import { useOtherTasks } from "../../../_ui/work-frame"
import { byTime, moveFocus, timeIn, type RowTimes } from "./groups"
import "./time-groups.css"

/** Scroll the card column just enough to show the opened list, never past its own row. */
function reveal(el: HTMLElement | null, smooth: boolean) {
  const box = el?.closest<HTMLElement>(".detail")
  if (!el || !box) return
  requestAnimationFrame(() => {
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const by = Math.min(r.top - b.top - 16, r.bottom - b.bottom + 24)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (by > 0) box.scrollBy({ top: by, behavior: smooth && !still ? "smooth" : "auto" })
  })
}

function Rows({ rows, times, href, group }: { rows: WorkRow[]; times: RowTimes; href: (id: string) => string; group: string }) {
  return (
    <ul className="rows-list">
      {rows.map((r) => {
        const t = times[r.caseId]
        return (
          <li key={r.caseId}>
            <Link href={href(r.caseId)} className="wrow n09-one">
              <span className="v">{r.vehicle}</span>
              <span className="p">{r.place}</span>
              {t && <time className={t.now ? "now" : undefined}>{timeIn(t.text, group)}</time>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function TimeGroups() {
  const { rows, times, href, show } = useOtherTasks()
  const lab = useLab()
  const ref = useRef<HTMLDetailsElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // ?others=open: the list open on first paint, in view.
  useEffect(() => {
    if (lab.others) reveal(ref.current, false)
  }, [lab.others])

  if (!show || rows.length === 0) return null
  const groups = byTime(rows, times)
  const few = rows.length <= 5 // a handful: every group open
  const folds = (n: number, i: number) => !few && i > 0 && n > 4 // only a big later group folds to a count

  return (
    <details
      ref={ref}
      className="row others lab-needs-09"
      open={lab.others || undefined}
      onToggle={(e) => e.currentTarget.open && reveal(e.currentTarget, true)}
    >
      <summary>
        <span className="m title">Other tasks</span>
        <span className="m count num">{rows.length}</span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </summary>
      <div className="body n09-body" ref={list} onKeyDown={(e) => moveFocus(e, list.current, "a.wrow, summary")}>
        {groups.map((g, i) =>
          !folds(g.rows.length, i) ? (
            <section key={g.key} className="n09-group" aria-label={g.title}>
              {groups.length > 1 && <h3 className="n09-head">{g.title}</h3>}
              <Rows rows={g.rows} times={times} href={href} group={g.key} />
            </section>
          ) : (
            <details key={g.key} className="n09-later" onToggle={(e) => e.currentTarget.open && reveal(e.currentTarget, true)}>
              <summary>
                <span className="n09-later-title">{g.title}</span>
                <span className="n09-count num">{g.rows.length}</span>
                <span className="n09-chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </summary>
              <Rows rows={g.rows} times={times} href={href} group={g.key} />
            </details>
          ),
        )}
      </div>
    </details>
  )
}
