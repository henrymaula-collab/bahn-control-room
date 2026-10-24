"use client"

import "./stays.css"
import { useEffect, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { usePanel } from "../../../_ui/work-frame"
import { blockerOf, blockerWords, distanceWords, endTime, ends, Kv, LabMap, Mark, OrderLink, Panel, restFacts, type SituationProps } from "../shared/kit"

/** situation 08: the situation never leaves. Open, it is a calm summary: the map, the leg as one row
 *  that opens its two stops, the facts. When "Talk it through" or the email takes the panel, it
 *  folds into a strip on top of them (car and blocker), one click from coming back. */
export function StaysSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const panel = usePanel()
  const [stops, setStops] = useState(true)
  useEffect(() => setStops(true), [s.orderId])
  const facts = restFacts(s, ["Pickup", "Delivery"])
  const folded = !open && (panel.open === "chat" || panel.open === "email")
  const same = s.pickup.city === s.delivery.city
  return (
    <>
      <Panel nn="08" open={open}>
        <h2 className="s-car">{s.vehicle}</h2>
        <p className="s-ref">{s.reference}</p>
        {open && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={36} className="p8-map" />}
        <button type="button" className="p8-leg" aria-expanded={stops} onClick={() => setStops((v) => !v)}>
          <span className="p8-leg-text">
            {same ? `Within ${s.pickup.city}` : `${s.pickup.city} to ${s.delivery.city}`}
            <span className="s-grey">{distanceWords(s)}</span>
          </span>
          <span className="p8-chev" aria-hidden="true">
            <Icon name="chevron-down" size={18} />
          </span>
        </button>
        {stops && (
          <ul className="p8-stops">
            {[a, b].map((e) => (
              <li key={e.key}>
                <Mark letter={e.letter} />
                <div>
                  <p>{e.name}</p>
                  <p className="s-grey">{endTime(s, e)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Kv facts={facts} strong={blocker?.label} className="s-kv p8-kv" />
        <OrderLink s={s} className="s-order p8-order" />
      </Panel>
      {folded && (
        <button type="button" className="lab-situation-base lab-situation-08 s8-strip" onClick={() => panel.setOpen(null)} aria-label={`Back to the situation: ${s.vehicle}`}>
          <span className="s8-marks" aria-hidden="true">
            <Mark letter="A" />
            <Mark letter="B" />
          </span>
          <span className="s8-text">
            <span className="s8-car">{s.vehicle}</span>
            {blocker && <span className="s8-block">{blockerWords(blocker)}</span>}
          </span>
          <span className="s8-chev" aria-hidden="true">
            <Icon name="chevron-down" size={18} />
          </span>
        </button>
      )}
    </>
  )
}
