"use client"

// The dock (Henry, 25 Oct, needs:07 "we go with the dock, it has good flexibility if you have many
// cases"): a small bar floating at the bottom of the card column that stays while the case above
// it changes. ‹ the previous case, "Up next" opens the rest of Your tasks upward, the next car and
// its decide-by time ›. No "2 of 12": the side menu already says how many (Henry, h37).
// It also carries a short note with Undo for 10 seconds after a case was sent to a colleague.

import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { Icon } from "./icons"
import { useNeedsYou } from "./work-frame"

/** A short note in the dock ("Ferrari Roma sent to Jonas"), with Undo while `until` has not passed. */
export type DockNote = { id: number; text: string; until: number; undo?: () => Promise<void> | void }
let note: DockNote | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export function showDockNote(text: string, undo?: DockNote["undo"], ms = 10_000) {
  note = { id: Date.now(), text, until: Date.now() + ms, undo }
  emit()
}
export function clearDockNote() {
  note = null
  emit()
}
const useNote = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => note, () => null)

/** The other cases: the ones after the open case in Your tasks' order, then the ones before it. */
function upNext(rows: WorkRow[], current: string, next?: WorkRow): { after: WorkRow[]; before: WorkRow[] } {
  const others = rows.filter((r) => r.caseId !== current)
  const from = next ? others.findIndex((r) => r.caseId === next.caseId) : 0
  return from > 0 ? { after: others.slice(from), before: others.slice(0, from) } : { after: others, before: [] }
}

export function TaskDock() {
  const { rows, current, prev, next, times, href } = useNeedsYou()
  const n = useNote()
  const [up, setUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // A new case closes Up next; outside clicks and Escape close it too.
  useEffect(() => setUp(false), [current])
  useEffect(() => {
    if (!up) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setUp(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setUp(false))
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [up])

  // The note goes away by itself when its Undo window closes.
  useEffect(() => {
    if (!n) return
    const t = window.setTimeout(() => note?.id === n.id && clearDockNote(), Math.max(0, n.until - Date.now()))
    return () => window.clearTimeout(t)
  }, [n])

  const { after, before } = upNext(rows, current, next)
  const tNext = next ? times[next.caseId] : undefined
  if (!current || (!after.length && !before.length && !n)) return null
  const item = (r: WorkRow) => {
    const t = times[r.caseId]
    return (
      <Link key={r.caseId} href={href(r.caseId)} role="menuitem" className="task-dock-row" onClick={() => setUp(false)}>
        <span className="task-dock-car">{r.vehicle}</span>
        <span className="task-dock-place">{r.place}</span>
        {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
      </Link>
    )
  }

  return (
    <div className="task-dock-bay">
      <div ref={box} className={`task-dock${n ? " told" : ""}${up ? " up" : ""}`}>
        {up && !n && (
          <div className="task-dock-queue" role="menu" aria-label="Up next">
            <div className="task-dock-scroll">
              {after.length > 0 && <p className="task-dock-label">Up next</p>}
              {after.map(item)}
              {before.length > 0 && <p className="task-dock-label">Earlier</p>}
              {before.map(item)}
            </div>
          </div>
        )}
        {n ? (
          <div className="task-dock-bar" role="status" key={`note-${n.id}`}>
            <Icon name="check" size={18} />
            <span className="task-dock-said">{n.text}</span>
            {n.undo && (
              <button
                type="button"
                className="task-dock-open"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await n.undo?.()
                  } finally {
                    setBusy(false)
                    clearDockNote()
                  }
                }}
              >
                Undo
              </button>
            )}
          </div>
        ) : (
          <div className="task-dock-bar" key="walk">
            {prev ? (
              <Link href={href(prev.caseId)} className="task-dock-step" aria-label={`Previous: ${prev.vehicle}`} aria-keyshortcuts="K" title="Previous (K)">
                <Icon name="chevron-left" size={18} />
              </Link>
            ) : (
              <span className="task-dock-step off" aria-hidden="true">
                <Icon name="chevron-left" size={18} />
              </span>
            )}
            <button type="button" className="task-dock-where" aria-haspopup="menu" aria-expanded={up} onClick={() => setUp((u) => !u)}>
              <span>Up next</span>
              <Icon name={up ? "chevron-down" : "chevron-up"} size={16} />
            </button>
            {next ? (
              <Link href={href(next.caseId)} className="task-dock-next" aria-label={`Next: ${next.vehicle}${tNext ? `, by ${tNext.text}` : ""}`} aria-keyshortcuts="J" title="Next (J)">
                <span className="task-dock-car" key={next.caseId}>
                  {next.vehicle}
                </span>
                {tNext && <time className={tNext.now ? "now" : undefined}>{tNext.text}</time>}
                <Icon name="chevron-right" size={18} />
              </Link>
            ) : (
              <span className="task-dock-next off">Last one</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
