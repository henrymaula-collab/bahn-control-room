"use client"

// needs 10: Go to a task, Command K. A palette in the upper third over any page (Linear), type a car,
// a pickup place, an order number or a time; the first match is ready, Enter opens it (Raycast);
// grouped by time, a key legend at the foot (Chatwoot). The card's row says the shortcut, so the
// key is taught where the list used to be. The palette lives in the side menu's mount (part Menu),
// so Command K also works from the Overview.

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab, useMenuNeeds } from "../../context"
import { keepQuery } from "../../slots"
import { useOtherTasks } from "../../../_ui/work-frame"
import { groupOf, type RowTimes } from "./groups"
import "./go-to-task.css"

const OPEN = "lab-needs-10-open"

/** What a row can be found by: the car, the pickup place, the order number, the time. */
const hay = (r: WorkRow, times: RowTimes) =>
  `${r.vehicle} ${r.place} ${r.orderId.replace(/^ord-0*/, "")} ${r.orderId} ${times[r.caseId]?.text ?? ""}`.toLowerCase()

function Mark({ text, q }: { text: string; q: string }) {
  const first = q.trim().split(/\s+/)[0]?.toLowerCase()
  const at = first ? text.toLowerCase().indexOf(first) : -1
  if (!first || at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <b>{text.slice(at, at + first.length)}</b>
      {text.slice(at + first.length)}
    </>
  )
}

/** Part Menu: the palette and its key, on every page (rendered in the side menu, shown in the top layer). */
export function GoToTask() {
  const { rows, times } = useMenuNeeds()
  const lab = useLab()
  const path = usePathname() ?? "/"
  const params = useSearchParams()
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const current = path.startsWith("/tasks/") ? decodeURIComponent(path.split("/")[2] ?? "") : ""
  const keep = keepQuery(params)

  // The ones you can go to: every task but the one on screen.
  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => r.caseId !== current && words.every((w) => hay(r, times).includes(w)))
  }, [rows, times, q, current])

  const show = useCallback(() => {
    setQ("")
    setActive(0)
    setOpen(true)
  }, [])

  // Command K (Control K off a Mac) from anywhere; the card's row sends the same event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (ref.current?.open) setOpen(false)
        else show()
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN, show)
    return () => (window.removeEventListener("keydown", onKey), window.removeEventListener(OPEN, show))
  }, [show])

  // ?others=open on Your tasks: the palette open on first paint.
  useEffect(() => {
    if (lab.others && current) show()
  }, [lab.others, current, show])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      input.current?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  // The active row stays in view as the arrows move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const go = (r?: WorkRow) => {
    if (!r) return
    setOpen(false)
    router.push(`/tasks/${encodeURIComponent(r.caseId)}${keep}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, Math.min(found.length - 1, a + (e.key === "ArrowDown" ? 1 : -1))))
    }
    if (e.key === "Enter") {
      e.preventDefault()
      go(found[active])
    }
  }

  // Grouped by time; a lone group needs no name.
  let i = -1
  const groups: { title: string; rows: WorkRow[] }[] = []
  for (const r of found) {
    const g = groupOf(times[r.caseId])
    const last = groups[groups.length - 1]
    if (last && last.title === g.title) last.rows.push(r)
    else groups.push({ title: g.title, rows: [r] })
  }

  return (
    <dialog
      ref={ref}
      className="lab-needs-10 n10-palette"
      aria-label="Go to a task"
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === ref.current && setOpen(false)}
    >
      <div className="n10-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => (setQ(e.target.value), setActive(0))}
          onKeyDown={onKey}
          placeholder="Go to a task: car, place, order or time"
          aria-label="Go to a task"
          aria-controls="n10-list"
          aria-activedescendant={found[active] ? `n10-${found[active].caseId}` : undefined}
          role="combobox"
          aria-expanded="true"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="n10-list" id="n10-list" role="listbox" ref={listRef}>
        {groups.map((g) => (
          <Fragment key={g.title}>
            {groups.length > 1 && <p className="n10-head">{g.title}</p>}
            {g.rows.map((r) => {
              i += 1
              const n = i
              const t = times[r.caseId]
              return (
                <button
                  key={r.caseId}
                  id={`n10-${r.caseId}`}
                  type="button"
                  role="option"
                  aria-selected={n === active}
                  data-i={n}
                  tabIndex={-1}
                  className="n10-row"
                  onMouseMove={() => n !== active && setActive(n)}
                  onClick={() => go(r)}
                >
                  <span className="n10-car">
                    <Mark text={r.vehicle} q={q} />
                  </span>
                  <span className="n10-place">
                    <Mark text={r.place} q={q} />
                  </span>
                  {t && <time className={t.now ? "n10-now" : undefined}>{t.text}</time>}
                  <span className="n10-enter" aria-hidden="true">
                    ↵
                  </span>
                </button>
              )
            })}
          </Fragment>
        ))}
        {found.length === 0 && (
          <div className="n10-none">
            <p>{rows.length > 1 || !current ? <>No task matches &ldquo;{q}&rdquo;.</> : "Nothing else needs you."}</p>
            <a href={`/orders${keep}`} className="n10-orders">
              Search every order in Orders
            </a>
          </div>
        )}
      </div>
      <p className="n10-keys" aria-hidden="true">
        <span>
          <b>↵</b> to open
        </span>
        <span>
          <b>↑ ↓</b> to move
        </span>
        <span>
          <b>esc</b> to close
        </span>
      </p>
    </dialog>
  )
}

/** Part Row: today's Other tasks row, but it opens the palette and teaches its key. */
export function GoToTaskRow() {
  const { rows, show } = useOtherTasks()
  const [mac, setMac] = useState(true)
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), [])
  if (!show || rows.length === 0) return null
  return (
    <button type="button" className="row-link lab-needs-10 n10-row-link" aria-haspopup="dialog" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"} onClick={() => window.dispatchEvent(new Event(OPEN))}>
      <span className="m title">Other tasks</span>
      <span className="m n10-count num">{rows.length}</span>
      <span className="n10-key">{mac ? "⌘K" : "Ctrl K"}</span>
    </button>
  )
}
