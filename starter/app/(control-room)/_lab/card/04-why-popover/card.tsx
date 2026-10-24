"use client"

// card 04: the reason one tap away, beside the answer (Linear Triage Intelligence: "Why this
// assignee was suggested", two lines of evidence, the alternative, Accept). The card stays today's.

import { useEffect, useRef, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, firstHandFacts, hm, recordLine, useCard, useCaseData, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

export function WhyPopover(props: CardProps) {
  const q = useCard(props)
  const [open, setOpen] = useState(false)
  const { data, loading } = useCaseData(props.caseId, open)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const head = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!open) return
    head.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  if (q.done) return <CardDone props={props} q={q} />
  const facts = firstHandFacts(data, 2)
  const record = recordLine(data)

  return (
    <section className="lab-card lab-card-04" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c04-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c04-ask">{q.ask}</p>
      <div className="c04-anchor">
        <div className="lc-acts c04-acts">
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
          <button
            ref={trigger}
            type="button"
            className="c04-why"
            aria-expanded={open}
            aria-controls={`c04-pop-${props.caseId}`}
            onClick={() => setOpen((o) => !o)}
          >
            Why this
            <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
          </button>
        </div>
        {open && (
          <div ref={box} id={`c04-pop-${props.caseId}`} className="c04-pop" role="dialog" aria-label="Why the agent suggests this">
            <p ref={head} tabIndex={-1} className="c04-pop-title">
              Why the agent suggests this
            </p>
            {loading && !data && <p className="c04-quiet">Looking it up</p>}
            {facts.length > 0 && (
              <ul className="c04-facts">
                {facts.map((f) => (
                  <li key={f.id}>
                    <p>{f.statement}</p>
                    <p className="c04-quiet">
                      {f.source.name}, {f.source.channel === "call" ? "on the call" : f.source.channel === "email" ? "by email" : "in a message"} at {hm(f.source.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {record && <p className="c04-record">{record}</p>}
            {props.alternatives.length > 0 && (
              <div className="c04-alts">
                <p className="c04-quiet">Instead</p>
                {props.alternatives.map((o) => (
                  <button key={o.id} type="button" className="c04-alt" onClick={() => (setOpen(false), q.openSheet(o))}>
                    <span>{o.label}</span>
                    <Icon name="chevron-right" size={16} />
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-primary c04-accept" disabled={q.pending} onClick={() => (setOpen(false), q.onPrimary())}>
              <Icon name="check" size={16} />
              {q.answer}
            </button>
          </div>
        )}
      </div>
      {props.next && <p className="lc-next c04-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
