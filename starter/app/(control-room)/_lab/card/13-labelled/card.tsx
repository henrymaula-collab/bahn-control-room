"use client"

// card 13: for a newcomer, each block says what it is in a small grey line (Claude in Chrome's
// plan approval: "Allow actions on these sites:", "Approach to follow:"), so the card reads as
// what is wrong, what the agent suggests, what happens after.

import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function Labelled(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />

  return (
    <section className="lab-card lab-card-13" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <div className="c13-block">
        <p className="lc-label" id={`c13-l1-${props.caseId}`}>
          What is wrong
        </p>
        <h1 className="lc-what c13-what" id={`q-${props.caseId}`}>
          <Keep text={props.headline} />
        </h1>
      </div>
      <div className="c13-block">
        <p className="lc-label">The agent suggests</p>
        <p className="lc-ask c13-ask">{q.ask}</p>
        <div className="lc-acts c13-acts">
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
      {props.next && (
        <div className="c13-block">
          <p className="lc-label">After that</p>
          <p className="c13-next">{props.next}</p>
        </div>
      )}
      <CardTail props={props} q={q} />
    </section>
  )
}
