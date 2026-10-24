"use client"

import "./compose-sheet.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, type SendState, useSendError } from "../_shared/send-window"
import { useColumn, useDraft } from "../_shared/use-draft"

/**
 * decide 04: Compose sheet. The email comes up as a sheet over the card, with Apple's sheet bar:
 * Cancel on the left, the title in the middle, Send on the right. Send drops the sheet; an
 * "Undo Send" bar waits at the foot of the card for 10 s, the way Mail keeps Undo Send.
 */
export function ComposeSheetPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)

  // The card's button asks for the email panel: show the sheet instead, the situation stays behind it.
  useEffect(() => {
    if (open !== "email") return
    setOpen(null)
    if (!frozen) setShown(true)
  }, [open, setOpen, frozen])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (shown && !el.open) {
      el.showModal()
      // Focus the sheet itself, not Cancel: Return and Cmd+Return still work, no ring on a button.
      el.querySelector<HTMLElement>(".c4-body")?.focus({ preventScroll: true })
    }
    if (!shown && el.open) el.close()
  }, [shown])

  const cancel = () => (setShown(false), returnFocus())
  const send = () => {
    startSend({ caseId, ...d.who }, () => onSend(d.out), () => setShown(true))
    setShown(false)
  }
  const label = verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <dialog
            ref={ref}
            className="lab-decide-04 c4-sheet"
            aria-label={`The ${d.noun}`}
            onClose={() => setShown(false)}
            onClick={(e) => e.target === ref.current && cancel()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !pending && d.text.trim()) {
                e.preventDefault()
                send()
              }
            }}
          >
            <div className="c4-bar">
              <button type="button" className="c4-bar-btn" onClick={cancel} disabled={pending}>
                Cancel
              </button>
              <h2 className="c4-title">The {d.noun}</h2>
              <div className="c4-bar-end">
                <button
                  type="button"
                  className="c4-bar-btn"
                  aria-pressed={d.editing}
                  disabled={pending}
                  onClick={() => {
                    d.setEditing(!d.editing)
                    d.setEnglish(false)
                    if (!d.editing) requestAnimationFrame(() => area.current?.focus())
                  }}
                >
                  {d.editing ? "Done" : "Edit"}
                </button>
                <button type="button" className="btn btn-primary btn-small c4-send" disabled={pending || !d.text.trim()} onClick={send} aria-keyshortcuts="Meta+Enter">
                  {label}
                </button>
              </div>
            </div>
            <div className="c4-body" tabIndex={-1}>
              <p className="c4-row">
                <span className="c4-k">To:</span>
                <span>
                  {d.who.name}
                  {d.who.how && <span className="c4-k">, {d.who.how}</span>}
                </span>
              </p>
              {subject && (
                <p className="c4-row">
                  <span className="c4-k">Subject:</span>
                  <span>{subject}</span>
                </p>
              )}
              {draft.language !== "en" && (
                <p className="c4-row">
                  <span className="c4-k">Language:</span>
                  <span className="c4-lang">
                    <span>{languageName(draft.language)}</span>
                    {d.foreign && !d.editing && (
                      <button type="button" className="link c4-en-btn" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
                        In English
                        <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
                      </button>
                    )}
                  </span>
                </p>
              )}
              {d.english && !d.editing && (
                <p className="m c4-en" lang="en">
                  {d.edited ? "The English is of the agent's text, before your change. " : ""}
                  {draft.translation}
                </p>
              )}
              {d.editing ? (
                <textarea ref={area} className="m c4-text c4-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" />
              ) : (
                <p className="m c4-text" lang={draft.language}>
                  {d.text}
                </p>
              )}
              {error && <p className="s now">{error}</p>}
            </div>
          </dialog>,
          document.body,
        )}
      {win && <UndoBar win={win} noun={d.noun} pending={pending} />}
    </>
  )
}

function UndoBar({ win, noun, pending }: { win: SendState; noun: string; pending: boolean }) {
  const rect = useColumn()
  if (typeof document === "undefined" || !rect) return null
  const waiting = win.phase === "wait"
  return createPortal(
    <div className="lab-decide-04 c4-undo-bar" style={{ left: rect.left + 16, bottom: rect.bottom + 16 }} role="status" aria-live="polite">
      {waiting ? (
        <>
          <span className="c4-undo-text">
            The {noun} goes to {win.to.split(" ")[0]} in <span className="c4-num">{Math.max(1, Math.ceil(win.left))}</span> s
          </span>
          <button
            type="button"
            className="c4-undo-btn"
            onClick={() => undoSend()}
            onPointerEnter={() => pauseSend(true)}
            onPointerLeave={() => pauseSend(false)}
            onFocus={() => pauseSend(true)}
            onBlur={() => pauseSend(false)}
            aria-keyshortcuts="Z"
          >
            Undo Send
          </button>
        </>
      ) : (
        <span className="c4-undo-text">
          <Icon name="check" size={16} /> {noun === "email" ? "Email" : "Message"} sent{pending ? "" : "."}
        </span>
      )}
    </div>,
    document.body,
  )
}

/** After: a calm, centred moment. One tick, one sentence of what happened, the next case. */
export function ComposeSheetDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const sent = option.draft ? recipient(option.draft.to) : null
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  return (
    <section className="question lab-decide-04 c4-done" aria-live="polite">
      <svg className="c4-tick" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r="25" />
        <path d="M15 27 l7 7 l15 -16" />
      </svg>
      <h1 className="c4-done-title">{sent ? `Sent to ${sent.name}` : option.label}</h1>
      <p className="m quiet c4-done-what">{headline}</p>
      <p className="m c4-done-plan">
        Decided by {done.personName} at {done.timeWords}. {(sent ? agentPlan(option) : [option.effect]).join(" ")}
      </p>
      <div className="answers c4-done-actions">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
        <Link href={`/history?open=${encodeURIComponent(caseId)}`} className="btn btn-plain">
          In History
        </Link>
      </div>
    </section>
  )
}
