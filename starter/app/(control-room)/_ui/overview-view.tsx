"use client"

import Link from "next/link"
import { useState } from "react"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import type { Overview } from "@/lib/control-room/types-v3"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"
import { TasksTodayCta } from "./tasks-today-cta"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/** The map edge to edge and one panel for the person: a welcome, their tasks, the colours in words. */
export function OverviewView({ data, red, look, firstName }: { data: Overview; red: Record<string, RedInfo>; look: MapLook; firstName: string }) {
  const [lift, setLift] = useState<string | null>(null)
  // The key follows the dots on the map.
  const needsPerson = data.cars.filter((c) => c.state === "needs_person").length
  const agentWorking = data.cars.filter((c) => c.state === "agent_working").length
  const onPlan = data.cars.length - needsPerson - agentWorking
  const tasks = data.needYou

  return (
    <div className={`overview overview-${look}`}>
      <CarMap
        cars={data.cars}
        red={red}
        lift={lift}
        look={look}
        pad={{ top: 56, bottom: 56, left: 16 + 840 + 32, right: 48 }} // the panel is 840 px (Henry, 24 Oct)
        padPhone={{ top: 440, bottom: 24, left: 24, right: 24 }}
        card={(orderId, close) => <PinCard info={red[orderId]} close={close} />}
      />
      <section className="float float-me" aria-label="Today">
        <h1 className="welcome">Welcome back to Bahn Express, {firstName}.</h1>

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
                const due = r.decideBy ? minutesUntil(r.decideBy, data.now) <= NOW_WINDOW_MINUTES : false
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
                      {r.decideBy && <time className={due ? "now" : undefined}>{when(r.decideBy, data.now)}</time>}
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
    </div>
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
