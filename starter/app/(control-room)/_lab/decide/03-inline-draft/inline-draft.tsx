"use client"

import "./inline-draft.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

/**
 * decide 03: Inline draft. The email opens in the card itself, under the question it answers,
 * like Zendesk's auto assist draft in the composer; the situation stays beside it. German and
 * English are one two-way switch. Send folds the draft into one receipt line with Undo.
 */
export function InlineDraftPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen } = usePanel()
  const caseId = useCaseId()
  const frozen = useFrozen()
  const [expanded, setExpanded] = useState(false)
  const d = useDraft(draft, expanded)
  const win = useSendView(caseId, d.who)
  const box = useRef<HTMLDivElement>(null)
  const sendBtn = useRef<HTMLButtonElement>(null)

  // The card's button asks for the email panel: open the draft here instead and keep the situation beside.
  useEffect(() => {
    if (open !== "email") return
    setOpen(null)
    if (!frozen) {
      setExpanded(true)
      requestAnimationFrame(() => {
        box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
        sendBtn.current?.focus({ preventScroll: true })
      })
    }
  }, [open, setOpen, frozen])

  const cancel = () => (setExpanded(false), returnFocus())
  const send = () => {
    startSend({ caseId, ...d.who }, () => onSend(d.out), () => setExpanded(true))
    setExpanded(false)
  }
  const on = expanded || !!win

  if (win) {
    const waiting = win.phase === "wait"
    return (
      <div className="lab-decide-03 is-open i3-receipt" role="status" aria-live="polite">
        <Icon name={waiting ? "arrow-up" : "check"} size={18} />
        <span className="i3-line">
          {waiting ? `Sending the ${d.noun} to ${d.who.name}` : `Sent to ${d.who.name} at ${win.at}`}
          {waiting ? "" : pending ? "" : "."}
        </span>
        {waiting && (
          <button
            type="button"
            className="btn btn-plain btn-small i3-undo"
            onClick={() => undoSend()}
            onPointerEnter={() => pauseSend(true)}
            onPointerLeave={() => pauseSend(false)}
            onFocus={() => pauseSend(true)}
            onBlur={() => pauseSend(false)}
            aria-keyshortcuts="Z"
          >
            Undo
          </button>
        )}
        {waiting && <span className="i3-drain" aria-hidden style={{ transform: `scaleX(${win.left / win.seconds})` }} />}
      </div>
    )
  }

  if (!on) return null
  return (
    <div ref={box} id="email" className="lab-decide-03 is-open i3-draft" aria-label={`The ${d.noun}`}>
      <div className="i3-top">
        <p className="i3-to">
          <span className="i3-k">To</span> {d.who.name}
          {d.who.how && <span className="i3-k">, {d.who.how}</span>}
        </p>
        {d.foreign && !d.editing && (
          <div className="i3-switch" role="group" aria-label="Language shown">
            <button type="button" aria-pressed={!d.english} onClick={() => d.setEnglish(false)}>
              {languageName(draft.language)}
            </button>
            <button type="button" aria-pressed={d.english} onClick={() => d.setEnglish(true)}>
              In English
            </button>
          </div>
        )}
      </div>
      {subject && (
        <p className="i3-subject">
          <span className="i3-k">Subject</span> {subject}
        </p>
      )}
      {d.editing ? (
        <textarea className="text-input m i3-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
      ) : d.english ? (
        <p className="m i3-text i3-en" lang="en">
          {d.edited ? "The English is of the agent's text, before your change. " : ""}
          {draft.translation}
        </p>
      ) : (
        <p className="m i3-text" lang={draft.language}>
          {d.text}
        </p>
      )}
      {d.english && !d.editing && <p className="s i3-note">Goes out in {languageName(draft.language)}, as written by the agent{d.edited ? " and changed by you" : ""}.</p>}
      {error && <p className="s now">{error}</p>}
      <div className="i3-actions">
        <button ref={sendBtn} type="button" className="btn btn-primary" disabled={pending || !d.text.trim()} onClick={send}>
          {verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"}
        </button>
        <button type="button" className="btn btn-plain" disabled={pending} onClick={() => (d.setEnglish(false), d.setEditing(!d.editing))}>
          {d.editing ? "Done" : "Edit"}
        </button>
        <button type="button" className="btn btn-plain" disabled={pending} onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** After: the answered question with a tick, the receipt in grey, and the next case as one quiet row. */
export function InlineDraftDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const needs = useNeedsYou()
  const caseId = useCaseId()
  const sent = option.draft ? recipient(option.draft.to) : null
  const nextId = nextHref ? decodeURIComponent(nextHref.split("?")[0].split("/")[2] ?? "") : ""
  const next = needs.rows.find((r) => r.caseId === nextId && r.caseId !== caseId)
  const time = next ? needs.times[next.caseId] : undefined
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  return (
    <section className="question lab-decide-03 i3-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask i3-answer">
        <span className="i3-tick" aria-hidden>
          <Icon name="check" size={18} />
        </span>
        <span>{option.label}.</span>
      </p>
      <p className="m quiet i3-after">
        {sent ? `${sent.email ? "Email" : "Message"} sent to ${sent.name} at ${done.timeWords}. ` : ""}
        {(sent ? agentPlan(option) : [option.effect]).join(" ")}
      </p>
      <Link href={nextHref ?? "/tasks"} className="row-link i3-next" aria-keyshortcuts="Enter">
        <span className="i3-next-text">
          <span className="i3-next-k">{nextHref ? "Next case" : "Back to your tasks"}</span>
          {next && (
            <span className="i3-next-v">
              {next.vehicle}, {next.place}
              {time ? (
                <>
                  {", "}
                  <span className={time.now ? "now" : undefined}>{`${time.text.charAt(0).toLowerCase()}${time.text.slice(1)}`}</span>
                </>
              ) : null}
            </span>
          )}
        </span>
        <span className="chev">
          <Icon name="arrow-right" size={20} />
        </span>
      </Link>
    </section>
  )
}
