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
import { useLab, useLabPart } from "../_lab/context"
import { useOtherTasks, usePanel } from "./work-frame"

/**
 * Under the decision: "Talk it through ›" opens the conversation with the agent as the side
 * panel, in place of The situation, which is there by default (Henry, 24 Oct 20:40: the card
 * opens with the situation beside it); "Why it came to you ›" opens in place.
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
  const { open, setOpen, reset, slot } = usePanel()
  const talk = useRef<HTMLButtonElement>(null)
  const { thread, missing } = useChatThread(caseId, personId)
  const hasSituation = !!situation
  const List = useLabPart("rows", "Rows", CaseRowsList)
  const Situation = useLabPart("situation", "SituationPanel", SituationPanel)
  const Chat = useLabPart("chat", "ChatPanel", ChatPanel)

  // Each case opens on its situation; a case without one has no panel.
  useEffect(() => reset(hasSituation ? "situation" : null), [caseId, hasSituation, reset])

  return (
    <>
      <List
        thread={thread}
        missing={missing}
        why={why}
        whyTitle={whyTitle}
        chatOpen={open === "chat"}
        onTalk={() => setOpen(open === "chat" ? null : "chat")}
        talkRef={talk}
      />
      {situation && slot && createPortal(<Situation situation={situation} open={open === "situation"} now={now} />, slot)}
      {!missing &&
        slot &&
        createPortal(
          <Chat key={caseId} thread={thread} personId={personId} open={open === "chat"} now={now} onClose={() => (setOpen(null), talk.current?.focus())} />,
          slot,
        )}
    </>
  )
}

/** Props of the rows under the card (slot `rows`, part `Rows`). */
export type CaseRowsListProps = {
  thread: ChatThread | null // null while it loads
  missing: boolean // no conversation for this case: no "Talk it through"
  why: KeyFact[]
  whyTitle?: string // "Why it came to you"; undefined when nobody is asked
  chatOpen: boolean
  onTalk: () => void // opens or closes the conversation panel
  talkRef: React.Ref<HTMLButtonElement> // focus comes back here when the chat closes
}

/** The disclosure rows: Talk it through, Why it came to you, then the needs slot's row (Other tasks). */
export function CaseRowsList({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  return (
    <div className="rows work-rows">
      {!missing && (
        <button ref={talkRef} type="button" className="row-link" aria-expanded={chatOpen} aria-controls="chat" onClick={onTalk}>
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
        <details className="row" open={lab.why || undefined}>
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
      <NeedsRow />
    </div>
  )
}

/** The needs slot's row under the card (today: Other tasks). Rows variants render it where it belongs. */
export function NeedsRow() {
  const Row = useLabPart("needs", "Row", OtherTasks)
  return <Row />
}

/** "Other tasks  2 ›": the person's other Needs-you cases, opened in place like Why it came to you:
 *  the car, the place under it in grey, the decide-by time on the right (red within the hour). */
export function OtherTasks() {
  const { rows, times, href, show } = useOtherTasks()
  const lab = useLab()
  if (!show || rows.length === 0) return null
  return (
    <details className="row others" open={lab.others || undefined}>
      <summary>
        <span className="m title">Other tasks</span>
        <span className="m count num">{rows.length}</span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </summary>
      <div className="body">
        <ul className="rows-list">
          {rows.map((r) => {
            const t = times[r.caseId]
            return (
              <li key={r.caseId}>
                <Link href={href(r.caseId)} className="wrow">
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}

/** What "Talk it through ›" opens: the agent's opener is already there, the field at the bottom. */
export function ChatPanel({
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
export function Facts({ facts }: { facts: KeyFact[] }) {
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
export function SituationPanel({ situation: s, open, now }: { situation: Situation; open: boolean; now: string }) {
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
