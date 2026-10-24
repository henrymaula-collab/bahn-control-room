"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { range } from "@/lib/control-room/format"
import type { KeyFact, Situation, Stop } from "@/lib/control-room/types-v3"
import { Icon } from "./icons"
import { RouteMap } from "./route-map"
import { usePanel } from "./work-frame"

/** Under the decision: "The situation ›" opens the side panel, "Why it came to you ›" opens in place. */
export function CaseRows({ situation, why, whyTitle, now }: { situation?: Situation; why: KeyFact[]; whyTitle?: string; now: string }) {
  const { open, setOpen, slot } = usePanel()
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <div className="rows work-rows">
      {situation && (
        <button
          ref={trigger}
          type="button"
          className="row-link"
          aria-expanded={open}
          aria-controls="situation"
          onClick={() => setOpen(!open)}
        >
          <span className="m title">The situation</span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      )}
      {whyTitle && why.length > 0 && (
        <details className="row">
          <summary>
            <span className="m title">{whyTitle}</span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <Facts facts={why} />
          </div>
        </details>
      )}
      {situation &&
        slot &&
        createPortal(<SituationPanel situation={situation} open={open} now={now} onClose={() => (setOpen(false), trigger.current?.focus())} />, slot)}
    </div>
  )
}

/** Label and value, label grey, value black, never a sentence. */
function Facts({ facts }: { facts: KeyFact[] }) {
  return (
    <dl className="kv m">
      {facts.map((f) => (
        <div key={f.label} style={{ display: "contents" }}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const LOCAL_TZ: Record<string, string> = { DE: "Europe/Berlin", DK: "Europe/Copenhagen", SE: "Europe/Stockholm", FR: "Europe/Paris" }

/** The window in the place's own time, as the place promised it: "Mon 26 Oct, 10:00–13:00 in Hamburg". */
function when(stop: Stop, now: string): string | undefined {
  if (!stop.window) return undefined
  const tz = LOCAL_TZ[stop.country]
  return tz ? `${range(stop.window.from, stop.window.to, now, tz)} in ${stop.city}` : range(stop.window.from, stop.window.to, now)
}

/** What "The situation ›" opens: the car, the route, both ends, who it waits on, the few facts that decide it. */
function SituationPanel({ situation: s, open, now, onClose }: { situation: Situation; open: boolean; now: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) close.current?.focus({ preventScroll: true })
  }, [open])

  const facts: KeyFact[] = [
    { label: "Driver", value: s.driver ?? "Not booked" },
    ...(s.waitingOn ? [s.waitingOn] : []),
    ...s.facts,
  ]

  return (
    <aside id="situation" className={`panel${open ? " open" : ""}`} aria-label="The situation" aria-hidden={!open}>
      <div className="panel-head">
        <div>
          <h2 className="m strong">{s.vehicle}</h2>
          <p className="s mono">{s.reference}</p>
        </div>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={onClose} tabIndex={open ? 0 : -1}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {open && <RouteMap from={s.pickup.position} to={s.delivery.position} />}
      <div className="stops">
        {[
          { stop: s.pickup, mark: "A", cls: "mark-a", label: "Pickup" },
          { stop: s.delivery, mark: "B", cls: "mark-b", label: "Delivery" },
        ].map(({ stop, mark, cls, label }) => (
          <div className="stop" key={mark}>
            <span className={`mark ${cls}`} aria-label={label}>
              {mark}
            </span>
            <div>
              <p className="m">{stop.place === "Private address" ? `Private address, ${stop.city}` : stop.place}</p>
              <p className="s">{when(stop, now) ?? "No time set yet"}</p>
            </div>
          </div>
        ))}
      </div>
      <Facts facts={facts} />
      <Link href={`/orders/${encodeURIComponent(s.orderId)}`} className="open-order m" tabIndex={open ? 0 : -1}>
        Open the order
        <Icon name="chevron-right" size={18} />
      </Link>
    </aside>
  )
}
