"use client"
// Slot `welcome`: helpers every variant shares (owned by builder W). Adopting a variant = copy its
// folder and this file (+ shared.css); in v4 `useKeep` becomes `(p) => p` (no lab params there).

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import type { WorkRow } from "@/lib/control-room/types-v3"
import type { Option } from "@/lib/control-room/types"
import { answerFor, questionFor } from "../../_ui/ask"
import { keepQuery } from "../slots"
import "./shared.css"

export { when }
export const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
/** "Three" for 3, "12" for 12 (Apple's style guide: spell out one to nine in prose). */
export const word = (x: number, lower = false) => (x < 10 ? (lower ? WORDS[x].toLowerCase() : WORDS[x]) : n(x))
export const plural = (x: number, one: string, many: string) => (x === 1 ? one : many)

/** A deadline within the hour (or past): the one red in the panel. */
export const isNow = (r: WorkRow, now: string) => !!r.decideBy && minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES

/** Room-clock day difference: 0 today, 1 tomorrow (Helsinki, as `when` reads it). */
export function dayOf(iso: string, now: string): number {
  const w = when(iso, now)
  if (/^Tomorrow/.test(w)) return 1
  if (/^\d/.test(w)) return 0
  return /^Yesterday/.test(w) ? -1 : 2
}

/** Links that keep the lab's params (?v=, ?many=), so a click stays in the lab. */
export function useKeep() {
  const sp = useSearchParams()
  return (path: string) => `${path}${keepQuery(sp)}`
}

