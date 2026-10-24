"use client"

// needs 12: the side menu never lists tasks, it counts them. Under the sections, "Needs you" by time
// in at most three lines (Things 3's sidebar: Today, Upcoming, each with a count; Superhuman's split
// counts). A line opens its tasks as a popover beside the menu (Dovetail), over the page, so the
// menu is as tall with 37 tasks as with 3. Apple HIG: no more than two levels in a sidebar.

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab, useMenuNeeds } from "../../context"
import { keepQuery } from "../../slots"
import { groupOf, moveFocus } from "./groups"
import "./menu-counts.css"

type Line = { key: string; title: string; rows: WorkRow[] }

/** At most three lines: within the hour, later today, tomorrow or later. */
function linesOf(rows: WorkRow[], times: Record<string, { text: string; now: boolean }>): Line[] {
  const lines: Line[] = [
    { key: "hour", title: "Within the hour", rows: [] },
    { key: "today", title: "Later today", rows: [] },
    { key: "later", title: "Tomorrow or later", rows: [] },
  ]
  for (const r of rows) {
    const g = groupOf(times[r.caseId]).key
    lines[g === "hour" ? 0 : g === "morning" || g === "afternoon" || g === "evening" ? 1 : 2].rows.push(r)
  }
  return lines.filter((l) => l.rows.length > 0)
}

/** Part Menu: the counted lines under the sections, and the popover one of them opens. */
export function MenuCounts() {
  const { rows, times } = useMenuNeeds()
  const lab = useLab()
  const path = usePathname() ?? "/"
  const params = useSearchParams()
  const keep = keepQuery(params)
  const current = path.startsWith("/tasks/") ? decodeURIComponent(path.split("/")[2] ?? "") : ""
  // Right after a decision the decided case leaves the counts, as it leaves the queue.
  const live = useMemo(() => (lab.decided ? rows.filter((r) => r.caseId !== current) : rows), [rows, lab.decided, current])
  const lines = useMemo(() => linesOf(live, times), [live, times])
  const [open, setOpen] = useState<string | null>(null)
  const [at, setAt] = useState<{ left: number; top: number; maxH: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  // ?others=open on Your tasks: the first line's popover open on first paint.
  useEffect(() => {
    if (lab.others && current && lines[0]) setOpen(lines[0].key)
  }, [lab.others, current]) // eslint-disable-line react-hooks/exhaustive-deps

  const place = useCallback(() => {
    const line = box.current?.querySelector<HTMLElement>(`[data-line="${open}"]`)
    const side = line?.closest<HTMLElement>("aside") ?? line
    if (!line || !side) return setAt(null)
    const l = line.getBoundingClientRect()
    const vh = window.innerHeight
    const maxH = Math.min(vh - 24, Math.max(240, vh * 0.7))
    // Beside the menu, level with the line, kept inside the window.
    setAt({ left: side.getBoundingClientRect().right + 8, top: Math.max(12, Math.min(l.top - 10, vh - 12 - maxH)), maxH })
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [open, place])

  // Outside click and Escape close it; focus goes into the list when it opens from the keyboard.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !box.current?.contains(t)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(null)
      box.current?.querySelector<HTMLElement>(`[data-line="${open}"]`)?.focus()
    }
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [open])

  // A count that only repeats "Your tasks N" goes (Sofie's one task, "Tomorrow or later 1"): the
  // section shows when it splits the queue or says that all of it is within the hour (in red).
  if (!lines.length || live.length < 2 || (lines.length === 1 && lines[0].key !== "hour")) return null
  const shown = lines.find((l) => l.key === open)

  return (
    <div className="lab-needs-12 n12" ref={box}>
      <p className="n12-head">Needs you</p>
      {lines.map((l) => (
        <button
          key={l.key}
          type="button"
          data-line={l.key}
          className="n12-line"
          aria-haspopup="dialog"
          aria-expanded={open === l.key}
          onClick={() => setOpen(open === l.key ? null : l.key)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || (e.key === "ArrowDown" && open === l.key)) {
              e.preventDefault()
              setOpen(l.key)
              requestAnimationFrame(() => pop.current?.querySelector<HTMLElement>("a")?.focus())
            }
          }}
        >
          <span className="n12-title">{l.title}</span>
          <span className="n12-count num">{l.rows.length}</span>
        </button>
      ))}
      {shown &&
        at &&
        createPortal(
          <div
            ref={pop}
            className="lab-needs-12 n12-pop"
            role="dialog"
            aria-label={shown.title}
            style={{ left: at.left, top: at.top, maxHeight: at.maxH }}
            onKeyDown={(e) => moveFocus(e, pop.current, "a")}
          >
            <p className="n12-pop-head">
              {shown.title} <span className="num">{shown.rows.length}</span>
            </p>
            <ul className="n12-list">
              {shown.rows.map((r) => {
                const t = times[r.caseId]
                const here = r.caseId === current
                return (
                  <li key={r.caseId}>
                    <Link href={`/tasks/${encodeURIComponent(r.caseId)}${keep}`} className="n12-row" aria-current={here ? "true" : undefined} onClick={() => setOpen(null)}>
                      <span className="n12-car">{r.vehicle}</span>
                      <span className="n12-place">{r.place}</span>
                      {here && lab.decided ? <span className="n12-time">Decided</span> : t && <time className={t.now ? "n12-time n12-now" : "n12-time"}>{t.text}</time>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}

/** Part Row: nothing under the card; the menu carries the counts. */
export function MenuCountsRow() {
  return null
}
