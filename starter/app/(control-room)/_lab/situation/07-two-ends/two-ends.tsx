"use client"

import "./two-ends.css"
import { blockerOf, endTime, ends, Kv, LabMap, Mark, OrderLink, Panel, restFacts, type SituationProps } from "../shared/kit"

/** situation 07: the leg drawn as a dotted arc (a route that is not driven or booked yet), and the
 *  two ends as two cards side by side under it, pickup left, delivery right. */
export function TwoEndsSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const facts = restFacts(s, ["Pickup", "Delivery"])
  return (
    <Panel nn="07" open={open}>
      <h2 className="s-car">{s.vehicle}</h2>
      <p className="s-ref">{s.reference}</p>
      {open && <LabMap from={s.pickup.position} to={s.delivery.position} leg="arc" muted maxZoom={14} padding={{ top: 44, bottom: 44, left: 40, right: 40 }} className="p7-map" />}
      <div className="p7-ends">
        {[a, b].map((e) => (
          <div key={e.key} className="p7-end">
            <p className="p7-label">
              <Mark letter={e.letter} />
              <span className="s-grey">{e.label}</span>
            </p>
            <p className="p7-place">{e.name}</p>
            <p className="s-grey">{endTime(s, e, false)}</p>
          </div>
        ))}
      </div>
      <Kv facts={facts} strong={blocker?.label} className="s-kv p7-kv" />
      <OrderLink s={s} className="s-order p7-order" />
    </Panel>
  )
}
