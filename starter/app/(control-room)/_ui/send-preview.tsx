"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import type { Draft } from "@/lib/control-room/views"
import {
  editedText,
  failSend,
  pauseSend,
  recipient,
  sendNow,
  sentWhat,
  setEdit,
  sheetClosed,
  sheetOrigin,
  startSend,
  undoSend,
  useSendWindow,
} from "./email-send"
import { Icon } from "./icons"
import { usePanel } from "./work-frame"

/**
 * What "Send the email" opens first: the message itself, as the side panel. To, subject and the
 * whole text in the language it goes out in, with the English one tap away. Send stays at the
 * bottom of the panel; Edit lets the person change the words before it goes. Send opens the short
 * send window (lab decide:08: "Sending", Undo) and at its end calls the card's own onSend, so the
 * decision goes the one way it always did. Opened from the chat's "See the email", the chat's
 * receipt follows (email-receipt.tsx).
 */
export function SendPreview({
  draft,
  subject,
  verb,
  pending,
  error,
  onSend,
  returnFocus,
}: {
  draft: Draft
  subject?: string
  verb: string // "Send the email": the panel's title
  pending: boolean
  error: string | null
  onSend: (editedText?: string) => void
  returnFocus: () => void
}) {
  const { open, setOpen, slot } = usePanel()
  const shown = open === "email"
  const close = useRef<HTMLButtonElement>(null)
  const [english, setEnglish] = useState(false)
  const [editing, setEditing] = useState(false)
  const path = usePathname() ?? ""
  const caseId = decodeURIComponent(path.split("/")[2] ?? "")
  // The person's edit outlives the sheet (they may ask the agent first, then send from the chat); Cancel drops it.
  const [text, setTextRaw] = useState(() => editedText(caseId, draft.text) ?? draft.text)
  const setText = (v: string) => (setTextRaw(v), setEdit(caseId, draft.text, v))
  const win = useSendWindow(caseId)
  const sending = !!win && (win.phase === "wait" || win.phase === "saving")

  // The window this sheet started: if the sheet goes away while it runs (Escape, the close), it sends now.
  const started = useRef(false)
  useEffect(() => {
    if (shown) close.current?.focus({ preventScroll: true })
    // Closed any way (Cancel, the close, Escape): the edits go, the agent's draft comes back.
    else {
      if (started.current) sendNow()
      started.current = false
      setEditing(false)
      setEnglish(false)
      sheetClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])
  // A save that failed after the window: no receipt may claim it went.
  useEffect(() => {
    if (error && caseId) failSend(caseId)
  }, [error, caseId])

  if (!slot) return null
  const email = /e-?mail/i.test(draft.to)
  const [name, how] = draft.to.split(/,\s*/)
  const foreign = draft.language !== "en"
  const edited = text.trim() !== draft.text.trim()
  // Closing the sheet while it is sending hides Undo, so the email goes at once (Gmail: dismissing the
  // undo bar sends); no countdown runs on unseen.
  // Cancel (and the close) throws the edit away and brings the agent's draft back.
  const cancel = () => {
    if (sending && started.current) sendNow()
    else {
      setTextRaw(draft.text)
      setEdit(caseId, draft.text, null)
    }
    setOpen(null)
    returnFocus()
  }
  const go = () => {
    const out = edited ? text.trim() : undefined
    const r = recipient(draft.to)
    const from = sheetOrigin(caseId)
    started.current = true
    startSend(
      {
        caseId,
        origin: from.origin,
        to: r.name,
        how: r.how,
        noun: r.noun,
        language: draft.language,
        subject,
        next: from.next,
        calls: from.calls,
      },
      () => onSend(out),
    )
  }

  return createPortal(
    <aside
      id="email"
      className={`panel send-panel${shown ? " open" : ""}`}
      aria-label={email ? "The email" : "The message"}
      aria-hidden={!shown}
      inert={!shown}
    >
      <div className="panel-head send-head">
        <h2 className="m strong">{email ? "The email" : "The message"}</h2>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {sending && win ? (
        <>
          <div className="send-body send-window" role="status" aria-live="polite">
            <h3 className="receipt-title">Sending</h3>
            <p className="receipt-line">
              {sentWhat(win)}
              {subject ? `, about ${subject}` : ""}.
            </p>
            <p className="receipt-more">
              {win.phase === "saving" ? "Saving the decision." : `It goes in ${Math.max(1, Math.ceil(win.left))} s. Until then you can take it back.`}
            </p>
          </div>
          <div className="send-foot">
            <div className="send-actions">
              <button
                type="button"
                className="btn btn-secondary send-undo"
                disabled={win.phase === "saving"}
                onClick={() => undoSend()}
                onPointerEnter={() => pauseSend(true)}
                onPointerLeave={() => pauseSend(false)}
                onFocus={() => pauseSend(true)}
                onBlur={() => pauseSend(false)}
              >
                Undo
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="send-body">
            <dl className="kv m send-meta">
              <dt>To</dt>
              <dd>
                {name}
                {how ? <span className="quiet">, {how}</span> : null}
              </dd>
              {subject && (
                <>
                  <dt>Subject</dt>
                  <dd>{subject}</dd>
                </>
              )}
              {foreign && (
                <>
                  <dt>Language</dt>
                  <dd>{languageName(draft.language)}</dd>
                </>
              )}
            </dl>

            {editing ? (
              <textarea
                className="text-input m send-edit"
                lang={draft.language}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="The text"
                autoFocus
              />
            ) : (
              <p className="m send-text" lang={draft.language}>
                {text}
              </p>
            )}

            {foreign && draft.translation && !editing && (
              <div className="send-english">
                <button type="button" className="link" aria-expanded={english} onClick={() => setEnglish(!english)}>
                  In English
                  <Icon name={english ? "chevron-down" : "chevron-right"} size={16} />
                </button>
                {english && (
                  <p className="m quiet send-text" lang="en">
                    {edited ? "The English is of the agent's text, before your change. " : ""}
                    {draft.translation}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="send-foot">
            {error && <p className="s now">{error}</p>}
            <div className="send-actions">
              <button type="button" className="btn btn-primary" disabled={pending || !text.trim()} onClick={go}>
                {verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"}
              </button>
              <button type="button" className="btn btn-plain" disabled={pending} onClick={() => setEditing(!editing)}>
                {editing ? "Done" : "Edit"}
              </button>
              <button type="button" className="btn btn-plain" disabled={pending} onClick={cancel}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </aside>,
    slot,
  )
}
