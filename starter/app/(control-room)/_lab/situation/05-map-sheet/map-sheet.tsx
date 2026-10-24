"use client"

import "./map-sheet.css"
import { useEffect, useState } from "react"
import { blockerOf, blockerWords, endTime, ends, Kv, LabMap, Mark, OrderLink, Panel, restFacts, type SituationProps } from "../shared/kit"

/** situation 05: the panel is the map, and the facts ride on a sheet at its foot, as Find My and
 *  Apple Maps do. The grabber folds the sheet to one line when the map is what you want. */
export function MapSheetSituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const [small, setSmall] = useState(false)
  useEffect(() => setSmall(false), [s.orderId])
  const facts = restFacts(s, ["Pickup", "Delivery"])
  return (
    <Panel nn="05" open={open} className={small ? "is-small" : ""}>
      {open && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={{ top: 40, bottom: 52, left: 44, right: 44 }} attribution="top-right" className="p5-map" />}
      <section className="p5-sheet" aria-label="The order">
        <button type="button" className="p5-grab" aria-expanded={!small} aria-label={small ? "Show the details" : "Show more of the map"} onClick={() => setSmall((v) => !v)}>
          <span aria-hidden="true" />
        </button>
        <div className="p5-title">
          <h2 className="s-car">{s.vehicle}</h2>
          <span className="s-ref">{s.reference}</span>
        </div>
        {small ? (
          blocker && <p className="p5-one s-grey">{blockerWords(blocker)}</p>
        ) : (
          <>
            <ul className="p5-ends">
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
            <Kv facts={facts} strong={blocker?.label} className="s-kv p5-kv" />
            <OrderLink s={s} className="s-order p5-order" icon />
          </>
        )}
      </section>
    </Panel>
  )
}
