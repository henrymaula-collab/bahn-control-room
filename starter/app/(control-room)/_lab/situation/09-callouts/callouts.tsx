"use client"

import "./callouts.css"
import { useMemo } from "react"
import { blockerOf, endTime, ends, Kv, LabMap, OrderLink, Panel, restFacts, type SituationProps } from "../shared/kit"

/** situation 09: the places are named on the map itself, beside their pins, with their times, so
 *  the map and the stop list are one thing. Ends too close for two pins share one. The map can be
 *  dragged and zoomed with its buttons. */
export function CalloutsSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const facts = restFacts(s, ["Pickup", "Delivery"])
  const labels = useMemo(
    () => ({ a: [a.name, endTime(s, a, false)] as [string, string], b: [b.name, endTime(s, b, false)] as [string, string] }),
    [a.name, b.name, s, a, b],
  )
  return (
    <Panel nn="09" open={open}>
      <h2 className="s-car">{s.vehicle}</h2>
      <p className="s-ref">{s.reference}</p>
      {open && (
        <LabMap
          from={s.pickup.position}
          to={s.delivery.position}
          labels={labels}
          cluster
          maxZoom={15}
          interactive
          className="p9-map"
        />
      )}
      <Kv facts={facts} strong={blocker?.label} className="s-kv p9-kv" />
      <OrderLink s={s} className="s-order p9-order" />
    </Panel>
  )
}
