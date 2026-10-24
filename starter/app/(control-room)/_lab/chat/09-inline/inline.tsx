"use client"

// chat 09: Under the suggestion. "Talk it through" opens in place, like "Why it came to you": the
// conversation unfolds right under its row inside the card, and the situation stays beside it. The
// v4 test rejected inline because answers landed below the fold and took the decision away; here the
// conversation is one box of fixed height with its own scroll and the field at its foot, only the
// latest question and answer are shown (earlier ones fold), and the card above never moves.
// Lab mount: the frame opens the chat panel; this variant hands the panel back to the situation and
// renders itself into the card (a portal after the Talk it through row). Adopting it for real means
// the frame keeps the situation open while the chat is inline (see RATIONALE.md).

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { usePanel } from "../../../_ui/work-frame"
import { runningWords, shortOpener, stepSentence, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, Paras } from "../parts"
import "./inline.css"
import "../base.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

export function InlineChat({ thread, personId, open, onClose }: Props) {
  const { setOpen } = usePanel()
  const [inline, setInline] = useState(false)
  const openedAt = useRef(0)
  const [host, setHost] = useState<HTMLElement | null>(null)

  // The frame says "chat": open (or, on a second tap of the row, close) in place, and give the panel back.
  useEffect(() => {
    if (!open) return
    const now = performance.now()
    if (inline && now - openedAt.current > 400) setInline(false)
    else if (!inline) {
      setInline(true)
      openedAt.current = now
    }
    setOpen(null)
  }, [open, inline, setOpen])

  // The box lives in the card, right after the Talk it through row.
  useLayoutEffect(() => {
    if (!inline) return
    const row = document.querySelector<HTMLElement>('.work .detail [aria-controls="chat"]')
    const el = document.createElement("div")
    el.className = "lab-chat-09-host"
    if (row) row.insertAdjacentElement("afterend", el)
    else document.querySelector(".work .detail-inner")?.appendChild(el)
    setHost(el)
    row?.setAttribute("aria-expanded", "true")
    row?.classList.add("lab-chat-09-row-open")
    return () => {
      row?.setAttribute("aria-expanded", "false")
      row?.classList.remove("lab-chat-09-row-open")
      el.remove()
      setHost(null)
    }
  }, [inline])

  const close = () => {
    setInline(false)
    onClose()
  }

  if (!inline || !host) return null
  return createPortal(<InlineBox thread={thread} personId={personId} onClose={close} />, host)
}

function InlineBox({ thread, personId, onClose }: { thread: ChatThread | null; personId: string; onClose: () => void }) {
  const core = useChatCore(thread, personId)
  const box = useRef<HTMLDivElement>(null)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const [earlier, setEarlier] = useState(false)

  // Bring the whole box into view once, without moving the card more than needed.
  useEffect(() => {
    const el = box.current
    const sc = el?.closest<HTMLElement>(".detail")
    if (!el || !sc) return
    const over = el.getBoundingClientRect().bottom + 14 - sc.getBoundingClientRect().bottom
    if (over > 0) sc.scrollTop += over
  }, [])
  // Escape (outside the field) folds the conversation away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key === "Escape" && !t?.closest("textarea, input")) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const ms = core.messages
  const lastQ = ms.map((m) => m.role).lastIndexOf("person")
  const shown = lastQ >= 0 ? ms.slice(lastQ) : ms
  const folded = lastQ > 0 ? ms.slice(0, lastQ) : []
  const short = thread ? shortOpener(thread.opener.text) : null

  return (
    <div id="chat" className="lab-chat-base lab-chat-09" ref={box} role="region" aria-label="Talk it through">
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread && short ? (
          <>
            {folded.length > 0 ? (
              <div className="lc-earlier">
                <button type="button" className="lc-earlier-btn" aria-expanded={earlier} onClick={() => setEarlier((e) => !e)}>
                  {earlier ? "Hide earlier questions" : `${count(folded.filter((m) => m.role === "person").length)} before this`}
                  <Icon name={earlier ? "chevron-up" : "chevron-down"} size={14} />
                </button>
                {earlier && (
                  <div className="lc-earlier-list">
                    <OpenerLines lines={short.lead} steps={thread.opener.toolSteps ?? []} />
                    {folded.map((m) => (m.role === "agent" ? <AgentTurn key={m.id} m={m} /> : <Person key={m.id} m={m} />))}
                  </div>
                )}
              </div>
            ) : (
              <OpenerLines lines={short.lead} steps={thread.opener.toolSteps ?? []} />
            )}
            {shown.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentTurn m={m} />
                  {core.offer?.after === m.id && <OfferRow offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <Person key={m.id} m={m} />
              ),
            )}
            {core.live && (
              <div className="lc-agent">
                <p className="lc-by">
                  <AgentMark working />
                  <span className="lc-shimmer">{doing(core.live.steps, core.live.text)}</span>
                </p>
                {core.live.text && <Paras text={core.live.text} />}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <p className="lc-by">
            <AgentMark working />
            <span className="lc-shimmer">Reading the case</span>
          </p>
        )}
      </div>
      <div className="lc-foot">
        <Composer core={core} thread={thread} open placeholder="Ask about this case" />
        <button type="button" className="lc-fold" onClick={onClose} aria-label="Fold the conversation away">
          <Icon name="chevron-up" size={18} />
        </button>
      </div>
    </div>
  )
}

const count = (n: number) => (n === 1 ? "1 question" : `${n} questions`)

function doing(steps: ChatToolStep[], text: string) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  if (running) return runningWords(running.label)
  return text ? "Writing the answer" : "Reading the case"
}

function OpenerLines({ lines, steps }: { lines: string[]; steps: ChatToolStep[] }) {
  return (
    <div className="lc-agent">
      <p className="lc-by">
        <AgentMark />
        <span>{stepSentence(steps)}</span>
      </p>
      <div className="lc-words">
        {lines.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
    </div>
  )
}

function AgentTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-agent">
      {(m.toolSteps?.length ?? 0) > 0 && (
        <p className="lc-by">
          <AgentMark />
          <span>{stepSentence(m.toolSteps ?? [])}</span>
        </p>
      )}
      <Paras text={m.text} />
    </div>
  )
}

function Person({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-person">
      <p>{m.text}</p>
    </div>
  )
}

function OfferRow({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <p className="lc-done" role="status">
        <Icon name="check" size={16} />
        <span>
          <strong>Decided{offer.at ? ` at ${offer.at}` : ""}.</strong> {offer.line}
        </span>
      </p>
    )
  const saving = offer.state === "saving"
  return (
    <div className="lc-offer">
      <div className="lc-offer-buttons">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onYes}>
          {offer.action.label}
        </button>
        <button type="button" className="btn btn-plain" disabled={saving} onClick={onNo}>
          Not now
        </button>
      </div>
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}
