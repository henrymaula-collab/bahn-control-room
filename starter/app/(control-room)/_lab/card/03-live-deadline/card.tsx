"use client"

// card 03: the deadline as a Live Activity: the time and what is left, large enough to read at a
// glance, and a bar that drains through the last hour. Red only inside that hour.

import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, leftWords, useCard, useMinutesLeft, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

const HOUR = 60 // the app's own "within the hour" (format.ts NOW_WINDOW_MINUTES)

export function LiveDeadline(props: CardProps) {
  const q = useCard(props)
  const left = useMinutesLeft(props.caseId)
  if (q.done) return <CardDone props={props} q={q} />
  const due = props.due
  const urgent = !!due?.now
  const share = left == null ? 1 : Math.max(0, Math.min(1, left / HOUR))

  return (
    <section className="lab-card lab-card-03" aria-labelledby={`q-${props.caseId}`}>
      {due && (
        <div className={`c03-live${urgent ? " now" : ""}`} role="timer" aria-live="off">
          <div className="c03-row">
            <p className="c03-by">
              {urgent && <span className="lc-dot" aria-hidden="true" />}
              {due.text}
            </p>
            {left != null && <p className="c03-left">{left <= 0 ? "Time is up" : `${leftWords(left)} left`}</p>}
          </div>
          {urgent && (
            <div className="c03-track" aria-hidden="true">
              <span className="c03-fill" style={{ transform: `scaleX(${share})` }} />
            </div>
          )}
        </div>
      )}
      <h1 className="lc-what c03-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c03-ask">{q.ask}</p>
      <div className="lc-acts c03-acts">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          aria-expanded={q.preview ? q.panel.open === "email" : undefined}
          aria-controls={q.preview ? "email" : undefined}
          onClick={q.onPrimary}
        >
          {q.answer}
        </button>
        {props.alternatives.length > 0 && (
          <button type="button" className="btn btn-plain" disabled={q.pending} onClick={() => q.openSheet()}>
            Other options
          </button>
        )}
      </div>
      {props.next && <p className="lc-next c03-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
