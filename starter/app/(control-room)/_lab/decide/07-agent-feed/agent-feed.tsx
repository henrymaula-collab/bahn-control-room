"use client"

import "./agent-feed.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseBack, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, useSendError } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

type Row = { state: "done" | "live" | "next"; text: string; sub?: string; undo?: boolean }

/** One line of the log: a mark (done, at work, still to come), the words, a grey line under them. */
function Log({ rows, onUndo }: { rows: Row[]; onUndo?: () => void }) {
  return (
    <ol className="f7-log">
      {rows.map((r, i) => (
        <li key={i} className={`f7-row is-${r.state}`}>
          <span className="f7-mark" aria-hidden>
            {r.state === "done" ? <Icon name="check" size={12} /> : null}
          </span>
          <span className="f7-words">
            <span className="f7-text">{r.text}</span>
            {r.sub && <span className="f7-sub">{r.sub}</span>}
          </span>
          {r.undo && onUndo && (
            <button
              type="button"
              className="btn btn-small btn-secondary f7-undo"
              onClick={onUndo}
              onPointerEnter={() => pauseSend(true)}
              onPointerLeave={() => pauseSend(false)}
              onFocus={() => pauseSend(true)}
              onBlur={() => pauseSend(false)}
              aria-keyshortcuts="Z"
            >
              Undo
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}

/**
 * decide 07: Agent feed. The email in the side panel; after Send the same panel becomes the
 * agent's log of the next minutes: the email going (with Undo while it can), the call to the
 * pickup place, the follow-up, the case record. Lines land as they happen.
 */
export function AgentFeedPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const shown = open === "email"
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)
  const back = useCaseBack(caseId)

  useEffect(() => {
    if (shown && !frozen) close.current?.focus({ preventScroll: true })
  }, [shown, frozen])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = () => startSend({ caseId, ...d.who }, () => onSend(d.out))
  const place = back.place ?? "the pickup place"
  const plan = back.option ? agentPlan(back.option) : []
  const rows: Row[] = win
    ? [
        win.phase === "wait"
          ? { state: "live", text: `The ${d.noun} to ${d.who.name}`, sub: `Goes in ${Math.max(1, Math.ceil(win.left))} s, in ${languageName(draft.language)}`, undo: true }
          : { state: "done", text: `The ${d.noun} to ${d.who.name}`, sub: `Sent at ${win.at}` },
        { state: win.phase === "wait" ? "next" : "live", text: `The agent calls ${place}`, sub: win.phase === "wait" ? `As soon as the ${d.noun} has gone` : "To tell them what was decided" },
        ...plan.map((p) => ({ state: "next" as const, text: p })),
        { state: "next", text: "The decision goes into the case record", sub: "With your name and the time, in History" },
      ]
    : []

  return createPortal(
    <aside id="email" className={`panel send-panel lab-decide-07${shown ? " open" : ""}${win ? " is-log" : ""}`} aria-label={win ? "What happens now" : `The ${d.noun}`} aria-hidden={!shown} inert={!shown}>
      <div className="panel-head send-head">
        <h2 className="m strong">{win ? "What happens now" : `The ${d.noun}`}</h2>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={cancel}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {win ? (
        <div className="send-body" role="status" aria-live="polite">
          <Log rows={rows} onUndo={() => undoSend()} />
        </div>
      ) : (
        <>
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
              <textarea className="text-input m f7-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
            ) : (
              <p className="m f7-mail" lang={draft.language}>
                {d.text}
              </p>
            )}
            {d.foreign && !d.editing && (
              <div className="f7-english">
                <button type="button" className="link" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
                  In English
                  <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
                </button>
                {d.english && (
                  <p className="m quiet f7-mail f7-en" lang="en">
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

/** After: the same log in the card, from the case's own steps once the agent has carried it out. */
export function AgentFeedDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const back = useCaseBack(caseId, true)
  useDefaultKey(() => router.push(nextHref ?? "/tasks"))
  const sent = option.draft ? recipient(option.draft.to) : null
  const place = back.place ?? "the pickup place"
  const rows: Row[] = [{ state: "done", text: `${done.personName} decided`, sub: `${option.label}, at ${done.timeWords}` }]
  if (sent) rows.push({ state: "done", text: `The ${sent.email ? "email" : "message"} to ${sent.name}`, sub: `Sent at ${done.timeWords}, in ${languageName(option.draft!.language)}` })
  if (back.steps.length) {
    for (const s of back.steps) rows.push({ state: "done", text: s.summary })
    if (!back.done) rows.push({ state: "live", text: "The agent is still at work" })
  } else {
    rows.push({ state: "live", text: `The agent calls ${place}`, sub: "To tell them what was decided" })
    for (const p of agentPlan(option)) rows.push({ state: "next", text: p })
  }
  if (back.count && !back.count.differ) rows.push({ state: "done", text: `${back.count.kind}, ${back.count.line}`, sub: back.count.first ? "The first answer to this kind. The agent learns from it." : "The agent learns from every answer." })
  return (
    <section className="question lab-decide-07 f7-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <div className="f7-card-log">
        <Log rows={rows} />
      </div>
      <div className="answers">
        <Link href={nextHref ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {nextHref ? "Next case" : "Back to your tasks"}
        </Link>
      </div>
    </section>
  )
}
