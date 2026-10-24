"use client"

// card 20: Your turn. The card as two turns of a conversation. On the left the agent's turn: its
// mark and the time it stopped, one grey line of the legwork it did (all of it one tap away), what
// it found and the question. On the right the person's turn: the deadline written as "Your answer
// by 13:00", the default answer last on the trailing edge, and what follows it.

import { useState } from "react"
import { AgentMark } from "../../../_ui/agent-mark"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, hm, sentences, useCard, useCaseData, type CardProps, type CaseData } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

type Step = CaseData["case"]["agentSteps"][number]
const closing = (s: Step) => /^(Brought a person|Stopped here|Will follow up)/.test(s.summary)

/** The one step worth a line: the call, else what it read, else its first step. */
function headline(steps: Step[]): Step | undefined {
  return steps.find((s) => /^Called\b/.test(s.summary)) ?? steps.find((s) => /^Read \d/.test(s.summary)) ?? steps[0]
}

export function YourTurn(props: CardProps) {
  const q = useCard(props)
  const { data } = useCaseData(props.caseId)
  const [open, setOpen] = useState(false)
  if (q.done) return <CardDone props={props} q={q} />

  const steps = data?.case.agentSteps ?? []
  const work = steps.filter((s) => !closing(s))
  const lead = headline(work)
  const asked = [...steps].reverse().find((s) => /^(Brought a person|Stopped here)/.test(s.summary)) ?? steps[steps.length - 1]
  const more = work.length - 1
  const due = props.due
  const at = due?.text.replace(/^(Decide by|Was due at)\s+/, "")
  const past = !!due && /^Was due/.test(due.text)

  return (
    <section className="lab-card lab-card-20" aria-labelledby={`q-${props.caseId}`}>
      <div className="c20-turn c20-agent">
        <p className="c20-who">
          <AgentMark size={20} />
          <span className="c20-name">Agent</span>
          {asked && <time className="c20-at">{hm(asked.at)}</time>}
        </p>
        <div className="c20-legwork">
          {lead ? (
            <button type="button" className="c20-work" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <span>
                {more > 0 ? `${sentences(lead.summary)[0].replace(/\.$/, "")}, ` : sentences(lead.summary)[0]}
                {more > 0 && <span className="c20-more">{open ? "fewer steps" : `and ${more} more ${more === 1 ? "step" : "steps"}`}</span>}
              </span>
            </button>
          ) : (
            <p className="c20-work c20-wait">&nbsp;</p>
          )}
          {open && (
            <ol className="c20-steps">
              {work.map((s) => (
                <li key={`${s.at}-${s.summary}`}>
                  <time>{hm(s.at)}</time>
                  <span>{s.summary}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <h1 className="lc-what c20-what" id={`q-${props.caseId}`}>
          <Keep text={props.headline} />
        </h1>
        <p className="lc-ask c20-ask">{q.ask}</p>
      </div>

      <div className="c20-turn c20-you">
        {due && (
          <p className={`c20-by${due.now ? " now" : ""}`}>
            {due.now && <span className="lc-dot" aria-hidden="true" />}
            {past ? `Your answer was due at ${at}` : `Your answer by ${at}`}
          </p>
        )}
        <div className="lc-acts c20-acts">
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
        {props.next && <p className="lc-next c20-next">{props.next}</p>}
      </div>
      <CardTail props={props} q={q} />
    </section>
  )
}
