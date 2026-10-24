"use client"

import Link from "next/link"
import { useLayoutEffect, useRef, useState } from "react"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import type { Overview, WorkRow } from "@/lib/control-room/types-v3"
import { useLabPart } from "../_lab/context"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"
import { TasksTodayCta } from "./tasks-today-cta"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/** The map edge to edge and one panel for the person: a welcome, their tasks, the colours in words. */
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
  // The key follows the dots on the map.
  const needsPerson = data.cars.filter((c) => c.state === "needs_person").length
  const agentWorking = data.cars.filter((c) => c.state === "agent_working").length
  const onPlan = data.cars.length - needsPerson - agentWorking
  const tasks = data.needYou
  const MapView = useLabPart("map", "CarMap", CarMap)
  const Pin = useLabPart("map", "PinCard", PinCard)
  const Panel = useLabPart("welcome", "WelcomePanel", WelcomePanel)

  return (
    <div className={`overview overview-${look}`}>
      <MapView
        cars={data.cars}
        red={red}
        lift={lift}
        look={look}
        pad={{ top: 56, bottom: 56, left: padLeft, right: 48 }}
        minZoom={3.3} // Northern Europe, never half the globe when the panel leaves little room
        padPhone={{ top: 440, bottom: 24, left: 24, right: 24 }}
        card={(orderId: string, close: () => void) => <Pin info={red[orderId]} close={close} />}
      />
      <Panel
        panelRef={panel}
        firstName={firstName}
        tasks={tasks}
        now={data.now}
        counts={{ onPlan, agentWorking, needsPerson }}
        lift={lift}
        setLift={setLift}
      />
    </div>
  )
}

/** Props of the welcome panel (slot `welcome`, part `WelcomePanel`). */
export type WelcomePanelProps = {
  panelRef: React.Ref<HTMLElement> // the map keeps its cars beside this box: put it on the panel's outer element
  firstName: string
  tasks: WorkRow[] // the person's Needs you (?many= pads it)
  now: string // the room's clock, ISO
  counts: { onPlan: number; agentWorking: number; needsPerson: number } // the key follows the dots on the map
  lift: string | null // an order id hovered here lifts its pin on the map
  setLift: (orderId: string | null) => void
}

/** A welcome, the person's tasks, the colours in words. */
export function WelcomePanel({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const { onPlan, agentWorking, needsPerson } = counts
  return (
      <section ref={panelRef} className="float float-me" aria-label="Today">
        <h1 className="welcome">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

        <div className="me-tasks">
          <TasksTodayCta
            count={tasks.length}
            href="/tasks"
            size="m"
            label={tasks.length ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} for you to get started` : undefined}
          />
          {tasks.length > 0 && (
            <ul className="red-rows">
              {tasks.map((r) => {
                const due = r.decideBy ? minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES : false
                return (
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
                      {r.decideBy && <time className={due ? "now" : undefined}>{when(r.decideBy, now)}</time>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="states key" aria-label="The map's colours">
          <p className="state">
            <span className="dot dot-green" />
            <span>On plan</span>
            <span className="n num">{n(onPlan)}</span>
          </p>
          <p className="state">
            <span className="dot dot-agent" />
            <span>Agent working</span>
            <span className="n num">{n(agentWorking)}</span>
          </p>
          <p className="state">
            <span className="dot dot-red" />
            <span>Needs a person</span>
            <span className="n num">{n(needsPerson)}</span>
          </p>
        </div>
      </section>
  )
}

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
