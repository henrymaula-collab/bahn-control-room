"use client"

// card 11: the words that go out, in the card (Zendesk auto assist puts the drafted reply where the
// composer would be, with Edit and Approve). The person approves the actual message, in the
// language it goes out in, with English one tap away; Edit opens the whole message beside the card.

import { useState } from "react"
import { languageName } from "@/lib/control-room/format"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function MessageFirst(props: CardProps) {
  const q = useCard(props)
  const [english, setEnglish] = useState(false)
  if (q.done) return <CardDone props={props} q={q} />

  const draft = q.draftOf(props.suggestion)
  const foreign = !!draft && draft.language !== "en"
  const [name, how] = (draft?.to ?? "").split(/,\s*/)
  const shown = english && draft?.translation ? draft.translation : draft?.text
  const changes = props.suggestion.changes.filter((c) => c.kind !== "none" && c.detail.length < 140)

  return (
    <section className="lab-card lab-card-11" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c11-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c11-ask">{q.ask}</p>

      {draft ? (
        <figure className="c11-draft">
          <figcaption className="c11-to">
            To {name}
            {how ? `, ${how}` : ""}
            {foreign ? `, in ${languageName(draft.language)}` : ""}
          </figcaption>
          <blockquote className="c11-text" lang={english ? "en" : draft.language}>
            {shown}
          </blockquote>
          <div className="c11-tools">
            {foreign && draft.translation && (
              <button type="button" className="lc-link" aria-pressed={english} onClick={() => setEnglish((e) => !e)}>
                {english ? `Show in ${languageName(draft.language)}` : "Show in English"}
              </button>
            )}
          </div>
        </figure>
      ) : (
        changes.length > 0 && (
          <ul className="c11-changes" aria-label="What changes">
            {changes.map((c, i) => (
              <li key={i}>{c.detail}</li>
            ))}
          </ul>
        )
      )}

      <div className="lc-acts c11-acts">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          onClick={() => (draft && q.preview ? q.save(props.suggestion) : q.onPrimary())}
        >
          {q.answer}
        </button>
        {q.preview && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={q.pending}
            aria-expanded={q.panel.open === "email"}
            aria-controls="email"
            onClick={() => q.panel.setOpen(q.panel.open === "email" ? null : "email")}
          >
            Edit
          </button>
        )}
        {props.alternatives.length > 0 && (
          <button type="button" className="btn btn-plain" disabled={q.pending} onClick={() => q.openSheet()}>
            Other options
          </button>
        )}
      </div>
      {props.next && <p className="lc-next c11-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
