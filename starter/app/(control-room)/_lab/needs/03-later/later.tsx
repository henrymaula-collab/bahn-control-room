"use client"

// needs 03: a third answer beside the card's two, "Not now", until a time (Superhuman Remind Me,
// Linear snooze "until a time or new activity", Untitled UI's Remind me list). The task leaves the
// queue, the next case opens, and the top of that case says when the first one comes back, with Undo.
// No engine field holds "later" yet: it lives in this browser's sessionStorage (see RATIONALE.md).

import "./later.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { clock } from "@/lib/control-room/format"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab, useLabPart } from "../../context"
import { DecisionDone, type DoneProps } from "../../../_ui/question"
import { Icon } from "../../../_ui/icons"
import { useNeedsYou } from "../../../_ui/work-frame"

type Later = { id: string; vehicle: string; until: string } // until: "12:30" or "new"
type Just = Later & { back: string } // the case you set aside, to undo from the next one

const KEY = "lab-needs-03-later"
const JUST = "lab-needs-03-just"
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = sessionStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (k: string, v: unknown) => {
  try {
    if (v == null) sessionStorage.removeItem(k)
    else sessionStorage.setItem(k, JSON.stringify(v))
  } catch {}
  subs.forEach((f) => f())
}
const subs = new Set<() => void>()
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
let snap = ""
/** The stored state as one string (stable between reads); "" on the server and in the first client paint. */
const useStore = () =>
  useSyncExternalStore(
    subscribe,
    () => {
      let s = ""
      try {
        s = `${sessionStorage.getItem(KEY) ?? ""}\u0000${sessionStorage.getItem(JUST) ?? ""}`
      } catch {}
      if (s !== snap) snap = s
      return snap
    },
    () => "",
  )
