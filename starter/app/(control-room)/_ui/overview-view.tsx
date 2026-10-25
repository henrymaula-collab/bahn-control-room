"use client"

import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import type { Overview, WorkRow } from "@/lib/control-room/types-v3"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"
import { TasksTodayCta } from "./tasks-today-cta"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
/** "Three" for 3, "12" for 12 (Apple's style guide: spell out one to nine in prose). */
const word = (x: number) => (x < 10 ? WORDS[x] : n(x))
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many)
/** Today on the room's clock: `when` prints a bare time for today only. */
const isToday = (iso: string, now: string) => /^\d/.test(when(iso, now))
const isNow = (r: WorkRow, now: string) => !!r.decideBy && minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES

type Counts = { onPlan: number; agentWorking: number; needsPerson: number }

/** The day in one sentence after the greeting (lab welcome:01, Henry 25 Oct: "this text is good"):
 *  "Three cars need you by 13:00." / "12 cars need you, the first by 12:25." / "Nothing needs you." */
function dayFact(tasks: WorkRow[], now: string, agentWorking: number): string {
  if (!tasks.length) return agentWorking ? `Nothing needs you. The agent is working on ${n(agentWorking)} ${plural(agentWorking, "car", "cars")}.` : "Nothing needs you."
  const cars = `${word(tasks.length)} ${plural(tasks.length, "car needs", "cars need")} you`
  const allToday = tasks.every((r) => r.decideBy && isToday(r.decideBy, now))
  const last = tasks.reduce<string | undefined>((m, r) => (r.decideBy && (!m || r.decideBy > m) ? r.decideBy : m), undefined)
  if (allToday && last) return `${cars} by ${when(last, now)}.`
  const first = tasks[0].decideBy
  return `${cars}, the first by ${first ? when(first, now) : "today"}.`
}

