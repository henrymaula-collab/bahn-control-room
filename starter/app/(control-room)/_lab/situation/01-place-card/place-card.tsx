"use client"

import "./place-card.css"
import { blockerOf, distanceWords, endTime, ends, factOf, LabMap, Mark, OrderLink, Panel, waitingWords, type SituationProps } from "../shared/kit"

/** situation 01: an Apple Maps place card. The map is the panel's top edge to edge, the car is the
 *  title, three facts sit in one strip (the blocker first), the two ends follow, the order is a row. */
export function PlaceCardSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const strip = [
    ...(blocker ? [blocker] : []),
    { label: "Driver", value: s.driver ?? factOf(s, "Driver")! }, // a name when booked: "Yara", not "Booked, Yara"
    { label: "Distance", value: distanceWords(s) },
  ]
  return (
    <Panel nn="01" open={open}>
      {open && <LabMap from={s.pickup.position} to={s.delivery.position} muted maxZoom={14} padding={{ top: 48, bottom: 36, left: 48, right: 48 }} className="p1-map" />}
      <div className="p1-body">
        <h2 className="s-car">{s.vehicle}</h2>
        <p className="p1-sub">
          <span className="s-ref">{s.reference}</span>
          {waitingWords(s) && <span className="p1-wait">{waitingWords(s)}</span>}
        </p>
        <dl className="p1-strip">
          {strip.map((f, i) => (
            <div key={f.label} className={i === 0 && blocker ? "p1-cell is-block" : "p1-cell"}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="p1-ends">
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
        <OrderLink s={s} className="s-order p1-order" icon />
      </div>
    </Panel>
  )
}
