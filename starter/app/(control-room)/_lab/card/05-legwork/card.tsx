"use client"

// card 05: the agent's legwork as one grey log line under the situation (Zendesk logs the
// actions auto assist ran on its own, "clearly marked and not attributed to you"). It opens to
// every step with its time; the question then sits on its answer as today.

import { useState } from "react"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, hm, sentences, useCard, useCaseData, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

const WEIGHT: Record<string, number> = { call: 0, message: 1, ask: 1, lookup: 2, read: 3 }
/** The step that says most: a call, then a message read or sent, then the rest. */
const weight = (s: { kind: string; summary: string }) => (/^called/i.test(s.summary) ? 0 : /message|conversation/i.test(s.summary) ? 1 : (WEIGHT[s.kind] ?? 9))

export function Legwork(props: CardProps) {
  const q = useCard(props)
  const { data } = useCaseData(props.caseId)
  const [open, setOpen] = useState(false)
  if (q.done) return <CardDone props={props} q={q} />

  const steps = (data?.case.agentSteps ?? []).filter((s) => s.kind !== "propose" && s.kind !== "wait")
  const lead = [...steps].sort((a, b) => weight(a) - weight(b))[0]
  const more = steps.length - 1

  return (
    <section className="lab-card lab-card-05" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c05-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <div className={`c05-log${lead ? " shown" : ""}`}>
        {lead && (
          <>
            <button type="button" className="c05-line" aria-expanded={open} aria-controls={`c05-steps-${props.caseId}`} onClick={() => setOpen((o) => !o)}>
              <Icon name="check" size={16} />
              <span>
                {sentences(lead.summary)[0]?.replace(/\.$/, "")} at {hm(lead.at)}
                {more > 0 && <span className="c05-more">{open ? "" : `, and ${more} more ${more === 1 ? "step" : "steps"}`}</span>}
              </span>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
            </button>
            {open && (
              <ol className="c05-steps" id={`c05-steps-${props.caseId}`}>
                {steps
                  .filter((s) => s !== lead)
                  .map((s, i) => (
                    <li key={i}>
                      <Icon name="check" size={14} />
                      <span>{s.summary}</span>
                      <time>{hm(s.at)}</time>
                    </li>
                  ))}
              </ol>
            )}
          </>
        )}
      </div>
      <p className="lc-ask c05-ask">{q.ask}</p>
      <div className="lc-acts c05-acts">
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
      {props.next && <p className="lc-next c05-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
