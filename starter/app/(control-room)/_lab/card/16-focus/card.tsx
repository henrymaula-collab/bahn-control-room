"use client"

// card 16: Focus. The question owns the screen. The situation panel steps back (it is the
// default panel, so in focus it waits off screen; the inspector button at the top right brings it
// back, the way Pages or Finder show their inspector), the card centres in the whole work area and
// the question is the one large line. The email and the chat still open beside it as before.

import { useState } from "react"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

// A date ("Tue 27 Oct") and a model name ("S-Class") stay on one line in the centred, balanced text.
const DATE = /((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/
function Whole({ text }: { text: string }) {
  return (
    <>
      {text.split(DATE).map((part, i) =>
        i % 2 ? (
          <span key={i} className="c16-whole">
            {part}
          </span>
        ) : (
          <Keep key={i} text={part} />
        ),
      )}
    </>
  )
}

export function Focus(props: CardProps) {
  const q = useCard(props)
  const [inspect, setInspect] = useState(false)
  if (q.done) return <CardDone props={props} q={q} />

  // Only the situation steps back; when the person opens the email or the chat, those show as today.
  const hasSituation = q.panel.open === "situation"
  const focus = hasSituation && !inspect

  return (
    <section className={`lab-card lab-card-16${focus ? " c16-focus" : ""}`} aria-labelledby={`q-${props.caseId}`}>
      {hasSituation && (
        <button
          type="button"
          className="c16-inspector"
          aria-pressed={!focus}
          aria-controls="situation"
          title={focus ? "Show the situation" : "Hide the situation"}
          onClick={() => setInspect((v) => !v)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
            <path d="M14.5 4.5v15" />
            <rect className="c16-pane" x="14.5" y="4.5" width="6.5" height="15" rx="0" />
          </svg>
          <span>Situation</span>
        </button>
      )}
      <div className="c16-stage">
        <Due due={props.due} className="c16-due" />
        <p className="c16-what">
          <Whole text={props.headline} />
        </p>
        <h1 className="c16-ask" id={`q-${props.caseId}`}>
          <Whole text={q.ask} />
        </h1>
        <div className="lc-acts c16-acts">
          {props.alternatives.length > 0 && (
            <button type="button" className="btn btn-plain" disabled={q.pending} onClick={() => q.openSheet()}>
              Other options
            </button>
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
        {props.next && <p className="lc-next c16-next">{props.next}</p>}
      </div>
      <CardTail props={props} q={q} />
    </section>
  )
}
