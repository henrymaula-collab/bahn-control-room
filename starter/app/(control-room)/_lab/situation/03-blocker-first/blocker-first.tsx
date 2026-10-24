"use client"

import "./blocker-first.css"
import { blockerOf, blockerWords, endTime, ends, Kv, LabMap, Mark, OrderLink, Panel, restFacts, waitingWords, type SituationProps } from "../shared/kit"

/** situation 03: what blocks the case comes first, with the map's red dot for "needs a person",
 *  who it waits for under it; then the route, then the rest of the facts. */
export function BlockerFirstSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const facts = restFacts(s, ["Waiting", "Pickup", "Delivery", ...(blocker ? [blocker.label] : [])])
  return (
    <Panel nn="03" open={open}>
      <p className="p3-car">
        <span className="p3-name">{s.vehicle}</span>
        <span className="s-ref">{s.reference}</span>
      </p>

      {blocker && (
        <div className="p3-block">
          <span className="p3-dot" aria-hidden="true" />
          <div>
            <h2 className="p3-what">{blockerWords(blocker)}</h2>
            {waitingWords(s) && <p className="s-grey">{waitingWords(s)}</p>}
          </div>
        </div>
      )}

      {open && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={36} className="p3-map" />}

      <ul className="p3-ends">
        {[a, b].map((e) => (
          <li key={e.key}>
            <Mark letter={e.letter} />
            <span className="p3-place">{e.name}</span>
            <span className="p3-time s-grey">{endTime(s, e, false)}</span>
          </li>
        ))}
      </ul>

      <Kv facts={facts} className="s-kv p3-kv" />
      <OrderLink s={s} className="s-order p3-order" />
    </Panel>
  )
}
