"use client"

import "./undo-in-button.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import type { Draft } from "@/lib/control-room/views"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { type DoneProps, type PreviewProps, recipient, useAfterPanel, useCaseBack, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, useSendWindow, type SendState, useSendError } from "../_shared/send-window"
import { useDraft, useReveal } from "../_shared/use-draft"

/** A ring that empties as the window runs out (drawn in the button's own colour). */
function Ring({ win }: { win: SendState }) {
  const r = 8
  const c = 2 * Math.PI * r
  return (
    <svg className="u2-ring" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r={r} className="u2-ring-track" />
      <circle cx="10" cy="10" r={r} className="u2-ring-left" strokeDasharray={c} strokeDashoffset={c * (1 - win.left / win.seconds)} />
    </svg>
  )
}

/**
 * decide 02: Undo in the button. Send turns into Undo in the very same place, a ring around it
 * empties over 10 s; the email stays in the panel as the record of what went, and the panel's foot
 * becomes the receipt (Night Drive's docked confirmation).
 */
export function UndoInButtonPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const shown = open === "email"
  const close = useRef<HTMLButtonElement>(null)
  const undo = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const enRef = useReveal<HTMLParagraphElement>(d.english)
  const win = useSendView(caseId, d.who)
  const waiting = win?.phase === "wait"
  const sent = win?.phase === "sent"

  useEffect(() => {
    if (shown && !frozen) close.current?.focus({ preventScroll: true })
  }, [shown, frozen])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = () => {
    startSend({ caseId, ...d.who }, () => onSend(d.out))
    // The pointer is already on the spot where Undo appears; keyboard focus moves there too.
    requestAnimationFrame(() => undo.current?.focus({ preventScroll: true }))
  }

  return createPortal(
    <aside
      id="email"
      className={`panel send-panel lab-decide-02${shown ? " open" : ""}${waiting ? " is-wait" : ""}${sent ? " is-sent" : ""}`}
      aria-label={`The ${d.noun}`}
      aria-hidden={!shown}
      inert={!shown}
    >
      <div className="panel-head send-head">
        <h2 className="m strong">{sent ? `The ${d.noun}, sent` : `The ${d.noun}`}</h2>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="send-body">
        <dl className="kv m send-meta">
          <dt>To</dt>
          <dd>
            {d.who.name}
            {d.who.how ? <span className="quiet">, {d.who.how}</span> : null}
          </dd>
          {subject && (
            <>
              <dt>Subject</dt>
              <dd>{subject}</dd>
            </>
          )}
          {draft.language !== "en" && (
            <>
              <dt>Language</dt>
              <dd>{languageName(draft.language)}</dd>
            </>
          )}
        </dl>
        {d.editing ? (
          <textarea className="text-input m u2-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
        ) : (
          <p className="m u2-text" lang={draft.language}>
            {d.text}
          </p>
        )}
        {d.foreign && !d.editing && (
          <div className="u2-english">
            <button type="button" className="link" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
              In English
              <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
            </button>
            {d.english && (
              <p ref={enRef} className="m quiet u2-text u2-en" lang="en">
                {d.edited ? "The English is of the agent's text, before your change. " : ""}
                {draft.translation}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="send-foot">
        {error && <p className="s now">{error}</p>}
        {sent ? (
          <p className="u2-receipt" role="status">
            <Icon name="check" size={18} />
            <span>
              Sent to {d.who.name} at {win.at}
              {pending ? "" : "."}
            </span>
          </p>
        ) : waiting ? (
          <div className="send-actions u2-wait" role="status" aria-live="polite">
            <button
              ref={undo}
              type="button"
              className="btn btn-primary u2-undo"
              onClick={() => undoSend()}
              onPointerEnter={() => pauseSend(true)}
              onPointerLeave={() => pauseSend(false)}
              onFocus={() => pauseSend(true)}
              onBlur={() => pauseSend(false)}
              aria-keyshortcuts="Z"
            >
              <Ring win={win} />
              Undo
            </button>
            <span className="u2-goes">
              Goes to {d.who.name.split(" ")[0]} in {Math.max(1, Math.ceil(win.left))} s
            </span>
          </div>
        ) : (
          <div className="send-actions">
            <button type="button" className="btn btn-primary" disabled={pending || !d.text.trim()} onClick={send}>
              {"Send"}
            </button>
            <button type="button" className="btn btn-plain" disabled={pending} onClick={() => d.setEditing(!d.editing)}>
              {d.editing ? "Done" : "Edit"}
            </button>
            <button type="button" className="btn btn-plain" disabled={pending} onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </aside>,
    slot,
  )
}

/** The sent email as a record in the panel's place (shared panel state, see useAfterPanel), until closed. */
function SentRecord({ draft, at, shown, onClose }: { draft: Draft; at: string; shown: boolean; onClose: () => void }) {
  const { slot } = usePanel()
  const who = recipient(draft.to)
  if (!slot) return null
  return createPortal(
    <aside
      className={`panel send-panel lab-decide-02 is-sent u2-record${shown ? " open" : ""}`}
      aria-label={`The ${who.email ? "email" : "message"}, sent`}
      aria-hidden={!shown}
      inert={!shown}
    >
      <div className="panel-head send-head">
        <h2 className="m strong">The {who.email ? "email" : "message"}, sent</h2>
        <button type="button" className="close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="send-body">
        <dl className="kv m send-meta">
          <dt>To</dt>
          <dd>
            {who.name}
            {who.how ? <span className="quiet">, {who.how}</span> : null}
          </dd>
          {draft.language !== "en" && (
            <>
              <dt>Language</dt>
              <dd>{languageName(draft.language)}</dd>
            </>
          )}
        </dl>
        <p className="m u2-text" lang={draft.language}>
          {draft.text}
        </p>
      </div>
      <div className="send-foot">
        <p className="u2-receipt" role="status">
          <Icon name="check" size={18} />
          <span>
            Sent to {who.name} at {at}.
          </span>
        </p>
      </div>
    </aside>,
    slot,
  )
}

/** After: who decided, the answer, and the kind's count moving ("New kind of case" to "1 of 16"). */
export function UndoInButtonDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const lab = useLab()
  const live = useSendWindow()
  const back = useCaseBack(caseId)
  const justSent = !!live && live.caseId === caseId && live.phase === "sent"
  const [record, setRecord] = useState(!!option.draft && (justSent || lab.decided))
  const after = useAfterPanel(record && !!option.draft, () => setRecord(false))
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const count = back.count
  return (
    <section className="question lab-decide-02 u2-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      {count && (
        <div className="u2-count">
          <p className="m u2-kind">
            <span>{count.kind}</span>
            {count.differ ? (
              <span className="u2-n quiet">{count.line}</span>
            ) : (
              <span className="u2-n" aria-label={count.line}>
                <span className="u2-was">{count.before}</span>
                <span className="u2-now">{count.line}</span>
              </span>
            )}
          </p>
          <p className="s">
            {count.differ
              ? "So these keep coming to a person, and the agent learns from every answer."
              : count.first
                ? `Yours is the first answer. When 16 agree, from two people or more, the agent can ask to handle these alone.`
                : `When 16 agree, from two people or more, the agent can ask to handle these alone.`}
          </p>
        </div>
      )}
      <div className="answers">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
      </div>
      {record && option.draft && <SentRecord draft={option.draft} at={live?.at ?? done.timeWords} shown={after.shown} onClose={after.close} />}
    </section>
  )
}
