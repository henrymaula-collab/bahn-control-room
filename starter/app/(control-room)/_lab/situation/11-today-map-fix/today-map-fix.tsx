"use client"

// situation 11: today's panel, untouched, with only the map fix (reviewer RV5). Not a new design: the
// proof that the fix for the Ferrari's touching A and B and the BMW's "H(A)nki" works on its own.
// The markup is today's SituationPanel (_ui/work-case.tsx); the one difference is the RouteMap import.

import Link from "next/link"
import type { KeyFact, Stop } from "@/lib/control-room/types-v3"
import { Icon } from "../../../_ui/icons"
import { Facts } from "../../../_ui/work-case"
import { when, type SituationProps } from "../shared/kit"
import { RouteMap } from "./route-map-fixed"

export function TodayMapFixSituation({ situation: s, open, now }: SituationProps) {
  const shown = (stop: Stop) => stop.booked && !!stop.window
  const facts: KeyFact[] = [
    ...(s.waitingOn ? [s.waitingOn] : []),
    ...s.facts.filter((f) => !(f.label === "Pickup" && shown(s.pickup)) && !(f.label === "Delivery" && shown(s.delivery))),
  ]
  if (!facts.some((f) => f.label === "Driver")) facts.push({ label: "Driver", value: s.driver ?? "Not booked" })

  return (
    <aside id="situation" className={`panel situation-panel lab-situation-11${open ? " open" : ""}`} aria-label="The situation" aria-hidden={!open} inert={!open}>
      <div className="panel-head">
        <div>
          <h2 className="m strong">{s.vehicle}</h2>
          <p className="s mono">{s.reference}</p>
        </div>
      </div>
      {open && <RouteMap from={s.pickup.position} to={s.delivery.position} />}
      <div className="stops">
        {[
          { stop: s.pickup, mark: "A", cls: "mark-a", label: "Pickup" },
          { stop: s.delivery, mark: "B", cls: "mark-b", label: "Delivery" },
        ].map(({ stop, mark, cls, label }) => (
          <div className="stop" key={mark}>
            <span className={`mark ${cls}`} aria-label={label}>
              {mark}
            </span>
            <div>
              <p className="m">{stop.place === "Private address" ? `Private address, ${stop.city}` : stop.place}</p>
              <p className="s">{when(stop, now) ?? "No time set yet"}</p>
            </div>
          </div>
        ))}
      </div>
      <Facts facts={facts} />
      <Link href={`/orders/${encodeURIComponent(s.orderId)}`} className="open-order m">
        Open the order
        <Icon name="chevron-right" size={18} />
      </Link>
    </aside>
  )
}
