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
import { SendToColleague, useColleaguePick } from "./send-to-colleague"
import { usePanel } from "./work-frame"

/**
 * Under the decision, three rows in rows:01's style, each a title and one grey line (Henry, 25 Oct,
 * h38): "Talk it through ›" opens the conversation with the agent as the side panel, in place of The
 * situation, which is there by default; "Why it came to you ›" opens in place; "Send to a colleague ›"
 * opens track N's panel, its grey line the colleague the agent picks. Moving between tasks is the dock's.
 */
export function CaseRows({
  caseId,
  personId,
  situation,
  why,
  whyTitle,
  canSend = false,
  note,
  routedWhy,
  now,
}: {
  caseId: string
  personId: string
  situation?: Situation
  why: KeyFact[]
  whyTitle?: string
  canSend?: boolean // the case waits for this person: they can send it on
  note?: { from: string; text: string } // a colleague sent it on with a line: shown once, quoted
  routedWhy?: string // the routing sentence ("Sent to you because ..."): the first line inside Why it came to you
  now: string
}) {
  const { open, setOpen, reset, slot } = usePanel()
  const talk = useRef<HTMLButtonElement>(null)
  const { thread, missing } = useChatThread(caseId, personId)
  const hasSituation = !!situation

  // Each case opens on its situation; a case without one has no panel.
  useEffect(() => reset(hasSituation ? "situation" : null), [caseId, hasSituation, reset])

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
      {whyTitle && why.length > 0 && (
        <details className="row">
          <summary>
            <span className="row-text">
              <span className="m title">{whyTitle}</span>
              {note ? <span className="s sub why-note">{`\u201c${note.text}\u201d`}</span> : <span className="s sub">{whyLine(why)}</span>}
            </span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            {routedWhy && !note && <p className="m why-routed">{routedWhy}</p>}
            <Facts facts={note ? [{ label: note.from, value: `\u201c${note.text}\u201d` }, ...why] : why} />
          </div>
        </details>
      )}
      {canSend && <ColleagueRow caseId={caseId} personId={personId} />}
      {situation && slot && createPortal(<SituationPanel situation={situation} open={open === "situation"} now={now} />, slot)}
      {!missing &&
        slot &&
        createPortal(
          <ChatPanel key={caseId} thread={thread} personId={personId} open={open === "chat"} now={now} onClose={() => (setOpen(null), talk.current?.focus())} />,
          slot,
        )}
    </div>
  )
}

/** "Seller hold on the car, needs the customer": the first fact, then the second as a phrase. */
function whyLine(why: KeyFact[]): string {
  const [a, b] = why
  if (!a) return ""
  return b ? `${a.value}, ${b.label.toLowerCase()} ${b.value.charAt(0).toLowerCase()}${b.value.slice(1)}` : a.value
}

/** "Send to a colleague ›" (Henry, 25 Oct): the agent's pick on the grey line; track N's panel opens beside the card. */
function ColleagueRow({ caseId, personId }: { caseId: string; personId: string }) {
  const { open, setOpen } = usePanel()
  const pick = useColleaguePick(caseId, personId)
  return (
    <>
      <button
        type="button"
        className="row-link"
        aria-expanded={open === "colleague"}
        aria-controls="colleague"
        onClick={() => setOpen(open === "colleague" ? null : "colleague")}
      >
        <span className="row-text">
          <span className="m title">Send to a colleague</span>
          <span className="s sub">{pick?.short ?? "\u00a0"}</span>
        </span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      <SendToColleague caseId={caseId} personId={personId} />
    </>
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

/** The situation, beside the card by default: the car, the route, both ends, who it waits on, the few facts that decide it. */
function SituationPanel({ situation: s, open, now }: { situation: Situation; open: boolean; now: string }) {
  // Who it waits on first, then the engine's facts. Say nothing twice: a booked pickup or delivery
  // time is already under its stop above, and the engine's Driver row ("Gig posted at EUR 456") wins.
  const shown = (stop: Stop) => stop.booked && !!stop.window
  const facts: KeyFact[] = [
    ...(s.waitingOn ? [s.waitingOn] : []),
    ...s.facts.filter((f) => !(f.label === "Pickup" && shown(s.pickup)) && !(f.label === "Delivery" && shown(s.delivery))),
  ]
  if (!facts.some((f) => f.label === "Driver")) facts.push({ label: "Driver", value: s.driver ?? "Not booked" })

  return (
    <aside id="situation" className={`panel situation-panel${open ? " open" : ""}`} aria-label="The situation" aria-hidden={!open} inert={!open}>
      <div className="panel-head">
        <div>
          <h2 className="m strong">{s.vehicle}</h2>
          <p className="s mono">{s.reference}</p>
        </div>
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
      <Link href={`/orders/${encodeURIComponent(s.orderId)}`} className="open-order m">
        Open the order
        <Icon name="chevron-right" size={18} />
      </Link>
    </aside>
  )
}
