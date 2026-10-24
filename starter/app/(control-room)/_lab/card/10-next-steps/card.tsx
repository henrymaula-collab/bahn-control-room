"use client"

// card 10: what happens next as steps on a hairline (an approval flow written as people and
// steps; Superhuman's promise to come back with a follow-up). You now, then the agent, then the gig.

import { languageName } from "@/lib/control-room/format"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, sentences, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

type Step = { who?: string; what: string }
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

/** The next line as steps: "the agent checks ... and keeps ..." becomes two agent steps; "and then the gig ..." its own. */
function agentSteps(text: string): Step[] {
  const out: Step[] = []
  for (const raw of sentences(text)) {
    const s = raw.replace(/\.$/, "").replace(/^After a yes,\s*/i, "")
    const parts = s.split(/,?\s+and then\s+|\s+and\s+(?=(?:keeps|brings|books|publishes|asks|calls|sends|rebooks|checks|drafts|holds)\b)/)
    for (const p of parts) {
      const agent = /^the agent\s+/i.test(p)
      const verbFirst = /^(keeps|brings|books|publishes|asks|calls|sends|rebooks|checks|drafts|holds)\b/.test(p)
      if (agent || verbFirst) out.push({ who: "The agent", what: cap(p.replace(/^the agent\s+/i, "")) })
      else out.push({ who: "Then", what: cap(p) })
    }
  }
  return out
}

export function NextSteps(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />

  const draft = q.draftOf(props.suggestion)
  const you: Step = {
    who: "You, now",
    what: draft
      ? `${/e-?mail/i.test(draft.to) ? "An email" : "A message"} to ${draft.to.split(",")[0]}${draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}`
      : q.answer,
  }
  const steps = [you, ...agentSteps(props.next ?? props.suggestion.effect)]

  return (
    <section className="lab-card lab-card-10" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c10-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c10-ask">{q.ask}</p>
      <div className="lc-acts c10-acts">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          aria-describedby={`c10-steps-${props.caseId}`}
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
      <ol className="c10-steps" id={`c10-steps-${props.caseId}`} aria-label="What happens next">
        {steps.map((s, i) => (
          <li key={i} className={i === 0 ? "first" : ""}>
            <span className="c10-dot" aria-hidden="true" />
            <span className="c10-body">
              {s.who && (i === 0 || steps[i - 1].who !== s.who) && <span className="c10-who">{s.who}</span>}
              <span className="c10-text">{s.what}</span>
            </span>
          </li>
        ))}
      </ol>
      <CardTail props={props} q={q} />
    </section>
  )
}
