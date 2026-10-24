"use client"

// card 01: the question first, as an Apple alert reads: the title is what you answer, the
// message under it says why, and the answers stack with the default on top (Return).

import { useEffect } from "react"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function QuestionFirst(props: CardProps) {
  const q = useCard(props)
  const { pending, onPrimary } = q

  // Return answers with the default, as an alert's default button does (only when nothing else has focus).
  useEffect(() => {
    if (q.done) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (document.activeElement && document.activeElement !== document.body) return
      if (document.querySelector("dialog[open]")) return
      e.preventDefault()
      if (!pending) onPrimary()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [q.done, pending, onPrimary])

  if (q.done) return <CardDone props={props} q={q} />

  return (
    <section className="lab-card lab-card-01" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="c01-title" id={`q-${props.caseId}`}>
        {q.ask}
      </h1>
      <p className="c01-message">
        <Keep text={props.headline} />
      </p>
      <div className="c01-stack">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary c01-default"
          disabled={pending}
          aria-expanded={q.preview ? q.panel.open === "email" : undefined}
          aria-controls={q.preview ? "email" : undefined}
          aria-keyshortcuts="Enter"
          onClick={onPrimary}
        >
          <span>{q.answer}</span>
          <span className="c01-key" aria-hidden="true">
            ↵
          </span>
        </button>
        {props.alternatives.length > 0 && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => q.openSheet()}>
            Other options
          </button>
        )}
      </div>
      {props.next && <p className="lc-next c01-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
