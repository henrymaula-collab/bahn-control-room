"use client"

// card 14: the evidence is the words of the person who knows: the pickup place on the call, quoted
// under the situation with who and when (a quoted comment under an approval request; Linear's
// "why" cites the activity behind a suggestion). The whole call opens in place.

import { useState } from "react"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, hm, sentences, sourceQuote, useCard, useCaseData, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function SourceQuote(props: CardProps) {
  const q = useCard(props)
  const { data } = useCaseData(props.caseId)
  const [open, setOpen] = useState(false)
  if (q.done) return <CardDone props={props} q={q} />

  const quote = sourceQuote(data)
  const call = data?.calls[0]
  const theirName = quote?.who.split(",").slice(1).join(",").trim().replace(/\s*\(.*\)$/, "") || quote?.who
  // As many whole sentences as fit about three lines (215 characters); one long sentence is cut at a word.
  const text = (() => {
    if (!quote) return ""
    let out = ""
    for (const s of sentences(quote.text)) {
      if (out && (out + " " + s).length > 215) break
      out = out ? `${out} ${s}` : s
    }
    return out.length > 215 ? `${out.slice(0, out.lastIndexOf(" ", 210))}…` : out
  })()

  return (
    <section className="lab-card lab-card-14" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c14-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <div className={`c14-quote${quote ? " shown" : ""}`}>
        {quote && (
          <figure>
            <blockquote>“{text.replace(/^["“]|["”]$/g, "")}”</blockquote>
            <figcaption>
              <span>
                {quote.who}, {quote.how} at {quote.at}
              </span>
              {call && (
                <button type="button" className="lc-link c14-open" aria-expanded={open} aria-controls={`c14-call-${props.caseId}`} onClick={() => setOpen((o) => !o)}>
                  {open ? "Hide the call" : "Read the call"}
                  <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
                </button>
              )}
            </figcaption>
          </figure>
        )}
        {open && call && (
          <ol className="c14-call" id={`c14-call-${props.caseId}`}>
            {call.turns.map((t, i) => (
              <li key={i} className={t.speaker === "agent" ? "agent" : ""}>
                <span className="c14-who">
                  {t.speaker === "agent" ? "The agent" : theirName}
                  <time>{hm(t.at)}</time>
                </span>
                <span>{t.translation ?? t.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="lc-ask c14-ask">{q.ask}</p>
      <div className="lc-acts c14-acts">
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
      {props.next && <p className="lc-next c14-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
