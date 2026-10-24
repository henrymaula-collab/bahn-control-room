"use client"

// Map slot kit: the red pin's card (part `PinCard`, props { info, close } as today's). Two kinds;
// each variant's CSS dresses them (the card renders inside the variant's map box or dock).

import Link from "next/link"
import type { RedInfo } from "../../../_ui/car-map"
import { Icon } from "../../../_ui/icons"

const hrefOf = (info: RedInfo) => (info.caseId ? `/tasks/${info.caseId}` : `/orders/${encodeURIComponent(info.orderId)}`)
const placeOf = (info: RedInfo) => (info.caseId && !info.mine && info.owner ? `${info.place}, ${info.owner}'s case` : info.place)

/** The question first, as the case will ask it, and one black button to the case. */
export function CardAsk({ info, close }: { info?: RedInfo; close: () => void }) {
  if (!info) return null
  return (
    <div className="lk-c lk-c-ask">
      <div className="lk-c-head">
        <p className="lk-c-v">{info.vehicle}</p>
        {info.time && <time className={`lk-c-t num${info.now ? " now" : ""}`}>{info.time}</time>}
        <p className="lk-c-p">{placeOf(info)}</p>
      </div>
      <p className="lk-c-q">{info.caseId && info.question ? info.question : info.reason}</p>
      <Link href={hrefOf(info)} className={`lk-c-go${info.caseId ? "" : " quiet"}`} onClick={close}>
        <span>{info.caseId ? "Open the case" : "Open the order"}</span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </div>
  )
}

/** What stopped, the way Flighty states a change ("Delayed 45m"), then the car, the time, the button. */
export function CardWhy({ info, close }: { info?: RedInfo; close: () => void }) {
  if (!info) return null
  return (
    <div className="lk-c lk-c-why">
      <p className="lk-c-r">{info.reason ?? "Needs a person"}</p>
      <p className="lk-c-p">
        {info.vehicle}, {placeOf(info)}
      </p>
      {info.time && <p className={`lk-c-due${info.now ? " now" : ""}`}>Decide by {info.time}</p>}
      <Link href={hrefOf(info)} className={`lk-c-go${info.caseId ? "" : " quiet"}`} onClick={close}>
        <span>{info.caseId ? "Open the case" : "Open the order"}</span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </div>
  )
}
