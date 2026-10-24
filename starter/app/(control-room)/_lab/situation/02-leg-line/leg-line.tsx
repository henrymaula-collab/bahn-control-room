"use client"

import "./leg-line.css"
import { useEffect, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { distanceWords, endTime, ends, Kv, LabMap, Mark, OrderLink, Panel, blockerOf, restFacts, type SituationProps } from "../shared/kit"

/** situation 02: the leg as one line, Flighty style: A on the left, B on the right, the distance on
 *  the line between them, each end's place and time under it. The map waits behind one row. */
export function LegLineSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const [showMap, setShowMap] = useState(false)
  useEffect(() => setShowMap(false), [s.orderId])
  const facts = restFacts(s, ["Pickup", "Delivery"])
  return (
    <Panel nn="02" open={open}>
      <h2 className="s-car">{s.vehicle}</h2>
      <p className="s-ref">{s.reference}</p>

      <div className="p2-leg" aria-label={`From ${a.name} to ${b.name}, ${distanceWords(s)} apart`}>
        <div className="p2-track" aria-hidden="true">
          <Mark letter="A" />
          <span className="p2-line">
            <span className="p2-km">{distanceWords(s)}</span>
          </span>
          <Mark letter="B" />
        </div>
        <div className="p2-ends">
          {[a, b].map((e) => (
            <div key={e.key} className={`p2-end p2-end-${e.key}`}>
              <p className="p2-place">{e.name}</p>
              <p className="s-grey">{endTime(s, e, false)}</p>
            </div>
          ))}
        </div>
      </div>

      <Kv facts={facts} strong={blockerOf(s)?.label} className="s-kv p2-kv" />

      <button type="button" className="p2-maprow" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
        <span className="p2-maprow-icon" aria-hidden="true">
          <Icon name="map" size={18} />
        </span>
        <span className="p2-maprow-label">{showMap ? "Hide the map" : "Show on the map"}</span>
        <span className="p2-chev" aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      {open && showMap && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} className="p2-map" />}

      <OrderLink s={s} className="s-order p2-order" />
    </Panel>
  )
}
