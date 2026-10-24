"use client"

import "./send-and-next.css"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { agentPlan, type DoneProps, type PreviewProps, recipient, useCaseId } from "../_shared/helpers"
import { pauseSend, startSend, undoSend, useSendWindow, WINDOW_S, type SendState } from "../_shared/send-window"
import { useDraft } from "../_shared/use-draft"

const PREF = "lab-decide-06-after-send"
const readPref = (): "next" | "stay" => {
  try {
    return localStorage.getItem(PREF) === "stay" ? "stay" : "next"
  } catch {
    return "next"
  }
}
const writePref = (v: "next" | "stay") => {
  try {
    localStorage.setItem(PREF, v)
  } catch {}
}

/**
 * decide 06: Send and next. The send button carries what happens after it (Zendesk's Submit menu):
 * "Send and next" by default, "Send and stay" one tap away. The next case opens at once
 * (Superhuman: "as soon as you action an email, you'll immediately move to the next"), and the
 * undo toast moves with you: Undo brings the email back on its own case.
 */
export function SendAndNextPreview({ draft, subject, verb, pending, error, onSend, returnFocus }: PreviewProps) {
  const { open, setOpen, slot } = usePanel()
  const caseId = useCaseId()
  const router = useRouter()
  const path = usePathname() ?? ""
  const params = useSearchParams()
  const needs = useNeedsYou()
  const shown = open === "email"
  const close = useRef<HTMLButtonElement>(null)
  const d = useDraft(draft, shown)
  const [menu, setMenu] = useState(false)
  const [pref, setPref] = useState<"next" | "stay">("next")
  const next = needs.rows.find((r, i) => i > needs.index && r.caseId !== caseId) ?? needs.rows.find((r) => r.caseId !== caseId)

  useEffect(() => setPref(readPref()), [])
  useEffect(() => {
    if (shown) close.current?.focus({ preventScroll: true })
    else setMenu(false)
  }, [shown])
  useEffect(() => ensureToast(), [])

  if (!slot) return null
  const cancel = () => (setOpen(null), returnFocus())
  const send = (how: "next" | "stay") => {
    setMenu(false)
    if (how !== pref) (setPref(how), writePref(how))
    const q = new URLSearchParams(params?.toString() ?? "")
    q.set("panel", "email")
    q.delete("send")
    const back = `${path}?${q.toString()}`
    const moving = how === "next" && !!next
    startSend({ caseId, ...d.who, back: moving ? back : undefined }, () => onSend(d.out), moving ? () => router.push(back) : () => setOpen("email"))
    setOpen(null)
    if (moving) router.push(needs.href(next.caseId))
    else returnFocus()
  }
  const label = verb.replace(/\s+the\s+(email|message)$/i, "") || "Send"

  return createPortal(
    <aside id="email" className={`panel send-panel lab-decide-06${shown ? " open" : ""}`} aria-label={`The ${d.noun}`} aria-hidden={!shown} inert={!shown}>
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
              <dd>{languageName(draft.language)}</dd>
            </>
          )}
        </dl>
        {d.editing ? (
          <textarea className="text-input m n6-edit" lang={draft.language} value={d.text} onChange={(e) => d.setText(e.target.value)} aria-label="The text" autoFocus />
        ) : (
          <p className="m n6-text" lang={draft.language}>
            {d.text}
          </p>
        )}
        {d.foreign && !d.editing && (
          <div className="n6-english">
            <button type="button" className="link" aria-expanded={d.english} onClick={() => d.setEnglish(!d.english)}>
              In English
              <Icon name={d.english ? "chevron-down" : "chevron-right"} size={16} />
            </button>
            {d.english && (
              <p className="m quiet n6-text n6-en" lang="en">
                {d.edited ? "The English is of the agent's text, before your change. " : ""}
                {draft.translation}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="send-foot">
        {error && <p className="s now">{error}</p>}
        {next && (
          <p className="s n6-then">{pref === "next" ? `Then ${next.vehicle}, ${next.place} opens` : "You stay on this case"}</p>
        )}
        <div className="send-actions">
          <div className="n6-split">
            <button type="button" className="btn btn-primary n6-main" disabled={pending || !d.text.trim()} onClick={() => send(next ? pref : "stay")}>
              {label}
            </button>
            {next && (
              <button type="button" className="btn btn-primary n6-more" aria-label="When it is sent" aria-haspopup="menu" aria-expanded={menu} disabled={pending} onClick={() => setMenu(!menu)}>
                <Icon name="chevron-up" size={18} />
              </button>
            )}
            {menu && next && (
              <div className="n6-menu" role="menu">
                <button type="button" role="menuitemradio" aria-checked={pref === "next"} onClick={() => send("next")}>
                  <span className="n6-mk">{pref === "next" && <Icon name="check" size={16} />}</span>
                  <span>
                    {label} and next case
                    <span className="n6-sub">
                      {next.vehicle}, {next.place}
                    </span>
                  </span>
                </button>
                <button type="button" role="menuitemradio" aria-checked={pref === "stay"} onClick={() => send("stay")}>
                  <span className="n6-mk">{pref === "stay" && <Icon name="check" size={16} />}</span>
                  <span>
                    {label} and stay
                    <span className="n6-sub">Watch the agent carry it out</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-plain" disabled={pending} onClick={() => d.setEditing(!d.editing)}>
            {d.editing ? "Done" : "Edit"}
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

// ---- The toast that survives the move to the next case: its own small React root on <body>.

let root: Root | null = null
function ensureToast() {
  if (root || typeof document === "undefined") return
  const el = document.createElement("div")
  el.className = "lab-decide-06-root"
  document.body.appendChild(el)
  root = createRoot(el)
  root.render(<MovingToast />)
}

function MovingToast() {
  const live = useSendWindow()
  // Lab photo state: ?send=wait&sent=<caseId> on the next case shows the toast as it looks there.
  const [frozen, setFrozen] = useState<SendState | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const sent = q.get("sent")
    if (q.get("send") !== "wait" || !sent) return
    fetch(`/api/cr/cases/${encodeURIComponent(sent)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const to = d?.case?.suggestion?.draft?.to
        if (!to) return
        const who = recipient(to)
        setFrozen({ caseId: sent, to: who.name, how: who.how, email: who.email, seconds: WINDOW_S, left: 7, paused: false, phase: "wait", frozen: true })
      })
      .catch(() => {})
  }, [])
  const win = frozen ?? live
  if (!win) return null
  const waiting = win.phase === "wait"
  const noun = win.email ? "Email" : "Message"
  return (
    <div className="lab-decide-06 n6-toast" role="status" aria-live="polite">
      <Icon name={waiting ? "arrow-up" : "check"} size={18} />
      <span className="n6-toast-text">
        {noun} {waiting ? "to" : "sent to"} {win.to}
        {waiting ? <span className="n6-toast-q"> goes in {Math.max(1, Math.ceil(win.left))} s</span> : null}
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
    </div>
  )
}

/**
 * After a decision on a case you stayed on: the next case opens by itself in 5 s (Superhuman), with
 * Stay here one tap away. In the lab's photo state the count stands still and nothing moves.
 */
export function SendAndNextDone({ headline, option, done, nextHref }: DoneProps) {
  const router = useRouter()
  const lab = useLab()
  const needs = useNeedsYou()
  const [stay, setStay] = useState(false)
  const [left, setLeft] = useState(5)
  const sent = option.draft ? recipient(option.draft.to) : null
  const nextId = nextHref ? decodeURIComponent(nextHref.split("?")[0].split("/")[2] ?? "") : ""
  const next = needs.rows.find((r) => r.caseId === nextId)
  const auto = !!nextHref && !stay && !lab.decided && readPref() === "next"
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [auto])
  useEffect(() => {
    if (auto && left <= 0 && nextHref) router.push(nextHref)
  }, [auto, left, nextHref, router])
  const showCount = !!nextHref && !stay
  const shownLeft = lab.decided ? 3 : Math.max(0, left)
  return (
    <section className="question lab-decide-06 n6-done" aria-live="polite">
      <p className="m due">
        {sent ? `${sent.email ? "Email" : "Message"} sent to ${sent.name}` : "Decided"} by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <p className="l ask">{option.label}.</p>
      <p className="m quiet context">{(sent ? agentPlan(option) : [option.effect]).join(" ")}</p>
      {showCount ? (
        <div className="n6-next" role="status">
          <span className="n6-bar" aria-hidden>
            <span style={{ transform: `scaleX(${1 - shownLeft / 5})` }} />
          </span>
          <p className="m">
            {next ? `${next.vehicle}, ${next.place}` : "The next case"} <span className="quiet">opens in {shownLeft} s</span>
          </p>
          <div className="answers n6-next-actions">
            <Link href={nextHref!} className="btn btn-primary">
              Open now
            </Link>
            <button type="button" className="btn btn-plain" onClick={() => setStay(true)}>
              Stay here
            </button>
          </div>
        </div>
      ) : (
        <div className="answers">
          <Link href={nextHref ?? "/tasks"} className="btn btn-primary">
            {nextHref ? "Next case" : "Back to your tasks"}
          </Link>
        </div>
      )}
    </section>
  )
}
