"use client"

// needs 04: one line above the card that shows where you are in the queue (GitHub's review progress,
// HEY Focus & Reply, a queue sorted by time left). Every task is a mark, in decide-by order; the one
// you are on is drawn solid, red marks must be decided within the hour, decided marks fill on the
// left. Hover or focus names a mark; a click opens it. 3, 12 and 37 tasks are the same one line.

import "./run-line.css"
import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLab, useLabPart } from "../../context"
import { DecisionDone, type DoneProps } from "../../../_ui/question"
import { useNeedsYou } from "../../../_ui/work-frame"

type Decided = { id: string; vehicle: string }
const KEY = "lab-needs-04-run"
const subs = new Set<() => void>()
let snap = ""
// The lab's ?decided=1 saves nothing, so its decided mark is kept in memory only.
let shown: Decided | null = null
const useRun = (): Decided[] => {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => {
      let v = ""
      try {
        v = sessionStorage.getItem(KEY) ?? ""
      } catch {}
      if (shown) {
        const run = v ? (JSON.parse(v) as Decided[]) : []
        if (!run.some((r) => r.id === shown!.id)) v = JSON.stringify([...run, shown])
      }
      if (v !== snap) snap = v
      return snap
    },
    () => "",
  )
  try {
    return s ? (JSON.parse(s) as Decided[]) : []
  } catch {
    return []
  }
}
const addRun = (d: Decided, onlyShown: boolean) => {
  if (onlyShown) {
    shown = d
    subs.forEach((f) => f())
    return
  }
  try {
    const run = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Decided[]
    if (!run.some((r) => r.id === d.id)) sessionStorage.setItem(KEY, JSON.stringify([...run, d]))
  } catch {}
  subs.forEach((f) => f())
}

type Mark = { id: string; vehicle: string; place?: string; time?: { text: string; now: boolean }; done: boolean; here: boolean; href?: string }

/** Part `Top`: the line of marks and where you are. */
export function RunLine() {
  const { rows, current, times, href } = useNeedsYou()
  const run = useRun()
  const [hover, setHover] = useState<number | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const lab = useLab()
  if (!rows.length && !run.length) return null

  const inRows = new Set(rows.map((r) => r.caseId))
  const doneIds = new Set(run.map((r) => r.id))
  const marks: Mark[] = [
    // Decided earlier in this run and gone from the queue: filled, on the left.
    ...run.filter((d) => !inRows.has(d.id)).map((d) => ({ id: d.id, vehicle: d.vehicle, done: true, here: d.id === current })),
    ...rows.map((r) => ({
      id: r.caseId,
      vehicle: r.vehicle,
      place: r.place,
      time: times[r.caseId],
      done: doneIds.has(r.caseId),
      here: r.caseId === current,
      href: href(r.caseId),
    })),
  ]
  const at = marks.findIndex((m) => m.here)
  const decided = marks.filter((m) => m.done).length
  const label = at >= 0 && marks[at].done ? `${decided} of ${marks.length} decided` : at >= 0 ? `${at + 1} of ${marks.length}` : `${marks.length - decided} left`
  // The lab's ?others=open shows the next mark named, as a pointer over it would.
  const shownAt = hover ?? (lab.others && at >= 0 && at + 1 < marks.length ? at + 1 : null)
  const tip = shownAt != null ? marks[shownAt] : null

  const move = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const links = [...(strip.current?.querySelectorAll<HTMLElement>(".lab-needs-04-mark") ?? [])]
    const to = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : Math.max(0, Math.min(links.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))
    links[to]?.focus()
  }

  return (
    <div className="detail-inner lab-needs-04" onMouseLeave={() => setHover(null)}>
      <div className={`lab-needs-04-strip${marks.length > 20 ? " many" : ""}`} ref={strip} role="list" aria-label="Your tasks in decide-by order">
        {marks.map((m, i) => {
          const cls = `lab-needs-04-mark${m.here ? " here" : ""}${m.done ? " done" : ""}${!m.done && m.time?.now ? " now" : ""}`
          const name = `${m.vehicle}${m.time ? `, decide by ${m.time.text}` : ""}${m.done ? ", decided" : ""}${m.here ? ", open" : ""}`
          const common = {
            className: cls,
            "aria-label": name,
            onMouseEnter: () => setHover(i),
            onFocus: () => setHover(i),
            onBlur: () => setHover(null),
            onKeyDown: (e: React.KeyboardEvent) => move(e, i),
          }
          return (
            <span role="listitem" key={m.id} className="lab-needs-04-cell">
              {m.href && !m.here ? (
                <Link href={m.href} {...common}>
                  <span className="lab-needs-04-bar" />
                </Link>
              ) : (
                <span tabIndex={0} aria-current={m.here ? "true" : undefined} {...common}>
                  <span className="lab-needs-04-bar" />
                </span>
              )}
            </span>
          )
        })}
      </div>
      <span className="lab-needs-04-at" aria-live="polite">
        {label}
      </span>
      {tip && (
        <div
          className="lab-needs-04-tip"
          role="tooltip"
          style={{ left: `clamp(0%, calc(${((shownAt! + 0.5) / marks.length) * 100}% - 7em), calc(100% - 14em))` }}
        >
          <span className="m">{tip.vehicle}</span>
          <span className="s">
            {tip.done ? "Decided" : tip.time ? `Decide by ${tip.time.text}` : "No time set"}
            {tip.place ? `, ${tip.place}` : ""}
          </span>
        </div>
      )}
    </div>
  )
}

/** Part `Done`: the decide slot's moment after (today's or a decide variant), and this case's mark fills. */
export function RunLineDone(props: DoneProps) {
  const { current, rows } = useNeedsYou()
  const Base = useLabPart("decide", "Done", DecisionDone)
  const lab = useLab()
  const vehicle = rows.find((r) => r.caseId === current)?.vehicle ?? ""
  useEffect(() => {
    if (current) addRun({ id: current, vehicle }, lab.decided)
  }, [current, vehicle, lab.decided])
  return <Base {...props} />
}
