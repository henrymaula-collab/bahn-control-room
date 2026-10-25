"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
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

function Receipt({ win, caseId }: { win: SendWin; caseId: string }) {
  const { href } = useNextCase()
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
  const more = [win.calls ? `Next, the agent calls ${win.calls}.` : "", withoutBareTimes(win.next ?? "")].filter(Boolean).join(" ")
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
