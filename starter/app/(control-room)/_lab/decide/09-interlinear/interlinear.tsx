"use client"

import "./interlinear.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, pairs, type PreviewProps, recipient, useCaseBack, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, type SendState, useSendError } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

/**
 * decide 09: Interlinear. The email in the side panel; In English puts each English sentence
 * straight under its German one, the way a call transcript in this room already shows each turn
 * with its translation. Cmd+Return sends; a small toast in the corner holds Undo.
 */
export function InterlinearPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const shown = open === "email" && frozen !== "wait"
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)
  const rows = d.edited ? null : pairs(d.text, draft.translation)

  useEffect(() => {
    if (shown && !frozen) close.current?.focus({ preventScroll: true })
  }, [shown, frozen])
  useEffect(() => {
    if (frozen === "wait" && open === "email") setOpen(null)
  }, [frozen, open, setOpen])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = () => {
    if (pending || !d.text.trim() || win) return
    startSend({ caseId, ...d.who }, () => onSend(d.out), () => setOpen("email"))
    setOpen(null)
    returnFocus()
  }
  const label = verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"

  return (
    <>
      {createPortal(
        <aside
          id="email"
          className={`panel send-panel lab-decide-09${shown ? " open" : ""}`}
          aria-label={`The ${d.noun}`}
          aria-hidden={!shown}
          inert={!shown}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
        >
          <div className="panel-head send-head">
            <h2 className="m strong">The {d.noun}</h2>
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
                  <dd className="l9-lang">
                    <span>{languageName(draft.language)}</span>
                    {d.foreign && !d.editing && (
                      <label className="l9-switch">
                        <span>In English</span>
                        <input type="checkbox" role="switch" checked={d.english} onChange={(e) => d.setEnglish(e.target.checked)} />
                        <span className="l9-track" aria-hidden>
                          <span className="l9-knob" />
                        </span>
                      </label>
                    )}
                  </dd>
                </>
              )}
            </dl>
            {d.editing ? (
              <textarea className="text-input m l9-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
            ) : d.english && rows ? (
              <div className="l9-lines">
                {rows.map(([a, b], i) => (
                  <p key={i} className="l9-pair">
                    <span className="m l9-src" lang={draft.language}>
                      {a}
                    </span>
                    <span className="l9-gloss" lang="en">
                      {b}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <>
                <p className="m l9-text" lang={draft.language}>
                  {d.text}
                </p>
                {d.english && (
                  <p className="l9-gloss l9-block" lang="en">
                    {d.edited ? "The English is of the agent's text, before your change. " : ""}
                    {draft.translation}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="send-foot">
            {error && <p className="s now">{error}</p>}
            <div className="send-actions">
              <button type="button" className="btn btn-primary l9-send" disabled={pending || !d.text.trim() || !!win} onClick={send} aria-keyshortcuts="Meta+Enter">
                {label}
                <kbd className="l9-kbd" aria-hidden>
                  ⌘↩
                </kbd>
              </button>
              <button type="button" className="btn btn-plain" disabled={pending} onClick={() => (d.setEditing(!d.editing), d.setEnglish(false))}>
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
      {win && <CornerToast win={win} noun={d.noun} />}
    </>
  )
}

/** Linear's toast: a small card in the corner, a title, one grey line, one action. */
function CornerToast({ win, noun }: { win: SendState; noun: string }) {
  if (typeof document === "undefined") return null
  const waiting = win.phase === "wait"
  return createPortal(
    <div className="lab-decide-09 l9-toast" role="status" aria-live="polite">
      <span className="l9-toast-mark" aria-hidden>
        <Icon name={waiting ? "arrow-up" : "check"} size={14} />
      </span>
      <span className="l9-toast-words">
        <span className="l9-toast-title">
          {waiting ? "Sending" : `${noun === "email" ? "Email" : "Message"} sent`} to {win.to.split(" ")[0]}
        </span>
        <span className="l9-toast-sub">{waiting ? `The ${noun} goes in ${Math.max(1, Math.ceil(win.left))} s` : `At ${win.at}`}</span>
      </span>
      {waiting && (
        <button
          type="button"
          className="l9-toast-undo"
          onClick={() => undoSend()}
          onPointerEnter={() => pauseSend(true)}
          onPointerLeave={() => pauseSend(false)}
          onFocus={() => pauseSend(true)}
          onBlur={() => pauseSend(false)}
          aria-keyshortcuts="Z"
        >
          Undo <kbd>Z</kbd>
        </button>
      )}
    </div>,
    document.body,
  )
}

/** After: the decision as it now stands in the case record (what History shows), the email one tap away. */
export function InterlinearDone({ headline, option, suggestion, done, leadName, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const back = useCaseBack(caseId, true)
  const [read, setRead] = useState(false)
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const sent = option.draft ? recipient(option.draft.to) : null
  const call = back.steps.find((s) => s.kind === "call")
  const own = option.id === suggestion.id
  return (
    <section className="question lab-decide-09 l9-done" aria-live="polite">
      <p className="m due">In the case record</p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <dl className="l9-record">
        <div>
          <dt>Decision</dt>
          <dd>
            {option.label}
            <span className="l9-q">
              {done.personName}, {done.timeWords}
              {own ? ", as the agent suggested" : ""}
            </span>
          </dd>
        </div>
        {sent && option.draft && (
          <div>
            <dt>{sent.email ? "Email" : "Message"}</dt>
            <dd>
              <button type="button" className="l9-read" aria-expanded={read} onClick={() => setRead(!read)}>
                To {sent.name}, in {languageName(option.draft.language)}
                <Icon name={read ? "chevron-down" : "chevron-right"} size={16} />
              </button>
              {read && (
                <span className="l9-sent" lang={option.draft.language}>
                  {option.draft.text}
                </span>
              )}
            </dd>
          </div>
        )}
        {done.why && (
          <div>
            <dt>Why</dt>
            <dd>
              {done.why}
              <span className="l9-q">{leadName} reviews it before the agent learns from it</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Agent</dt>
          <dd>{call ? call.summary : [back.place ? `Calls ${back.place} next.` : "", ...agentPlan(option)].filter(Boolean).join(" ")}</dd>
        </div>
        {back.count && !back.count.differ && (
          <div>
            <dt>This kind</dt>
            <dd>
              {back.count.kind}, {back.count.line}
            </dd>
          </div>
        )}
      </dl>
      <div className="answers">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
        <Link href={`/history?open=${encodeURIComponent(caseId)}`} className="btn btn-plain">
          Open in History
        </Link>
      </div>
    </section>
  )
}
