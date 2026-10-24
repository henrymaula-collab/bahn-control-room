"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { range } from "@/lib/control-room/format"
import type { ChatThread } from "@/lib/control-room/types-chat"
import type { KeyFact, Situation, Stop } from "@/lib/control-room/types-v3"
import { CaseChat, useChatThread } from "./case-chat"
import { Icon } from "./icons"
import { RouteMap } from "./route-map"
import { usePanel } from "./work-frame"

/**
 * Under the decision: "Talk it through ›" opens the conversation with the agent and
 * "The situation ›" the facts, each as the side panel (one at a time, so the decision
 * stays in view); "Why it came to you ›" opens in place.
 */
export function CaseRows({
  caseId,
  personId,
  situation,
  why,
  whyTitle,
  now,
}: {
  caseId: string
  personId: string
  situation?: Situation
  why: KeyFact[]
  whyTitle?: string
  now: string
}) {
  const { open, setOpen, slot } = usePanel()
  const trigger = useRef<HTMLButtonElement>(null)
  const talk = useRef<HTMLButtonElement>(null)
  const { thread, missing } = useChatThread(caseId, personId)

  return (
    <div className="rows work-rows">
      {!missing && (
        <button
          ref={talk}
          type="button"
          className="row-link"
          aria-expanded={open === "chat"}
          aria-controls="chat"
          onClick={() => setOpen(open === "chat" ? null : "chat")}
        >
          <span className="row-text">
            <span className="m title">Talk it through</span>
            {/* Where this kind of case stands, so a known kind can be decided without opening. Hidden while the panel says it. */}
            <span className="s sub">{thread ? knowledgeWords(thread.knowledge) : "\u00a0"}</span>
          </span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      )}
      {situation && (
        <button
          ref={trigger}
          type="button"
          className="row-link"
          aria-expanded={open === "situation"}
          aria-controls="situation"
          onClick={() => setOpen(open === "situation" ? null : "situation")}
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
        createPortal(
          <SituationPanel situation={situation} open={open === "situation"} now={now} onClose={() => (setOpen(null), trigger.current?.focus())} />,
          slot,
        )}
      {!missing &&
        slot &&
        createPortal(
          <ChatPanel key={caseId} thread={thread} personId={personId} open={open === "chat"} now={now} onClose={() => (setOpen(null), talk.current?.focus())} />,
          slot,
        )}
    </div>
  )
}

/** What "Talk it through ›" opens: the agent's opener is already there, the field at the bottom. */
function ChatPanel({
  thread,
  personId,
  open,
  now,
  onClose,
}: {
  thread: ChatThread | null
  personId: string
  open: boolean
  now: string
  onClose: () => void
}) {
  return (
    <aside id="chat" className={`panel chat-panel${open ? " open" : ""}`} aria-label="Talk it through" aria-hidden={!open} inert={!open}>
      <div className="panel-head chat-head">
        <h2 className="m strong">Talk it through</h2>
        <button type="button" className="close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <CaseChat thread={thread} personId={personId} now={now} focus={open} />
    </aside>
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

  // Who it waits on first, then the engine's facts. Say nothing twice: a booked pickup or delivery
  // time is already under its stop above, and the engine's Driver row ("Gig posted at EUR 456") wins.
  const shown = (stop: Stop) => stop.booked && !!stop.window
  const facts: KeyFact[] = [
    ...(s.waitingOn ? [s.waitingOn] : []),
    ...s.facts.filter((f) => !(f.label === "Pickup" && shown(s.pickup)) && !(f.label === "Delivery" && shown(s.delivery))),
  ]
  if (!facts.some((f) => f.label === "Driver")) facts.push({ label: "Driver", value: s.driver ?? "Not booked" })

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
