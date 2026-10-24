"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import type { Draft } from "@/lib/control-room/views"
import { Icon } from "./icons"
import { usePanel } from "./work-frame"

/**
 * What "Send the email" opens first: the message itself, as the side panel. To, subject and the
 * whole text in the language it goes out in, with the English one tap away. Send stays at the
 * bottom of the panel; Edit lets the person change the words before it goes.
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
  const [text, setText] = useState(draft.text)

  useEffect(() => {
    if (shown) close.current?.focus({ preventScroll: true })
    else (setEditing(false), setEnglish(false))
  }, [shown])

  if (!slot) return null
  const email = /e-?mail/i.test(draft.to)
  const [name, how] = draft.to.split(/,\s*/)
  const foreign = draft.language !== "en"
  const edited = text.trim() !== draft.text.trim()
  const cancel = () => (setOpen(null), returnFocus())

  return createPortal(
    <aside id="email" className={`panel send-panel${shown ? " open" : ""}`} aria-label={email ? "The email" : "The message"} aria-hidden={!shown} inert={!shown}>
      <div className="panel-head send-head">
        <h2 className="m strong">{email ? "The email" : "The message"}</h2>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
          <Icon name="x" size={18} />
        </button>
      </div>

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
          <button type="button" className="btn btn-primary" disabled={pending || !text.trim()} onClick={() => onSend(edited ? text.trim() : undefined)}>
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
    </aside>,
    slot,
  )
}
