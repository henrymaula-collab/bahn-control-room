"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { AgentStep } from "@/lib/control-room/types"
import { createPortal } from "react-dom"
import { withoutBareTimes } from "./card-line"
import { clearSend, sentWhat, type SendWin, useSendWindow } from "./email-send"
import { Icon } from "./icons"
import { useNextCase, usePanel } from "./work-frame"

/**
 * After a decision taken in Talk it through (lab decide:08, Henry h48): the side panel becomes the
 * receipt. One title, one grey sentence with what went where and when, what the agent does next, and
 * the two ways on: In History, and Next case as the one filled button. Closing it shows the panel
 * underneath again (the conversation, with its "Decided at" line).
 */
export function EmailReceipt({ caseId }: { caseId: string }) {
  const win = useSendWindow(caseId)
  const { slot } = usePanel()
  if (!slot || !win || win.phase !== "sent" || !win.receipt) return null
  return createPortal(<Receipt win={win} caseId={caseId} />, slot)
}

type Back = { case: { status: string; agentSteps: AgentStep[] } }

/** The agent's call-back after the decision, once it has run (the case read back a few times, as the card does). */
function useCallBack(caseId: string): { done: boolean; call?: AgentStep } {
  const [back, setBack] = useState<{ done: boolean; call?: AgentStep }>({ done: false })
  useEffect(() => {
    let alive = true
    let n = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () =>
      fetch(`/api/cr/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Back>) : null))
        .then((d) => {
          if (!alive || !d) return
          const steps = d.case.agentSteps ?? []
          // The steps after the agent's last proposal are what it did once the person decided.
          let at = -1
          steps.forEach((s, i) => s.kind === "propose" && !/^Brought a person/.test(s.summary) && (at = i))
          const call = at >= 0 ? steps.slice(at + 1).find((s) => s.kind === "call") : undefined
          setBack({ done: d.case.status === "done", call })
          if (!call && d.case.status !== "done" && n++ < 8) timer = setTimeout(load, 1500)
        })
        .catch(() => {})
    load()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [caseId])
  return back
}

function Receipt({ win, caseId }: { win: SendWin; caseId: string }) {
  const { href } = useNextCase()
  const back = useCallBack(caseId)
  const next = useRef<HTMLAnchorElement>(null)
  const close = () => clearSend(caseId)
  useEffect(() => {
    next.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (e.stopPropagation(), close())
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const title = `${win.noun === "email" ? "Email" : "Message"} sent`
  // Before the call-back: what the agent does next. After it: what it did, in its own words (past tense).
  const plan = withoutBareTimes(win.next ?? "")
  const more = back.call
    ? [withoutBareTimes(back.call.summary), plan].filter(Boolean).join(" ")
    : [!back.done && win.calls ? `Next, the agent calls ${win.calls}.` : "", plan].filter(Boolean).join(" ")
  return (
    <aside className="panel send-panel email-receipt open" aria-label={title}>
      <div className="panel-head receipt-head">
        <h2 className="receipt-title">{title}</h2>
        <button type="button" className="close" aria-label="Close" onClick={close}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="receipt-body" role="status" aria-live="polite">
        <p className="receipt-line">
          {sentWhat(win)}, at {win.at}.
        </p>
        {more && <p className="receipt-more">{more}</p>}
      </div>
      <div className="receipt-foot">
        <Link href={`/history?open=${encodeURIComponent(caseId)}`} className="btn btn-secondary" onClick={close}>
          In History
        </Link>
        <Link ref={next} href={href ?? "/tasks"} className="btn btn-primary" onClick={close}>
          {href ? "Next case" : "Your tasks"}
        </Link>
      </div>
    </aside>
  )
}