/** The map edge to edge and one panel for the person: the day in the greeting, their tasks, the cars in one bar. */
export function OverviewView({ data, red, look, firstName }: { data: Overview; red: Record<string, RedInfo>; look: MapLook; firstName: string }) {
  const [lift, setLift] = useState<string | null>(null)
  // The panel narrows with the page; the map keeps its cars beside it, never under it.
  const panel = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ panel: 840, room: 1200 })
  useLayoutEffect(() => {
    const el = panel.current
    const room = el?.parentElement
    if (!el || !room) return
    const measure = () => setSize({ panel: el.offsetWidth, room: room.offsetWidth })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(room)
    measure()
    return () => ro.disconnect()
  }, [])
  // Beside the panel when there is room; never less than 300 px for the cars (then the
  // panel's right edge overlaps the west of the frame a little).
  const padLeft = Math.max(16, Math.min(16 + size.panel + 32, size.room - 48 - 300))
  // The bar follows the dots on the map.
  const needsPerson = data.cars.filter((c) => c.state === "needs_person").length
  const agentWorking = data.cars.filter((c) => c.state === "agent_working").length
  const counts: Counts = { onPlan: data.cars.length - needsPerson - agentWorking, agentWorking, needsPerson }
  const tasks = data.needYou
  const first = tasks[0]
  // As many rows as fit in the frame; the rest is one row (3, 12 or 40 tasks never run off the page).
  const fit = useFit(panel, Math.min(tasks.length, 6))
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length

  return (
    <div className={`overview overview-${look}`}>
      <CarMap
        cars={data.cars}
        red={red}
        lift={lift}
        look={look}
        pad={{ top: 56, bottom: 56, left: padLeft, right: 48 }}
        minZoom={3.3} // Northern Europe, never half the globe when the panel leaves little room
        padPhone={{ top: 440, bottom: 24, left: 24, right: 24 }}
        dock
        card={(orderId, close) => <DockCard info={red[orderId]} close={close} />}
      />
      <section ref={panel} className="float float-me" aria-label="Today">
        <h1 className="welcome">
          {/* The name in Archivo's true italic, same weight and colour (Henry 25 Oct: "it could slant, so the text gets a bit of contrast"). */}
          Welcome back, <em>{firstName}</em>. <span className="fact">{dayFact(tasks, data.now, agentWorking)}</span>
        </h1>

        {first && (
          <div className="me-tasks">
            <TasksTodayCta count={tasks.length} href={`/tasks/${first.caseId}`} size="m" label={`Start with the ${first.vehicle}`} />
            <ul className="red-rows">
              {shown.map((r) => (
                <li key={r.caseId}>
                  <Link
                    href={`/tasks/${r.caseId}`}
                    className={`red-row${lift === r.orderId ? " lift" : ""}`}
                    onMouseEnter={() => setLift(r.orderId)}
                    onMouseLeave={() => setLift(null)}
                    onFocus={() => setLift(r.orderId)}
                    onBlur={() => setLift(null)}
                  >
                    <span className="v">{r.vehicle}</span>
                    <span className="p">{r.place}</span>
                    {r.decideBy && <time className={isNow(r, data.now) ? "now" : undefined}>{when(r.decideBy, data.now)}</time>}
                  </Link>
                </li>
              ))}
              {rest > 0 && (
                <li>
                  <Link href="/tasks" className="red-row more">
                    <span>{n(rest)} more in Your tasks</span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        <FleetBar counts={counts} mine={tasks.length} />
      </section>
    </div>
  )
}

type Part = "plan" | "agent" | "red"

/** The map's key as one bar (lab welcome:09, Apple's iPhone Storage bar): every car on the road
 *  today, the three colours in proportion, a dot legend under it. Hover a part: the rest step back. */
function FleetBar({ counts, mine }: { counts: Counts; mine: number }) {
  const [hot, setHot] = useState<Part | null>(null)
  const total = counts.onPlan + counts.agentWorking + counts.needsPerson
  const parts: { id: Part; label: string; value: number; dot: string }[] = [
    { id: "plan", label: "On plan", value: counts.onPlan, dot: "dot-green" },
    { id: "agent", label: "Agent working", value: counts.agentWorking, dot: "dot-agent" },
    { id: "red", label: "Needs a person", value: counts.needsPerson, dot: "dot-red" },
  ]
  return (
    <div className={`fleet${hot ? ` hot-${hot}` : ""}`} aria-label="The map's colours">
      <p className="fleet-head">
        <span>On the road today</span>
        <span className="fleet-total num">
          {hot === "red" && mine > 0 ? `${n(counts.needsPerson)} need a person, ${n(Math.min(mine, counts.needsPerson))} of them yours` : `${n(total)} ${plural(total, "car", "cars")}`}
        </span>
      </p>
      <div className="fleet-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.map((p) =>
          p.value > 0 ? (
            <span key={p.id} className={`seg seg-${p.id}`} style={{ flexGrow: p.value }} onMouseEnter={() => setHot(p.id)} onMouseLeave={() => setHot(null)} />
          ) : null,
        )}
      </div>
      <div className="fleet-legend">
        {parts.map((p) => (
          <p key={p.id} className="litem" onMouseEnter={() => setHot(p.id)} onMouseLeave={() => setHot(null)}>
            <span className={`dot ${p.dot}`} />
            <span>{p.label}</span>
            <span className="n num">{n(p.value)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * How many rows fit: starts at `max`, drops one at a time while the panel overflows its own
 * max-height, and starts over when the Overview changes size or the fonts arrive (lab welcome:01).
 */
function useFit(box: React.RefObject<HTMLElement | null>, max: number, floor = 1): number {
  const [limit, setLimit] = useState(max)
  useLayoutEffect(() => setLimit(max), [max])
  useLayoutEffect(() => {
    const el = box.current
    if (!el || limit <= floor) return
    // WebKit leaves the bottom padding out of scrollHeight: also measure the last child's bottom plus the padding.
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
    // Again once the display face has loaded: a fallback font's taller lines must not leave rows cut.
    const again = () => setLimit(max)
    document.fonts?.ready.then(again).catch(() => {})
    document.fonts?.addEventListener?.("loadingdone", again)
    return () => {
      ro.disconnect()
      document.fonts?.removeEventListener?.("loadingdone", again)
    }
  }, [box, max])
  return Math.min(limit, max)
}

/** The docked card (lab map:08, combination B): what stopped first, the way Flighty states a
 *  change, then the car and place, the decide-by time, one black button. The close button is the map's. */
export function DockCard({ info, close }: { info?: RedInfo; close: () => void }) {
  if (!info) return null
  const place = info.caseId && !info.mine && info.owner ? `${info.place}, ${info.owner}'s case` : info.place
  return (
    <div className="dock-card">
      <p className="dc-r">{info.reason ?? "Needs a person"}</p>
      <p className="dc-p">
        {info.vehicle}, {place}
      </p>
      {info.time && <p className={`dc-due${info.now ? " now" : ""}`}>Decide by {info.time}</p>}
      <Link href={info.caseId ? `/tasks/${info.caseId}` : `/orders/${encodeURIComponent(info.orderId)}`} className={`dc-go${info.caseId ? "" : " quiet"}`} onClick={close}>
        <span>{info.caseId ? "Open the case" : "Open the order"}</span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </div>
  )
}

/** The popup card the website looks (?look=a|b|c) still use at the pin. */
export function PinCard({ info, close }: { info?: RedInfo; close: () => void }) {
  if (!info) return null
  return (
    <div>
      <div className="head">
        <p className="m strong v">{info.vehicle}</p>
        <p className="s p">{info.caseId && !info.mine && info.owner ? `${info.place}, ${info.owner}'s case` : info.place}</p>
        {info.time && <time className={`s${info.now ? " now" : ""}`}>{info.time}</time>}
      </div>
      {info.caseId && info.question ? <p className="m q">{info.question}</p> : info.reason && <p className="m q">{info.reason}</p>}
      <Link href={info.caseId ? `/tasks/${info.caseId}` : `/orders/${encodeURIComponent(info.orderId)}`} className="go m" onClick={close}>
        {info.caseId ? "Open the case" : "Open the order"}
        <Icon name="chevron-right" size={18} />
      </Link>
    </div>
  )
}
