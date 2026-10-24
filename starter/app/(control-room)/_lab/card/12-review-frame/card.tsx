"use client"

// card 12: the case as a review page (Stripe Radar's payment review, Zendesk's ticket): a header
// that names the car and the order with the deadline on the right, the situation and the question,
// and a footer bar where the answer sits at the trailing edge, Apple's place for the default.

import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function ReviewFrame(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />
  const [car, ref] = (props.subject ?? "").split(/,\s*/)

  return (
    <section className="lab-card lab-card-12" aria-labelledby={`q-${props.caseId}`}>
      <header className="c12-head">
        <p className="c12-car">
          <span className="c12-name">{car}</span>
          {ref && <span className="c12-ref">{ref}</span>}
        </p>
        <Due due={props.due} />
      </header>
      <div className="c12-body">
        <h1 className="lc-what c12-what" id={`q-${props.caseId}`}>
          <Keep text={props.headline} />
        </h1>
        <p className="lc-ask c12-ask">{q.ask}</p>
      </div>
      <footer className="c12-foot">
        {props.next && <p className="lc-next c12-next">{props.next}</p>}
        <div className="c12-bar">
          {props.alternatives.length > 0 ? (
            <button type="button" className="btn btn-plain" disabled={q.pending} onClick={() => q.openSheet()}>
              Other options
            </button>
          ) : (
            <span />
          )}
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
        </div>
      </footer>
      <CardTail props={props} q={q} />
    </section>
  )
}
