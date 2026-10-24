"use client"

// card 19: Mac alert. The card drawn as a macOS alert at its best (HIG Alerts, macOS): a panel
// that floats over the page, the app's icon (Bahn's mark) in its own column, the question as the
// bold message, the situation as the informative text, an accessory "Details" disclosure with the
// first-hand words behind it, and the buttons on the trailing edge: "Other options…" (the ellipsis
// says more input follows) and the default last, which also answers Return.

import { useEffect, useRef, useState } from "react"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, recordLine, sourceQuote, useCard, useCaseData, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

const MARK =
  "M15.2105 0C18.2887 0 20.7841 2.49479 20.7841 5.57175C20.784 8.64861 18.2886 11.1431 15.2105 11.1431H5.57817C5.1046 11.1431 4.7207 11.5268 4.7207 12.0002C4.72081 12.4735 5.10467 12.8573 5.57817 12.8573H18.426C21.5042 12.8573 23.9996 15.3517 23.9996 18.4287C23.9995 21.5055 21.5041 24 18.426 24H0V19.2858H18.426C18.8995 19.2858 19.2834 18.902 19.2835 18.4287C19.2835 17.9553 18.8996 17.5715 18.426 17.5715H5.57817C2.50005 17.5715 0.0047187 15.0771 0.00460556 12.0002C0.00460556 8.92325 2.49998 6.42888 5.57817 6.42888H15.2105C15.684 6.42888 16.0679 6.04503 16.068 5.57175C16.068 5.09837 15.6841 4.71462 15.2105 4.71462H0.00125606V0H15.2105Z"

const typing = (el: Element | null) => !!el && !!el.closest("input, textarea, select, [contenteditable], dialog")

export function MacAlert(props: CardProps) {
  const q = useCard(props)
  const [details, setDetails] = useState(false)
  const { data, loading } = useCaseData(props.caseId, details)
  const panel = useRef<HTMLDivElement>(null)

  // Return answers with the default button, as in every Mac alert, when nothing else has the keyboard.
  const onPrimary = q.onPrimary
  const busy = q.pending || q.sheetOpen || !!q.done
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || busy) return
      const at = document.activeElement
      const free = !at || at === document.body || at === panel.current
      if (!free || typing(at)) return
      e.preventDefault()
      onPrimary()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPrimary, busy])

  if (q.done) return <CardDone props={props} q={q} />
  const quote = sourceQuote(data)
  const record = recordLine(data)

  return (
    <section className="lab-card lab-card-19" aria-labelledby={`q-${props.caseId}`}>
      <div className="c19-panel" ref={panel} tabIndex={-1}>
        <span className="c19-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d={MARK} />
          </svg>
        </span>
        <div className="c19-body">
          <Due due={props.due} className="c19-due" />
          <h1 className="c19-ask" id={`q-${props.caseId}`}>
            {q.ask}
          </h1>
          <p className="c19-what">
            <Keep text={props.headline} />
          </p>
          {props.next && <p className="lc-next c19-next">{props.next}</p>}
          {details && (
            <div className="c19-accessory" id={`c19-d-${props.caseId}`}>
              {loading && !data && <p className="c19-quiet">Loading what the agent found</p>}
              {quote && (
                <figure className="c19-quote">
                  <blockquote>“{quote.text}”</blockquote>
                  <figcaption>
                    {quote.who}, {quote.how} at {quote.at}
                  </figcaption>
                </figure>
              )}
              {record && <p className="c19-quiet">{record}</p>}
              {data && !quote && !record && <p className="c19-quiet">Nothing more on file for this case.</p>}
            </div>
          )}
        </div>
        <div className="c19-foot">
          <button
            type="button"
            className="c19-disclose"
            aria-expanded={details}
            aria-controls={`c19-d-${props.caseId}`}
            onClick={() => setDetails((v) => !v)}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              <path d="M4 2.5 8 6l-4 3.5z" />
            </svg>
            Details
          </button>
          <div className="c19-buttons">
            {props.alternatives.length > 0 && (
              <button type="button" className="btn btn-secondary" disabled={q.pending} onClick={() => q.openSheet()}>
                Other options…
              </button>
            )}
            <button
              ref={q.primary}
              type="button"
              className="btn btn-primary"
              disabled={q.pending}
              title="Return"
              aria-keyshortcuts="Enter"
              aria-expanded={q.preview ? q.panel.open === "email" : undefined}
              aria-controls={q.preview ? "email" : undefined}
              onClick={q.onPrimary}
            >
              {q.answer}
            </button>
          </div>
        </div>
      </div>
      <CardTail props={props} q={q} />
    </section>
  )
}