/** The most urgent case's situation and question, read from the case itself (real data). */
export type Brief = { headline: string; question: string; answer: string }
export function useCaseBrief(caseId: string | undefined): Brief | null {
  const [brief, setBrief] = useState<Brief | null>(null)
  useEffect(() => {
    setBrief(null)
    if (!caseId || !caseId.startsWith("case-")) return
    let gone = false
    fetch(`/api/cr/cases/${encodeURIComponent(caseId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { case?: { headline?: string; suggestion?: Option } } | null) => {
        const k = d?.case
        if (gone || !k?.headline) return
        setBrief({ headline: k.headline, question: k.suggestion ? questionFor(k.suggestion) : "", answer: k.suggestion ? answerFor(k.suggestion) : "" })
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [caseId])
  return brief
}

/** The agent's own cases right now (Your tasks' Agent working), each with its one-line situation. */
export type AgentItem = WorkRow & { headline: string }
export function useAgentFeed(limit = 6): AgentItem[] {
  const [items, setItems] = useState<AgentItem[]>([])
  useEffect(() => {
    let gone = false
    const person = /(?:^|;\s*)cr-person=([^;]+)/.exec(document.cookie)?.[1] ?? "aino"
    ;(async () => {
      try {
        const work = await (await fetch(`/api/cr/work?person=${encodeURIComponent(person)}`)).json()
        const rows: WorkRow[] = (work?.agentWorking ?? []).slice(0, limit)
        const withHeads = await Promise.all(
          rows.map(async (r) => {
            const d = await (await fetch(`/api/cr/cases/${encodeURIComponent(r.caseId)}`)).json().catch(() => null)
            return { ...r, headline: (d?.case?.headline as string) ?? "" }
          }),
        )
        if (!gone) setItems(withHeads.filter((x) => x.headline))
      } catch {
        // the panel stands without it
      }
    })()
    return () => {
      gone = true
    }
  }, [limit])
  return items
}

/** The room's clock, moving: starts at the server's `now` and advances with real time. */
export function useRoomClock(now: string, everyMs = 1000): number {
  const start = useRef<{ room: number; real: number } | null>(null)
  const [t, setT] = useState(() => Date.parse(now))
  useEffect(() => {
    start.current = { room: Date.parse(now), real: Date.now() }
    setT(Date.parse(now))
    const id = window.setInterval(() => {
      const s = start.current!
      setT(s.room + (Date.now() - s.real))
    }, everyMs)
    return () => window.clearInterval(id)
  }, [now, everyMs])
  return t
}

/** True once, after mount, when the person has not asked for reduced motion. */
export function useMotionOk(): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => setOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), [])
  return ok
}

/**
 * A hairline from a row to its red pin on the map. `target()` is read every frame: the row, the
 * panel edge the line leaves from, and the pin's order id (`.pin[data-order]`, car-map.tsx).
 * Drawn in an overlay over the whole Overview, so it follows the map as it moves.
 */
export type TetherTarget = { row: HTMLElement | null; edge?: HTMLElement | null; orderId: string | null; strong?: boolean }
export function Tether({ target }: { target: () => TetherTarget }) {
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const start = useRef<SVGCircleElement>(null)
  const get = useRef(target)
  get.current = target
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = svg.current
      const p = path.current
      const c = ring.current
      const o = start.current
      if (!s || !p || !c || !o) return
      const { row, edge, orderId, strong } = get.current()
      const pin = orderId ? (document.querySelector(`.pin[data-order="${CSS.escape(orderId)}"]`) as HTMLElement | null) : null
      if (!row || !pin) {
        s.style.opacity = "0"
        return
      }
      const box = s.getBoundingClientRect()
      const a = row.getBoundingClientRect()
      const e = edge?.getBoundingClientRect()
      const b = pin.getBoundingClientRect()
      const x1 = (e ? e.right : a.right) - box.left
      const y1 = a.top + a.height / 2 - box.top
      const x2 = b.left + b.width / 2 - box.left
      const y2 = b.top + b.height / 2 - box.top
      // Hidden when the pin is off the map or behind the panel.
      if (x2 < x1 + 32 || y2 < 0 || y2 > box.height) {
        s.style.opacity = "0"
        return
      }
      const mx = x1 + Math.max(32, (x2 - x1) * 0.5)
      p.setAttribute("d", `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`)
      c.setAttribute("cx", String(x2))
      c.setAttribute("cy", String(y2))
      o.setAttribute("cx", String(x1))
      o.setAttribute("cy", String(y1))
      s.classList.toggle("strong", !!strong)
      s.style.opacity = "1"
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <svg ref={svg} className="lab-welcome lw-tether" aria-hidden="true">
      <path ref={path} />
      <circle ref={ring} className="ring" r="13" />
      <circle ref={start} className="start" r="3" />
    </svg>
  )
}

/** One element, two refs: the Overview's panelRef (the map keeps its cars beside it) and our own. */
export function useBoth<T>(outer: React.Ref<T> | undefined, own: React.MutableRefObject<T | null>) {
  return useCallback(
    (el: T | null) => {
      own.current = el
      if (typeof outer === "function") outer(el)
      else if (outer) (outer as React.MutableRefObject<T | null>).current = el
    },
    [outer, own],
  )
}

/**
 * How many rows fit: starts at `max`, drops one at a time while the box overflows its own
 * max-height, and starts over when the Overview changes size or the fonts arrive. The box must
 * have a max-height and overflow: hidden. So 3, 12 or 40 tasks never run off the frame.
 */
export function useFit(box: React.MutableRefObject<HTMLElement | null>, max: number, floor = 1): number {
  const [limit, setLimit] = useState(max)
  useLayoutEffect(() => setLimit(max), [max])
  useLayoutEffect(() => {
    const el = box.current
    if (!el || limit <= floor) return
    // The Safari engine leaves the bottom padding out of scrollHeight, so content could eat it unseen:
    // also measure the last in-flow child's bottom plus the padding.
    const kids = [...el.children].filter((k) => getComputedStyle(k).position !== "absolute") as HTMLElement[]
    const last = kids[kids.length - 1]
    const bottom = last ? last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(el).paddingBottom) || 0) : 0
    if (el.scrollHeight > el.clientHeight + 1 || bottom > el.clientHeight + 1) setLimit((l) => l - 1)
  })
  useEffect(() => {
    const room = box.current?.parentElement
    if (!room) return
    let w = room.offsetWidth
    let h = room.offsetHeight
    const ro = new ResizeObserver(() => {
      if (room.offsetWidth === w && room.offsetHeight === h) return
      w = room.offsetWidth
      h = room.offsetHeight
      setLimit(max)
    })
    ro.observe(room)
    // Measure again once the display face has loaded: a fallback font's taller lines must not leave rows cut.
    const again = () => setLimit(max)
    document.fonts?.ready.then(again).catch(() => {})
    document.fonts?.addEventListener?.("loadingdone", again)
    return () => (ro.disconnect(), document.fonts?.removeEventListener?.("loadingdone", again))
  }, [box, max])
  return Math.min(limit, max)
}

/** Hover or focus on a row lifts its pin on the map (the Overview's `lift`). */
export const liftOn = (orderId: string, setLift: (id: string | null) => void) => ({
  onMouseEnter: () => setLift(orderId),
  onMouseLeave: () => setLift(null),
  onFocus: () => setLift(orderId),
  onBlur: () => setLift(null),
})

/** The map's key: a dot, a word, a count. */
export function Key({ counts, className = "" }: { counts: { onPlan: number; agentWorking: number; needsPerson: number }; className?: string }) {
  return (
    <div className={`lw-key ${className}`} aria-label="The map's colours">
      <p className="lw-state"><span className="dot dot-green" /><span>On plan</span><span className="lw-n">{n(counts.onPlan)}</span></p>
      <p className="lw-state"><span className="dot dot-agent" /><span>Agent working</span><span className="lw-n">{n(counts.agentWorking)}</span></p>
      <p className="lw-state"><span className="dot dot-red" /><span>Needs a person</span><span className="lw-n">{n(counts.needsPerson)}</span></p>
    </div>
  )
}
