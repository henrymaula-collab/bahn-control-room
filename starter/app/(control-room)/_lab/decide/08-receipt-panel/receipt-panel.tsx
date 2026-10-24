"use client"

import "./receipt-panel.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseBack, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, useSendWindow } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

/** The receipt as the panel's whole content: a title, one grey sentence, the buttons at the foot. */
function Receipt({
  title,
  line,
  more,
  foot,
  onClose,
}: {
  title: string
  line: string
  more?: string
  foot: React.ReactNode
  onClose: () => void
}) {
  return (
    <>
      <div className="panel-head send-head r8-head">
        <span />
        <button type="button" className="close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="send-body r8-body" role="status" aria-live="polite">
        <span className="r8-rule" aria-hidden />
        <h2 className="r8-title">{title}</h2>
        <p className="r8-line">{line}</p>
        {more && <p className="r8-more">{more}</p>}
      </div>
      <div className="send-foot r8-foot">{foot}</div>
    </>
  )
}

/**
 * decide 08: Receipt panel. Send turns the email panel into a receipt, the way Lightspark's
 * "Payout submitted" takes over its side panel: one title, one grey sentence with the exact what
 * and where, the buttons at the foot. After the decision the receipt stays until closed, with
 * Next case as the filled button and In History beside it.
 */
export function ReceiptPanelPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  const frozen = useFrozen()
  const shown = open === "email"
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)

  useEffect(() => {
    if (shown && !frozen) close.current?.focus({ preventScroll: true })
  }, [shown, frozen])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = () => startSend({ caseId, ...d.who }, () => onSend(d.out))
  const lang = languageName(draft.language)
  const what = `The ${d.noun} in ${lang} to ${d.who.name}${d.who.how ? `, ${d.who.how}` : ""}${subject ? `, about ${subject}` : ""}.`

  return createPortal(
    <aside id="email" className={`panel send-panel lab-decide-08${shown ? " open" : ""}${win ? " is-receipt" : ""}`} aria-label={`The ${d.noun}`} aria-hidden={!shown} inert={!shown}>
      {win ? (
        <Receipt
          title={win.phase === "wait" ? "Sending" : `${d.noun === "email" ? "Email" : "Message"} sent`}
          line={what}
          more={win.phase === "wait" ? `It goes in ${Math.max(1, Math.ceil(win.left))} s. Until then you can take it back.` : `Sent at ${win.at}. The agent takes it from here.`}
          onClose={cancel}
          foot={
            win.phase === "wait" ? (
              <div className="send-actions r8-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => undoSend()}
                  onPointerEnter={() => pauseSend(true)}
                  onPointerLeave={() => pauseSend(false)}
                  onFocus={() => pauseSend(true)}
                  onBlur={() => pauseSend(false)}
                  aria-keyshortcuts="Z"
                >
                  Undo
                </button>
              </div>
            ) : (
              <p className="s r8-wait">{pending ? "Saving the decision" : "Saved"}</p>
            )
          }
        />
      ) : (
        <>
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
                  <dd>{lang}</dd>
                </>
              )}
            </dl>
            {d.editing ? (
              <textarea className="text-input m r8-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
            ) : (
              <p className="m r8-text" lang={draft.language}>
                {d.text}
              </p>
            )}
            {d.foreign && !d.editing && (
              <div className="r8-english">
                <button type="button" className="link" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
                  In English
                  <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
                </button>
                {d.english && (
                  <p className="m quiet r8-text r8-en" lang="en">
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
              <button type="button" className="btn btn-primary" disabled={pending || !d.text.trim()} onClick={send}>
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
        </>
      )}
    </aside>,
    slot,
  )
}

/** After: the receipt stays in the panel (Next case, In History); the card says who decided and moves on. */
export function ReceiptPanelDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const lab = useLab()
  const live = useSendWindow()
  const { slot } = usePanel()
  const back = useCaseBack(caseId)
  const justSent = !!live && live.caseId === caseId && live.phase === "sent"
  const [receipt, setReceipt] = useState(justSent || lab.decided)
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const sent = option.draft ? recipient(option.draft.to) : null
  const call = back.steps.find((s) => s.kind === "call")
  const title = sent ? `${sent.email ? "Email" : "Message"} sent` : "Decided"
  const line = sent
    ? `The ${sent.email ? "email" : "message"} in ${languageName(option.draft!.language)} to ${sent.name}, at ${done.timeWords}.`
    : `${option.label}, at ${done.timeWords}.`
  const more = call ? call.summary : [back.place ? `Next, the agent calls ${back.place}.` : "", ...agentPlan(option)].filter(Boolean).join(" ")
  return (
    <section className="question lab-decide-08 r8-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      {!receipt && (
        <div className="answers">
          <Link href={nextHref ?? "/tasks"} className="btn btn-primary">
            {nextHref ? "Next case" : "Back to your tasks"}
          </Link>
        </div>
      )}
      {receipt &&
        slot &&
        createPortal(
          <aside className="panel send-panel open lab-decide-08 is-receipt r8-over" aria-label={title}>
            <Receipt
              title={title}
              line={line}
              more={more}
              onClose={() => setReceipt(false)}
              foot={
                <div className="send-actions r8-actions">
                  <Link href={`/history?open=${encodeURIComponent(caseId)}`} className="btn btn-secondary">
                    In History
                  </Link>
                  <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
                    {nextHref ? "Next case" : "Your tasks"}
                  </Link>
                </div>
              }
            />
          </aside>,
          slot,
        )}
    </section>
  )
}
