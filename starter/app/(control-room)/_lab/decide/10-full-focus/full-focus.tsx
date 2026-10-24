"use client"

import "./full-focus.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseId, useDefaultKey } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useFrozen, useSendView, type SendState, useSendError } from "../_shared/send-window"
import { useColumn, useDraft } from "../_shared/use-draft"

/** Where the page's frame (the white sheet right of the side menu) is, to lay the letter over it. */
function useFrame(on: boolean) {
  const [r, setR] = useState<{ top: number; left: number; width: number; height: number; radius: string } | null>(null)
  useEffect(() => {
    if (!on) return
    const el = document.querySelector<HTMLElement>(".main") ?? document.querySelector<HTMLElement>(".work")
    if (!el) return
    const measure = () => {
      const b = el.getBoundingClientRect()
      setR({ top: b.top, left: b.left, width: b.width, height: b.height, radius: getComputedStyle(el).borderRadius })
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [on])
  return r
}

/**
 * decide 10: Full focus. The email takes the whole page frame, set at reading width like a letter,
 * the German in a reading size; Esc goes back. Send lifts the letter away and a slim Undo strip
 * waits at the top of the card. After the decision the card shows what is left in the line.
 */
export function FullFocusPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen } = usePanel()
  const caseId = useCaseId()
  useSendError(caseId, error)
  const frozen = useFrozen()
  const [shown, setShown] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const d = useDraft(draft, shown)
  const win = useSendView(caseId, d.who)
  const frame = useFrame(shown)
  const sendBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open !== "email") return
    setOpen(null)
    if (!frozen) setShown(true)
  }, [open, setOpen, frozen])
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (e.preventDefault(), setShown(false), returnFocus())
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.preventDefault(), sendBtn.current?.click())
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [shown, returnFocus])

  const cancel = () => (setShown(false), returnFocus())
  const send = () => {
    startSend({ caseId, ...d.who }, () => onSend(d.out), () => setShown(true))
    setLeaving(true)
    setTimeout(() => (setShown(false), setLeaving(false)), 260)
  }
  const label = "Send"

  return (
    <>
      {shown &&
        frame &&
        createPortal(
          <div
            className={`lab-decide-10 f10-focus${leaving ? " is-leaving" : ""}`}
            style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height, borderRadius: frame.radius }}
            role="dialog"
            aria-modal="true"
            aria-label={`The ${d.noun}`}
          >
            <div className="f10-top">
              <button type="button" className="f10-back" onClick={cancel}>
                <Icon name="chevron-left" size={18} />
                Back to the case
              </button>
              <span className="f10-esc">Esc</span>
            </div>
            <div className="f10-scroll">
              <article className="f10-letter">
                <p className="f10-meta">
                  To {d.who.name}
                  {d.who.how && <span className="f10-q">, {d.who.how}</span>}
                </p>
                {subject && <p className="f10-meta f10-q">{subject}</p>}
                <p className="f10-meta f10-lang">
                  {d.english ? (
                    <span className="f10-q">English, for you to read. It goes out in {languageName(draft.language)}.</span>
                  ) : (
                    <span className="f10-q">In {languageName(draft.language)}</span>
                  )}
                  {d.foreign && !d.editing && (
                    <button type="button" className="link f10-en" aria-pressed={d.english} onClick={() => d.setEnglish(!d.english)}>
                      {d.english ? `Back to ${languageName(draft.language)}` : "In English"}
                      <Icon name="chevron-right" size={16} />
                    </button>
                  )}
                </p>
                {d.editing ? (
                  <textarea className="f10-text f10-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
                ) : (
                  <p key={d.english ? "en" : "src"} className="f10-text" lang={d.english ? "en" : draft.language}>
                    {d.english ? `${d.edited ? "The English is of the agent's text, before your change. " : ""}${draft.translation}` : d.text}
                  </p>
                )}
              </article>
            </div>
            <div className="f10-foot">
              {error && <p className="s now">{error}</p>}
              <div className="f10-actions">
                <button ref={sendBtn} type="button" className="btn btn-primary" disabled={pending || !d.text.trim()} onClick={send} aria-keyshortcuts="Meta+Enter">
                  {label}
                </button>
                <button type="button" className="btn btn-plain" disabled={pending} onClick={() => (d.setEnglish(false), d.setEditing(!d.editing))}>
                  {d.editing ? "Done" : "Edit"}
                </button>
                <button type="button" className="btn btn-plain" disabled={pending} onClick={cancel}>
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {win && <Strip win={win} noun={d.noun} pending={pending} />}
    </>
  )
}

