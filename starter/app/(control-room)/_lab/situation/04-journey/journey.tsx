"use client"

import "./journey.css"
import { blockerOf, blockerWords, endTime, ends, factOf, LabMap, Mark, OrderLink, Panel, waitingWords, type SituationProps } from "../shared/kit"

/** situation 04: the order as its journey, top to bottom: pickup, driver, delivery. The step that is
 *  stuck carries the blocker and who it waits for; the steps after it are quieter. */
export function JourneySituation({ situation: s, open, now }: SituationProps) {
  const [a, b] = ends(s, now)
  const blocker = blockerOf(s)
  const driver = factOf(s, "Driver")!
  const driverBooked = /^Booked/.test(driver)
  return (
    <Panel nn="04" open={open}>
      <h2 className="s-car">{s.vehicle}</h2>
      <p className="s-ref">{s.reference}</p>
      {open && <LabMap from={s.pickup.position} to={s.delivery.position} maxZoom={14} padding={28} className="p4-map" />}

      <ol className="p4-steps">
        <li className="p4-step is-now">
          <span className="p4-rail" aria-hidden="true">
            <Mark letter="A" />
          </span>
          <div className="p4-text">
            <p>
              <span className="s-grey">Pickup at </span>
              {a.name}
            </p>
            <p className="s-grey">{endTime(s, a)}</p>
            {blocker && (
              <p className="p4-stuck">
                <span className="p4-dot" aria-hidden="true" />
                {blockerWords(blocker)}
              </p>
            )}
            {waitingWords(s) && <p className="s-grey">{waitingWords(s)}</p>}
          </div>
        </li>
        <li className={`p4-step${driverBooked ? "" : " is-later"}`}>
          <span className="p4-rail" aria-hidden="true">
            <span className={`p4-ring${driverBooked ? " is-done" : ""}`} />
          </span>
          <div className="p4-text">
            <p>Driver</p>
            <p className="s-grey">{driver}</p>
          </div>
        </li>
        <li className="p4-step is-later">
          <span className="p4-rail" aria-hidden="true">
            <Mark letter="B" />
          </span>
          <div className="p4-text">
            <p>
              <span className="s-grey">Delivery to </span>
              {b.name}
            </p>
            <p className="s-grey">{endTime(s, b)}</p>
          </div>
        </li>
      </ol>

      <OrderLink s={s} className="s-order p4-order" />
    </Panel>
  )
}
