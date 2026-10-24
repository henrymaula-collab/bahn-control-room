"use client"

// card 15: who is asking. The situation and the question are the agent's note to the person,
// signed with Bahn's mark and the deadline in one sentence; the answer sits outside the note,
// as the person's (Zendesk's "Auto assist" box above Edit and Approve; Claude in Chrome's plan
// approval: the agent's plan, then the person's two answers).

import { AgentMark } from "../../../_ui/agent-mark"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function AgentAsks(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />
  const due = props.due
  const at = due?.text.replace(/^(Decide by|Was due at)\s*/, "")
  const past = due?.text.startsWith("Was due")

  return (
    <section className="lab-card lab-card-15" aria-labelledby={`q-${props.caseId}`}>
      <p className="c15-from">
        <AgentMark size={18} />
        <span>
          The agent stopped here and needs a decision
          {due && (
            <>
              {" "}
              <span className={due.now ? "c15-due now" : "c15-due"}>{past ? `(it was due at ${at})` : `by ${at}`}</span>
            </>
          )}
        </span>
      </p>
      <div className="c15-note">
        <h1 className="lc-what c15-what" id={`q-${props.caseId}`}>
          <Keep text={props.headline} />
        </h1>
        <p className="lc-ask c15-ask">{q.ask}</p>
      </div>
      <div className="lc-acts c15-acts">
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
      {props.next && <p className="lc-next c15-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
