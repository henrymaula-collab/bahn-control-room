"use client"

// card 02: what happens if you say yes, as a short list under the answer (Polar's "When you
// delete an organization:"), a changed time written new first with the old in brackets (Flighty).

import type { Option } from "@/lib/control-room/types"
import { languageName } from "@/lib/control-room/format"
import type { Draft } from "@/lib/control-room/views"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, sentences, useCard, wasNow, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

type Line = { text: string; was?: string }

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\d:]+/gu) ?? [])
const overlap = (a: string, b: string) => {
  const A = words(a)
  const B = words(b)
  const shared = [...A].filter((w) => B.has(w)).length
  return shared / Math.max(1, Math.min(A.size, B.size))
}

/** The suggestion's changes as plain lines, then the agent's next step, nothing said twice. */
function linesOf(o: Option, draft: Draft | undefined, next: string | undefined): Line[] {
  const out: Line[] = []
  for (const c of o.changes) {
    if (c.kind === "none") continue
    if (c.kind === "customer_message" || c.kind === "driver_message") {
      if (draft) {
        const to = draft.to.split(",")[0]
        const how = /e-?mail/i.test(draft.to) ? "An email" : "A message"
        out.push({ text: `${how} to ${to}${draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}` })
      } else out.push({ text: c.detail.length > 110 ? (c.kind === "customer_message" ? "A message to the customer" : "A message to the driver") : c.detail })
      continue
    }
    for (const s of sentences(c.detail)) {
      const m = wasNow(s)
      out.push(m ? { text: `New ${m.subject.toLowerCase()}: ${m.now}`, was: m.was } : { text: s.replace(/\.$/, "") })
    }
  }
  for (const s of sentences(next ?? o.effect)) {
    if (/^A person sends/i.test(s)) continue
    if (out.some((l) => overlap(l.text, s) > 0.6)) continue
    out.push({ text: s.replace(/^After a yes, (\w)/, (_, ch: string) => ch.toUpperCase()).replace(/\.$/, "") })
  }
  return out
}

export function Consequences(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />
  const lines = linesOf(props.suggestion, q.draftOf(props.suggestion), props.next)
  const verb = q.answer.replace(/^./, (ch) => ch.toLowerCase())

  return (
    <section className="lab-card lab-card-02" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c02-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c02-ask">{q.ask}</p>
      <div className="lc-acts c02-acts">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          aria-expanded={q.preview ? q.panel.open === "email" : undefined}
          aria-controls={q.preview ? "email" : undefined}
          aria-describedby={`c02-if-${props.caseId}`}
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
      {lines.length > 0 && (
        <div className="c02-if" id={`c02-if-${props.caseId}`}>
          <p className="lc-label">If you {verb}:</p>
          <ul>
            {lines.map((l, i) => (
              <li key={i}>
                <Icon name="arrow-right" size={14} />
                <span>
                  {l.text}
                  {l.was && <span className="c02-was"> (was {l.was})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CardTail props={props} q={q} />
    </section>
  )
}