const parse = <T,>(v: string | undefined, fallback: T): T => {
  try {
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const useLater = () => {
  const [a, b] = useStore().split("\u0000")
  return { later: parse<Later[]>(a, []), just: parse<Just | null>(b, null) }
}

const untilWords = (u: string) => (u === "new" ? "when something new happens on the order" : `at ${u}`)

/** The choices for a case: two times before its decide-by, and "until something new happens". */
function choicesFor(row?: WorkRow): { until: string; title: string; sub: string }[] {
  const by = row?.decideBy ? Date.parse(row.decideBy) : NaN
  const at = (min: number) => clock(new Date(by - min * 60_000).toISOString())
  const times = Number.isFinite(by)
    ? [
        { until: at(30), title: `Until ${at(30)}`, sub: "Half an hour before you must decide" },
        { until: at(15), title: `Until ${at(15)}`, sub: "A quarter of an hour before" },
      ]
    : []
  return [...times, { until: "new", title: "Until something new happens", sub: "A reply from the pickup place or the customer brings it back" }]
}

/** Part `Top`: on the case you land on, what you set aside and when it comes back, with Undo. */
export function LaterNote() {
  const { just } = useLater()
  const { current, href } = useNeedsYou()
  const router = useRouter()
  if (!just || just.id === current) return null
  const undo = () => {
    const later = read<Later[]>(KEY, []).filter((l) => l.id !== just.id)
    write(KEY, later)
    write(JUST, null)
    router.push(href(just.id))
  }
  return (
    <div className="detail-inner lab-needs-03-note" role="status">
      <p className="s">
        {just.vehicle} is set aside. It comes back {untilWords(just.until)}.
      </p>
      <button type="button" className="lab-needs-03-undo s" onClick={undo}>
        Undo
      </button>
      <button type="button" className="lab-needs-03-x" aria-label="Close" onClick={() => write(JUST, null)}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

// The foot steps aside while this case shows its decided state.
let decided: string | null = null
const dsubs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), dsubs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (dsubs.add(f), () => void dsubs.delete(f)), () => decided, () => null)

/** Part `Row`: "Not now" pinned at the foot of the card column; it opens the times as a menu above it. */
export function LaterRow() {
  const { later } = useLater()
  const { rows, current, index, href, times } = useNeedsYou()
  const lab = useLab()
  const router = useRouter()
  const done = useDecided()
  const [open, setOpen] = useState(lab.others)
  const menu = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const aside = new Set(later.map((l) => l.id))
  const row = rows[index]
  const choices = choicesFor(row)
  // The next case that is not set aside.
  const nextRow =
    (index >= 0 ? rows.slice(index + 1) : rows).find((r) => r.caseId !== current && !aside.has(r.caseId)) ??
    rows.find((r) => r.caseId !== current && !aside.has(r.caseId))

  const setAside = useCallback(
    (until: string) => {
      if (!row) return
      const rest = read<Later[]>(KEY, []).filter((l) => l.id !== row.caseId)
      write(KEY, [...rest, { id: row.caseId, vehicle: row.vehicle, until }])
      write(JUST, { id: row.caseId, vehicle: row.vehicle, until, back: current })
      setOpen(false)
      if (nextRow) router.push(href(nextRow.caseId))
    },
    [row, current, nextRow, router, href],
  )

  // H opens "Not now" (Superhuman: "H for hour to be reminded"); the menu takes arrows, Enter and Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable], dialog")) return
      if (e.key === "h") {
        e.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>(".lab-needs-03-choice")?.focus())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !menu.current?.parentElement?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
        button.current?.focus()
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>(".lab-needs-03-choice") ?? [])]
        const at = items.indexOf(document.activeElement as HTMLElement)
        if (!items.length) return
        e.preventDefault()
        e.stopPropagation()
        items[Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus()
      }
    }
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [open])

  if (!row || done === current) return null
  const others = later.filter((l) => l.id !== current)
  const t = nextRow ? times[nextRow.caseId] : undefined
  return (
    <div className="lab-needs-03">
      {open && (
        <div className="lab-needs-03-menu" ref={menu} role="menu" aria-label={`Set ${row.vehicle} aside`}>
          <p className="s lab-needs-03-label">Set {row.vehicle} aside</p>
          {choices.map((c) => (
            <button key={c.until} type="button" role="menuitem" className="lab-needs-03-choice" onClick={() => setAside(c.until)}>
              <span className="lab-needs-03-what">
                <span className="m">{c.title}</span>
                <span className="s">{c.sub}</span>
              </span>
            </button>
          ))}
          <p className="s lab-needs-03-then">{nextRow ? `${nextRow.vehicle} opens next.` : "Nothing else is waiting; this case stays open."}</p>
          {others.length > 0 && (
            <div className="lab-needs-03-aside">
              <p className="s lab-needs-03-label">Set aside</p>
              {others.map((l) => (
                <Link key={l.id} href={href(l.id)} className="lab-needs-03-item" role="menuitem">
                  <span className="m">{l.vehicle}</span>
                  <span className="s">Back {untilWords(l.until)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        ref={button}
        type="button"
        className="lab-needs-03-later"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-keyshortcuts="H"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3 2 6" />
          <path d="m22 6-3-3" />
        </svg>
        <span>Not now</span>
        <span className="lab-needs-03-key" aria-hidden="true">
          H
        </span>
      </button>
      {others.length > 0 && !open && (
        <span className="s lab-needs-03-count">{others.length === 1 ? `${others[0].vehicle} set aside` : `${others.length} set aside`}</span>
      )}
      {nextRow && (
        <Link href={href(nextRow.caseId)} className="lab-needs-03-next" aria-keyshortcuts="J" aria-label={`Next: ${nextRow.vehicle}`}>
          <span className="lab-needs-03-car">{nextRow.vehicle}</span>
          {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
          <Icon name="chevron-right" size={18} />
        </Link>
      )}
    </div>
  )
}

/** Part `Done`: the decide slot's moment after (today's or a decide variant); the foot steps aside. */
export function LaterDone(props: DoneProps) {
  const { current } = useNeedsYou()
  const Base = useLabPart("decide", "Done", DecisionDone)
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  return <Base {...props} />
}
