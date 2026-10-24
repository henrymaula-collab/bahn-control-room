"use client"

import Link from "next/link"
import { useState } from "react"
import type { Overview } from "@/lib/control-room/types-v3"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/** The map edge to edge, and one small panel whose words explain the colours. */
export function OverviewView({ data, red, look }: { data: Overview; red: Record<string, RedInfo>; look: MapLook }) {
  const [lift, setLift] = useState<string | null>(null)
  const { counts } = data
  const onPlan = counts.carsToday - counts.needsPerson - counts.agentWorking

  return (
    <div className="overview">
      <CarMap
        cars={data.cars}
        red={red}
        lift={lift}
        look={look}
        padLeft={300 + 16 + 56}
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
          {data.needYou.length > 0 ? (
            <>
              <Link href="/work" className="need-head m">
                {data.needYou.length} need{data.needYou.length === 1 ? "s" : ""} you
                <Icon name="chevron-right" size={18} />
              </Link>
              <ul className="red-rows">
                {data.needYou.map((r) => {
                  const info = red[r.orderId]
                  return (
                    <li key={r.caseId}>
                      <Link
                        href={`/work/${r.caseId}`}
                        className={`red-row${lift === r.orderId ? " lift" : ""}`}
                        onMouseEnter={() => setLift(r.orderId)}
                        onMouseLeave={() => setLift(null)}
                        onFocus={() => setLift(r.orderId)}
                        onBlur={() => setLift(null)}
                      >
                        <span className="v">{r.vehicle}</span>
                        <span className="p">{r.place}</span>
                        {info?.time && <time className={info.now ? "now" : undefined}>{info.time}</time>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="none m">Nothing needs you</p>
          )}
        </div>
      </section>
    </div>
  )
}

function PinCard({ info, close }: { info?: RedInfo; close: () => void }) {
  if (!info) return null
  return (
    <div>
      <div className="head">
        <p className="m strong v">{info.vehicle}</p>
        <p className="s p">{info.caseId && !info.mine && info.owner ? `${info.place}, ${info.owner}'s case` : info.place}</p>
        {info.time && <time className={`s${info.now ? " now" : ""}`}>{info.time}</time>}
      </div>
      {info.caseId && info.question && <p className="m q">{info.question}</p>}
      <Link href={info.caseId ? `/work/${info.caseId}` : `/orders/${encodeURIComponent(info.orderId)}`} className="go m" onClick={close}>
        {info.caseId ? "Open in Work" : "Open the order"}
        <Icon name="chevron-right" size={18} />
      </Link>
    </div>
  )
}
