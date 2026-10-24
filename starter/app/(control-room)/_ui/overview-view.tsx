"use client"

import Link from "next/link"
import type { Overview } from "@/lib/control-room/types-v3"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"
import { TasksTodayCta } from "./tasks-today-cta"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/** The map edge to edge, and one small panel: the colours in words, and one quiet line to Your tasks. */
export function OverviewView({ data, red, look }: { data: Overview; red: Record<string, RedInfo>; look: MapLook }) {
  const { counts } = data
  const onPlan = counts.carsToday - counts.needsPerson - counts.agentWorking

  return (
    <div className="overview">
      <CarMap
        cars={data.cars}
        red={red}
        look={look}
        pad={{ top: 48, bottom: 48, left: 300 + 16 + 56, right: 72 }}
        padPhone={{ top: 380, bottom: 24, left: 24, right: 24 }}
        card={(orderId, close) => <PinCard info={red[orderId]} close={close} />}
      />
      <section className="float" aria-label="Today">
        <h1 className="m total">{n(counts.carsToday)} cars today</h1>
        <div className="states">
          <p className="state">
            <span className="dot dot-green" />
            <span>On plan</span>
            <span className="n num">{n(onPlan)}</span>
          </p>
          <p className="state">
            <span className="dot dot-agent" />
            <span>Agent working</span>
            <span className="n num">{n(counts.agentWorking)}</span>
          </p>
          <p className="state">
            <span className="dot dot-red" />
            <span>Needs a person</span>
            <span className="n num">{n(counts.needsPerson)}</span>
          </p>
        </div>

        <div className="need">
          <TasksTodayCta count={data.needYou.length} href="/tasks" />
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
