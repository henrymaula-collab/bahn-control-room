"use client"

import "./inspector.css"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { blockerOf, distanceWords, endTime, ends, factsOf, LabMap, Mark, orderHref, Panel, type SituationProps } from "../shared/kit"

/** situation 06: an inspector for someone who has seen a hundred of these: everything on one screen
 *  in tight rows, times aligned on the right, the blocker in 600, the reference itself opens the
 *  order, the map one icon away. */
export function InspectorSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const [map, setMap] = useState(false)
  useEffect(() => setMap(false), [s.orderId])
  // Blocker first, then who it waits for, then the leg (Pickup and Delivery are on the route rows).
  const facts = factsOf(s).filter((f) => f.label !== "Pickup" && f.label !== "Delivery")
  const ordered = blocker ? [blocker, ...facts.filter((f) => f.label !== blocker.label)] : facts
  const same = s.pickup.city === s.delivery.city
  return (
    <Panel nn="06" open={open}>
      <div className="p6-head">
        <div className="p6-id">
          <h2 className="s-car">{s.vehicle}</h2>
          <Link href={orderHref(s)} className="p6-ref" title="Open the order">
            <span className="s-ref">{s.reference}</span>
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        <button type="button" className={`p6-tool${map ? " is-on" : ""}`} aria-pressed={map} aria-label={map ? "Hide the map" : "Show the map"} title={map ? "Hide the map" : "Show the map"} onClick={() => setMap((v) => !v)}>
          <Icon name="map" size={18} />
        </button>
      </div>

      <h3 className="p6-sec">Route</h3>
      {open && map && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={32} className="p6-map" />}
      <ul className="p6-rows">
        {[a, b].map((e) => (
          <li key={e.key}>
            <Mark letter={e.letter} />
            <span className="p6-place">{e.name}</span>
            <span className="p6-time">{endTime(s, e, false)}</span>
          </li>
        ))}
        <li className="p6-dist">
          <span aria-hidden="true" />
          <span className="p6-place s-grey">{same ? `Both in ${s.pickup.city}` : `${s.pickup.city} to ${s.delivery.city}`}</span>
          <span className="p6-time">{distanceWords(s)}</span>
        </li>
      </ul>

      <h3 className="p6-sec">Order</h3>
      <dl className="p6-kv">
        {ordered.map((f) => (
          <div key={f.label} className={f.label === blocker?.label ? "is-block" : undefined}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
