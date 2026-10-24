"use client"

// card 18: Two roads. The question splits the card like a railway switch: the agent's suggestion is
// the straight track, drawn in ink into a raised column; the other answer curves off into a plain
// one. Each column follows its answer to the end (who does what next) and has its own button at the
// foot, so the person compares where each road leads before choosing. A third option waits behind
// "One more option".

import type { Option } from "@/lib/control-room/types"
import type { Draft } from "@/lib/control-room/views"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, sentences, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

const VERBS = "keeps|asks|drafts|rebooks|calls|checks|books|sends|publishes|waits|moves|tells"
const SPLIT = new RegExp(`\\s+and\\s+(?=then\\s|(?:${VERBS})\\b|the\\s(?:pickup|gig|driver|delivery)\\b)`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const stop = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`)

/** Where an answer leads, as short steps: "You send the email to Kovellin Automobilhandel.", then the agent's next moves. */
export function roadOf(o: Option, draft?: Draft, max = 3): string[] {
  const out: string[] = []
  for (const sentence of sentences(o.effect)) {
    if (/^A person sends\b/i.test(sentence)) {
      const what = draft && /e-?mail/i.test(draft.to) ? "the email" : "the message"
      out.push(draft ? `You send ${what} to ${draft.to.split(",")[0]}.` : stop(sentence.replace(/^A person sends/i, "You send")))
      continue
    }
    for (const clause of sentence.split(/;\s+/)) {
      const m = clause.match(SPLIT)
      if (!m || m.index == null) {
        out.push(stop(cap(clause.trim())))
        continue
      }
      const head = clause.slice(0, m.index).trim()
      let tail = clause.slice(m.index + m[0].length).trim()
      if (new RegExp(`^(?:${VERBS})\\b`).test(tail) && /^the agent\b/i.test(head)) tail = `The agent ${tail}`
      out.push(stop(cap(head)), stop(cap(tail)))
    }
  }
  return out.slice(0, max)
}

export function TwoRoads(props: CardProps) {
  const q = useCard(props)
  if (q.done) return <CardDone props={props} q={q} />

  const second = props.alternatives[0]
  const rest = props.alternatives.length - 1
  const mine = roadOf(props.suggestion, q.draftOf(props.suggestion))
  const theirs = second ? roadOf(second, q.draftOf(second)) : []

  return (
    <section className="lab-card lab-card-18" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c18-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c18-ask">{q.ask}</p>

      {second && (
        <div className="c18-switch" aria-hidden="true">
          <span className="c18-thru" />
          <span className="c18-turn" />
        </div>
      )}

      <div className={`c18-roads${second ? "" : " one"}`}>
        <div className="c18-road c18-suggested">
          <p className="c18-label">Suggested</p>
          <ul className="c18-steps">
            {mine.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <button
            ref={q.primary}
            type="button"
            className="btn btn-primary c18-go"
            disabled={q.pending}
            aria-expanded={q.preview ? q.panel.open === "email" : undefined}
            aria-controls={q.preview ? "email" : undefined}
            onClick={q.onPrimary}
          >
            {q.answer}
          </button>
        </div>
        {second && (
          <div className="c18-road c18-other">
            <p className="c18-label">Or</p>
            <ul className="c18-steps">
              {theirs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-secondary c18-go" disabled={q.pending} onClick={() => q.openSheet(second)}>
              {q.verbOf(second)}
            </button>
          </div>
        )}
      </div>
      {rest > 0 && (
        <button type="button" className="lc-link c18-more" onClick={() => q.openSheet()}>
          {rest === 1 ? "One more option" : `${rest} more options`}
        </button>
      )}
      <CardTail props={props} q={q} />
    </section>
  )
}
