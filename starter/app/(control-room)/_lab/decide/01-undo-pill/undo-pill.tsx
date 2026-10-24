"use client"

import "./undo-pill.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseBack, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, useSendWindow, type SendState } from "../_shared/send-window"
import { useColumn, useDraft } from "../_shared/use-draft"

/**
 * decide 01: Undo pill. The email in the side panel, as today but set like Mail's compose header.
 * Send closes the panel at once; a dark pill under the card says what is going where, with Undo
 * and a line that drains over 10 s (Gmail's Undo Send). The pill then says what the agent does next.
 */
export function UndoPillPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  const frozen = useFrozen()
  const shown = open === "email" && !frozen
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)

  useEffect(() => {
    if (shown) close.current?.focus({ preventScroll: true })
  }, [shown])
  // Photo state ?send=wait: the panel has already closed behind the pill.
  useEffect(() => {
    if (frozen && open === "email") setOpen(null)
  }, [frozen, open, setOpen])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = () => {
    startSend({ caseId, ...d.who }, () => onSend(d.out), () => setOpen("email"))
    setOpen(null)
    returnFocus()
  }

  return (
    <>
      {createPortal(
        <aside id="email" className={`panel send-panel lab-decide-01${shown ? " open" : ""}`} aria-label={`The ${d.noun}`} aria-hidden={!shown} inert={!shown}>
          <div className="panel-head send-head">
            <h2 className="m strong">The {d.noun}</h2>
            <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="send-body">
            <div className="u1-head">
              <p className="u1-row">
                <span className="u1-k">To</span>
                <span className="u1-v">
                  {d.who.name}
                  {d.who.how && <span className="u1-q">, {d.who.how}</span>}
                </span>
              </p>
              {subject && (
                <p className="u1-row">
                  <span className="u1-k">Subject</span>
                  <span className="u1-v">{subject}</span>
                </p>
              )}
              {draft.language !== "en" && (
                <p className="u1-row">
                  <span className="u1-k">Language</span>
                  <span className="u1-v">{languageName(draft.language)}</span>
                </p>
              )}
            </div>
            {d.editing ? (
              <textarea className="text-input m u1-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
            ) : (
              <p className="m u1-text" lang={draft.language}>
                {d.text}
              </p>
            )}
            {d.foreign && !d.editing && (
              <div className="u1-english">
                <button type="button" className="link" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
                  In English
                  <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
                </button>
                {d.english && (
                  <p className="m u1-text u1-en" lang="en">
                    {d.edited ? "The English is of the agent's text, before your change. " : ""}
                    {draft.translation}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="send-foot">
            {error && <p className="s now">{error}</p>}
            <div className="send-actions">
              <button type="button" className="btn btn-primary" disabled={pending || !d.text.trim() || !!win} onClick={send}>
                {verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"}
              </button>
              <button type="button" className="btn btn-plain" disabled={pending} onClick={() => d.setEditing(!d.editing)}>
                {d.editing ? "Done" : "Edit"}
              </button>
              <button type="button" className="btn btn-plain" disabled={pending} onClick={cancel}>
                Cancel
              </button>
            </div>
          </div>
        </aside>,
        slot,
      )}
      {win && <Pill win={win} pending={pending} noun={d.noun} />}
    </>
  )
}

/** The pill under the card: inside the window it holds Undo; after it, what was sent and what comes next. */
function Pill({ win, pending, noun, next }: { win: SendState; pending?: boolean; noun: string; next?: string }) {
  const rect = useColumn()
  if (typeof document === "undefined" || !rect) return null
  const waiting = win.phase === "wait"
  const style = { left: rect.left + rect.width / 2, bottom: rect.bottom + 24 } as React.CSSProperties
  return createPortal(
    <div className={`lab-decide-01 u1-pill${waiting ? " wait" : " sent"}`} style={style} role="status" aria-live="polite">
      {waiting ? (
        <>
          <span className="u1-pill-text">
            Sending the {noun} to {win.to}
          </span>
          <button
            type="button"
            className="u1-undo"
            onClick={() => undoSend()}
            onPointerEnter={() => pauseSend(true)}
            onPointerLeave={() => pauseSend(false)}
            onFocus={() => pauseSend(true)}
            onBlur={() => pauseSend(false)}
            aria-keyshortcuts="Z"
          >
            Undo
          </button>
          <span className="u1-drain" aria-hidden style={{ transform: `scaleX(${win.left / win.seconds})` }} />
        </>
      ) : (
        <>
          <Icon name="check" size={18} />
          <span className="u1-pill-text">
            {noun === "email" ? "Email" : "Message"} sent to {win.to}
            {pending ? "" : next ? `. ${next}` : "."}
          </span>
        </>
      )}
    </div>,
    document.body,
  )
}

/** After the decision: the receipt is the card's first line, and the next case is the one filled button. */
export function UndoPillDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const back = useCaseBack(caseId)
  const live = useSendWindow()
  const sent = option.draft ? recipient(option.draft.to) : null
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const win = live && live.caseId === caseId && live.phase === "sent" ? live : null
  return (
    <section className="question lab-decide-01 u1-done" aria-live="polite">
      <p className="m due">
        {sent ? (sent.email ? "Email sent" : "Message sent") : "Decided"} by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      <p className="m quiet context">{sent ? agentPlan(option).join(" ") : option.effect}</p>
      <div className="answers">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
        <Link href={`/history?open=${encodeURIComponent(caseId)}`} className="btn btn-plain">
          In History
        </Link>
      </div>
      {win && sent && <Pill win={win} noun={sent.email ? "email" : "message"} next={back.place ? (back.steps.some((s) => s.kind === "call") ? `The agent has called ${back.place}` : `The agent calls ${back.place} next`) : undefined} />}
    </section>
  )
}
