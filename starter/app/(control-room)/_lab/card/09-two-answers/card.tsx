"use client"

// card 09: two answers side by side, each with what it does (HEY's Screener asks a yes-or-no with
// two equal answers; Stripe Radar writes each closing action's consequence). The suggestion is
// the filled one; a third option waits behind "More options".

import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, sentences, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function TwoAnswers(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />

  const second = props.alternatives[0]
  const rest = props.alternatives.length - 1
  const first = (t?: string) => sentences(t)[0] ?? ""

  return (
    <section className="lab-card lab-card-09" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c09-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c09-ask">{q.ask}</p>
      <div className={`c09-pair${second ? "" : " one"}`}>
        <div className="c09-answer">
          <button
            ref={q.primary}
            type="button"
            className="btn btn-primary"
            disabled={q.pending}
            aria-describedby={`c09-a-${props.caseId}`}
            aria-expanded={q.preview ? q.panel.open === "email" : undefined}
            aria-controls={q.preview ? "email" : undefined}
            onClick={q.onPrimary}
          >
            {q.answer}
          </button>
          <p className="c09-what-then" id={`c09-a-${props.caseId}`}>
            {first(props.next ?? props.suggestion.effect)}
          </p>
        </div>
        {second && (
          <div className="c09-answer">
            <button type="button" className="btn btn-secondary" disabled={q.pending} aria-describedby={`c09-b-${props.caseId}`} onClick={() => q.openSheet(second)}>
              {q.verbOf(second)}
            </button>
            <p className="c09-what-then" id={`c09-b-${props.caseId}`}>
              {first(second.effect)}
            </p>
          </div>
        )}
      </div>
      {rest > 0 && (
        <button type="button" className="lc-link c09-more" onClick={() => q.openSheet()}>
          {rest === 1 ? "One more option" : `${rest} more options`}
        </button>
      )}
      <CardTail props={props} q={q} />
    </section>
  )
}
