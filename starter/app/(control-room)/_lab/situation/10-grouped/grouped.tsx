"use client"

import "./grouped.css"
import { blockerOf, endTime, ends, LabMap, Mark, OrderLink, Panel, restFacts, type SituationProps } from "../shared/kit"

/** situation 10: Apple's inset grouped lists on the frame's grey: the route group (map, then A and
 *  B), the facts group with values on the right as in Settings, and the order as a group of its own. */
export function GroupedSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const facts = restFacts(s, ["Pickup", "Delivery"])
  return (
    <Panel nn="10" open={open}>
      <div className="p10-head">
        <h2 className="s-car">{s.vehicle}</h2>
        <p className="s-ref">{s.reference}</p>
      </div>

      <section className="p10-group" aria-label="Route">
        {open && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={32} className="p10-map" />}
        <ul className="p10-rows">
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
      </section>

      <section className="p10-group" aria-label="Facts">
        <dl className="p10-kv">
          {facts.map((f) => (
            <div key={f.label} className={f.label === blocker?.label ? "is-block" : undefined}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="p10-group p10-link">
        <OrderLink s={s} className="s-order p10-order" icon />
      </section>
    </Panel>
  )
}
