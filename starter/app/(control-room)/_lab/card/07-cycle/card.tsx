"use client"

// card 07: the options in place (Superhuman Instant Reply: Tab previews the next draft where the
// reply will go). The arrows swap the question, the answer and the next line together; the
// agent's suggestion is always where you start and the one you come back to.

import { useState } from "react"
import { Icon } from "../../../_ui/icons"
import { questionFor } from "../../../_ui/ask"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function Cycle(props: CardProps) {
  const q = useCard(props)
  const [i, setI] = useState(0)
  if (q.done) return <CardDone props={props} q={q} />

  const all = [props.suggestion, ...props.alternatives]
  const o = all[i] ?? props.suggestion
  const isSuggestion = i === 0
  const go = (d: number) => setI((x) => (x + d + all.length) % all.length)
  const next = isSuggestion ? (props.next ?? o.effect) : o.effect

  return (
    <section
      className="lab-card lab-card-07"
      aria-labelledby={`q-${props.caseId}`}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("dialog, input, textarea")) return
        if (e.key === "ArrowRight") (e.preventDefault(), go(1))
        if (e.key === "ArrowLeft") (e.preventDefault(), go(-1))
      }}
    >
      <Due due={props.due} />
      <h1 className="lc-what c07-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>

      {all.length > 1 && (
        <div className="c07-switch">
          <p className="lc-label" aria-live="polite">
            {isSuggestion ? "The agent suggests" : "Instead of the suggestion"}
          </p>
          <div className="c07-arrows">
            <span className="c07-count">
              {i + 1} of {all.length}
            </span>
            <button type="button" aria-label="Previous option" onClick={() => go(-1)}>
              <Icon name="chevron-left" size={18} />
            </button>
            <button type="button" aria-label="Next option" onClick={() => go(1)}>
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="c07-shown" key={o.id}>
        <p className="lc-ask c07-ask">{questionFor(o)}</p>
        <div className="lc-acts c07-acts">
          <button
            ref={isSuggestion ? q.primary : undefined}
            type="button"
            className={`btn ${isSuggestion ? "btn-primary" : "btn-secondary"}`}
            disabled={q.pending}
            aria-expanded={isSuggestion && q.preview ? q.panel.open === "email" : undefined}
            aria-controls={isSuggestion && q.preview ? "email" : undefined}
            onClick={() => q.choose(o)}
          >
            {q.verbOf(o)}
          </button>
          {!isSuggestion && (
            <button type="button" className="btn btn-plain" onClick={() => setI(0)}>
              Back to the suggestion
            </button>
          )}
        </div>
        {next && <p className="lc-next c07-next">{next}</p>}
      </div>
      <CardTail props={props} q={q} />
    </section>
  )
}