/** The slim strip at the top of the card while the email can still be taken back. */
function Strip({ win, noun, pending }: { win: SendState; noun: string; pending: boolean }) {
  const rect = useColumn()
  if (typeof document === "undefined" || !rect) return null
  const waiting = win.phase === "wait"
  return createPortal(
    <div className="lab-decide-10 f10-strip" style={{ left: rect.left + rect.width / 2 }} role="status" aria-live="polite">
      <Icon name={waiting ? "arrow-up" : "check"} size={16} />
      <span>
        {waiting ? `The ${noun} to ${win.to} goes in ${Math.max(1, Math.ceil(win.left))} s` : `${noun === "email" ? "Email" : "Message"} sent to ${win.to}${pending ? "" : "."}`}
      </span>
      {waiting && (
        <button
          type="button"
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
    </div>,
    document.body,
  )
}

/** After: what is left in the line (HEY's Focus & Reply), the next one first and one tap away. */
export function FullFocusDone({ option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const caseId = useCaseId()
  const needs = useNeedsYou()
  useDefaultKey(() => router.push(nextHref ?? "/"))
  const sent = option.draft ? recipient(option.draft.to) : null
  const left = needs.rows.filter((r) => r.caseId !== caseId)
  const nextId = nextHref ? decodeURIComponent(nextHref.split("?")[0].split("/")[2] ?? "") : ""
  const ordered = [...left.filter((r) => r.caseId === nextId), ...left.filter((r) => r.caseId !== nextId)]
  const shown = ordered.slice(0, 4)
  const more = ordered.length - shown.length
  const next = ordered[0]
  const plan = sent ? agentPlan(option)[0] : option.effect
  return (
    <section className="question lab-decide-10 f10-done" aria-live="polite">
      <p className="m f10-receipt">
        <span className="f10-tick" aria-hidden>
          <Icon name="check" size={14} />
        </span>
        <span>
          {sent ? `${sent.email ? "Email" : "Message"} sent to ${sent.name}` : "Decided"} by {done.personName} at {done.timeWords}.
          {plan ? <span className="quiet"> {plan}</span> : null}
        </span>
      </p>
      <h1 className="l what f10-left">{ordered.length === 0 ? "That was the last one" : ordered.length === 1 ? "One case left" : `${ordered.length} cases left`}</h1>
      {shown.length > 0 && (
        <ul className="f10-line">
          {shown.map((r, i) => {
            const t = needs.times[r.caseId]
            return (
              <li key={r.caseId}>
                <Link href={needs.href(r.caseId)} className={`f10-row${i === 0 ? " is-next" : ""}`}>
                  <span className="f10-car">{r.vehicle}</span>
                  <span className="f10-place">{r.place}</span>
                  {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {more > 0 && <p className="s f10-more">and {more} more in Your tasks</p>}
      <div className="answers">
        {next ? (
          <Link href={nextHref ?? needs.href(next.caseId)} className="btn btn-primary" aria-keyshortcuts="Enter">
            Open the {next.vehicle}
          </Link>
        ) : (
          <Link href="/" className="btn btn-primary">
            Back to the Overview
          </Link>
        )}
      </div>
    </section>
  )
}
