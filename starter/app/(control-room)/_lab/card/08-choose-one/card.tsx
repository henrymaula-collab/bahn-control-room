"use client"

// card 08: every option as a choice, the suggestion already chosen, one button that names what
// you chose (GitHub's Submit review: Comment, Approve, Request changes, then one submit).

import { useState } from "react"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function ChooseOne(props: CardProps) {
  const q = useCard(props)
  const [id, setId] = useState(props.suggestion.id)
  if (q.done) return <CardDone props={props} q={q} />

  const all = [props.suggestion, ...props.alternatives]
  const chosen = all.find((o) => o.id === id) ?? props.suggestion
  const car = props.subject?.split(",")[0]?.trim()
  const effectOf = (oid: string) => {
    const o = all.find((x) => x.id === oid)!
    return oid === props.suggestion.id ? (props.next ?? o.effect) : o.effect
  }

  return (
    <section className="lab-card lab-card-08" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c08-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <fieldset className="c08-set">
        <legend className="lc-ask c08-ask">{car ? `What should happen with the ${car}?` : "What should happen?"}</legend>
        <div className="c08-list" role="radiogroup">
          {all.map((o) => {
            const on = o.id === id
            return (
              <label key={o.id} className={`c08-row${on ? " on" : ""}`}>
                <input type="radio" name={`c08-${props.caseId}`} value={o.id} checked={on} onChange={() => setId(o.id)} />
                <span className="c08-mark" aria-hidden="true" />
                <span className="c08-text">
                  <span className="c08-label">
                    {o.label}
                    {o.id === props.suggestion.id && <span className="c08-sugg">Suggested</span>}
                  </span>
                  {on && <span className="c08-effect">{effectOf(o.id)}</span>}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="lc-acts c08-acts">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          aria-expanded={chosen.id === props.suggestion.id && q.preview ? q.panel.open === "email" : undefined}
          aria-controls={chosen.id === props.suggestion.id && q.preview ? "email" : undefined}
          onClick={() => q.choose(chosen)}
        >
          {q.verbOf(chosen)}
        </button>
      </div>
      <CardTail props={props} q={q} />
    </section>
  )
}
