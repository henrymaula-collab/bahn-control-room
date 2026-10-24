"use client"

import "./side-by-side.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import type { Option } from "@/lib/control-room/types"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, pairs, type PreviewProps, recipient, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, type SendState, useSendError } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

/**
 * decide 05: Side by side. The email in the side panel; In English widens the panel and sets the
 * German and the English next to each other, sentence against sentence, so a person who does not
 * read German checks every line before it goes. Send leaves a toast at the top with Undo.
 */
export function SideBySidePreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const shown = open === "email" && frozen !== "wait"
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)
  const rows = d.edited ? null : pairs(d.text, draft.translation)
  const wide = d.english && !d.editing && !!draft.translation

  useEffect(() => {
    if (shown && !frozen) close.current?.focus({ preventScroll: true })
  }, [shown, frozen])
  useEffect(() => {
    if (frozen === "wait" && open === "email") setOpen(null)
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
        <aside id="email" className={`panel send-panel lab-decide-05${shown ? " open" : ""}${wide ? " is-wide" : ""}`} aria-label={`The ${d.noun}`} aria-hidden={!shown} inert={!shown}>
          <div className="panel-head send-head">
            <h2 className="m strong">The {d.noun}</h2>
            <div className="s5-head-end">
              {d.foreign && !d.editing && (
                <button type="button" className="s5-toggle" aria-pressed={d.english} onClick={() => d.setEnglish(!d.english)}>
                  {d.english ? `${languageName(draft.language)} only` : "In English"}
                </button>
              )}
              <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
                <Icon name="x" size={18} />
              </button>
            </div>
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
              <textarea className="text-input m s5-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
            ) : wide ? (
              <div className="s5-cols" role="table" aria-label="The text and its English">
                <div className="s5-colhead" role="row">
                  <span role="columnheader">{languageName(draft.language)}, as it goes</span>
                  <span role="columnheader">English</span>
                </div>
                {rows ? (
                  rows.map(([a, b], i) => (
                    <div key={i} className="s5-pair" role="row">
                      <p className="m" lang={draft.language} role="cell">
                        {a}
                      </p>
                      <p className="m" lang="en" role="cell">
                        {b}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="s5-pair" role="row">
                    <p className="m s5-pre" lang={draft.language} role="cell">
                      {d.text}
                    </p>
                    <p className="m s5-pre" lang="en" role="cell">
                      {draft.translation}
                    </p>
                  </div>
                )}
                {d.edited && <p className="s s5-note">The English is of the agent's text, before your change.</p>}
              </div>
            ) : (
              <p className="m s5-text" lang={draft.language}>
                {d.text}
              </p>
            )}
          </div>
          <div className="send-foot">
            {error && <p className="s now">{error}</p>}
            <div className="send-actions">
              <button type="button" className="btn btn-primary" disabled={pending || !d.text.trim() || !!win} onClick={send}>
                {verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"}
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
      {win && <TopToast win={win} noun={d.noun} />}
    </>
  )
}

function TopToast({ win, noun }: { win: SendState; noun: string }) {
  if (typeof document === "undefined") return null
  const waiting = win.phase === "wait"
  return createPortal(
    <div className="lab-decide-05 s5-toast" role="status" aria-live="polite">
      <span>
        {waiting ? `Sending the ${noun} to ${win.to}` : `${noun === "email" ? "Email" : "Message"} sent to ${win.to}`}
      </span>
      {waiting ? (
        <button
          type="button"
          onClick={() => undoSend()}
          onPointerEnter={() => pauseSend(true)}
          onPointerLeave={() => pauseSend(false)}
          onFocus={() => pauseSend(true)}
          onBlur={() => pauseSend(false)}
          aria-keyshortcuts="Z"
        >
          Undo <span className="s5-sec">{Math.max(1, Math.ceil(win.left))}</span>
        </button>
      ) : (
        <Icon name="check" size={18} />
      )}
    </div>,
    document.body,
  )
}

type Line = { label: string; now: string; was?: string }

/** What a decision changes, as Flighty puts a change: the new value, and what it was in grey. */
function linesOf(o: Option, at: string): Line[] {
  const out: Line[] = []
  for (const c of o.changes) {
    if (c.kind === "customer_message" || c.kind === "driver_message") {
      const who = o.draft ? recipient(o.draft.to) : null
      const to = c.kind === "driver_message" ? "Driver" : "Customer"
      out.push({ label: to, now: who ? `${who.email ? "Email" : "Message"} sent at ${at}${o.draft && o.draft.language !== "en" ? `, in ${languageName(o.draft.language)}` : ""}` : `Message sent at ${at}` })
      continue
    }
    // "Pickup moves from Mon 26 Oct 09:00-12:00 to Tue 27 Oct from 12:00 (...)." -> was / now
    const moves = [...c.detail.matchAll(/(\w+) moves from (.+?) to (.+?)(?: \([^)]*\))?\.(?:\s|$)/g)]
    if (moves.length) {
      for (const m of moves) out.push({ label: m[1], now: m[3].replace(/, to be agreed$/, ", to agree"), was: m[2].replace(/-/g, "–") })
      continue
    }
    if (c.kind !== "none") out.push({ label: c.kind === "date" ? "Dates" : c.kind === "cost" ? "Cost" : "Booking", now: c.detail })
  }
  const plan = agentPlan(o)
  if (plan.length) out.push({ label: "Agent", now: plan[0] })
  return out
}

/** After: what this decision changed, line by line, new value in ink and the old one in grey. */
export function SideBySideDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const lines = linesOf(option, done.timeWords)
  return (
    <section className="question lab-decide-05 s5-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      <dl className="s5-changes">
        {lines.map((l, i) => (
          <div key={i} className="s5-change">
            <dt>{l.label}</dt>
            <dd>
              <span className="s5-now">{l.now.charAt(0).toUpperCase() + l.now.slice(1)}</span>
              {l.was && <span className="s5-was">was {l.was}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="answers">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
      </div>
    </section>
  )
}
