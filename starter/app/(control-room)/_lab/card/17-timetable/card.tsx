"use client"

// card 17: Timetable. The deadline organises the card. A time column runs down its left side like a
// line on a timetable: now (the situation), the decide-by time (the question and the answer, the
// hour between the two drawn as the line), then what follows (the next line). The minutes left
// count down beside the deadline while the card is open.

import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, leftWords, useCard, useMinutesLeft, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

/** "13:00" less 60 minutes -> "12:00"; null for a time with a day in it ("Tue 09:00"). */
function clockMinus(at: string, minutes: number) {
  const m = at.match(/^(\d\d):(\d\d)$/)
  if (!m) return null
  const t = (((Number(m[1]) * 60 + Number(m[2]) - minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

export function Timetable(props: CardProps) {
  const q = useCard(props)
  const left = useMinutesLeft(props.caseId)
  if (q.done) return <CardDone props={props} q={q} />

  const due = props.due
  const past = !!due && /^Was due/.test(due.text)
  const at = due?.text.replace(/^(Decide by|Was due at)\s+/, "")
  const now = at && left != null && !past ? clockMinus(at, left) : null
  const urgent = !!due?.now

  return (
    <section className="lab-card lab-card-17" aria-labelledby={`q-${props.caseId}`}>
      <ol className="c17-line">
        <li className="c17-stop c17-now">
          <p className="c17-time">
            <time>{now ?? "Now"}</time>
            {now && <span>Now</span>}
          </p>
          <div className="c17-body">
            <h1 className="c17-what" id={`q-${props.caseId}`}>
              <Keep text={props.headline} />
            </h1>
          </div>
        </li>
        <li className={`c17-stop c17-due${urgent ? " urgent" : ""}`}>
          <p className="c17-time">
            {at ? (
              <>
                <time className={urgent ? "lc-due now" : "lc-due"}>{at}</time>
                <span>{past ? "Past due" : left != null ? (left <= 0 ? "Now" : `in ${leftWords(left)}`) : "Decide by"}</span>
              </>
            ) : (
              <span>Your answer</span>
            )}
          </p>
          <div className="c17-body">
            <p className="c17-ask">{q.ask}</p>
            <div className="lc-acts c17-acts">
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
          </div>
        </li>
        {props.next && (
          <li className="c17-stop c17-then">
            <p className="c17-time">
              <span>Then</span>
            </p>
            <div className="c17-body">
              <p className="lc-next c17-next">{props.next}</p>
            </div>
          </li>
        )}
      </ol>
      <CardTail props={props} q={q} />
    </section>
  )
}
