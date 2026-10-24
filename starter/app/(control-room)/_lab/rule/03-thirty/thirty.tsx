"use client"

// rule 03: one picture with a takeaway title. The answers as marks in time order, the one that
// differs hollow; hover, focus or the arrow keys read an answer in one line under the marks.
// Turned on, the agent's first one joins the end of the line.

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import { afterWords, changedWords, day, dayW, historyHref, lower, useHandled, useNoPanel, useRuleData, type Answer, type RuleCardProps, ShotWait } from "../shared/kit"
import "./thirty.css"

export function RuleThirty({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  useNoPanel()
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const lab = useLab()
  const line = useMemo(() => [...d.answers].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), [d.answers])
  // What the line under the marks reads: the one that differs when the evidence is asked for, else the newest.
  const [at, setAt] = useState<number | null>(null)
  const fallback = lab.why ? line.findIndex((a) => !a.same) : line.length - 1
  const shown: Answer | undefined = line[at ?? fallback]
  const marks = useRef<(HTMLButtonElement | null)[]>([])
  const agentNext = on && d.waiting[0]

  const move = (i: number) => {
    const j = Math.max(0, Math.min(line.length - 1, i))
    setAt(j)
    marks.current[j]?.focus()
  }

  return (
    <div className="detail-inner lab-rule-03 lab-rule-kit">
      <ShotWait ready={d.ready} />
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed, p.changedAt) : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>

        <figure className="r03-fig">
          <figcaption className="r03-cap">
            {p.agreeing} of {p.decided} answers were the same: {lower(p.then)}
          </figcaption>
          <div
            className="r03-marks"
            role="listbox"
            aria-label="The answers, oldest first"
            onMouseLeave={() => setAt(null)}
            onKeyDown={(e) => {
              const i = at ?? fallback
              if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), move(i + 1))
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), move(i - 1))
              if (e.key === "Home") (e.preventDefault(), move(0))
              if (e.key === "End") (e.preventDefault(), move(line.length - 1))
            }}
          >
            {line.map((a, i) => (
              <button
                key={a.caseId}
                ref={(el) => {
                  marks.current[i] = el
                }}
                type="button"
                role="option"
                aria-selected={shown === a}
                aria-label={`${a.by.name}, ${dayW(a.at)}, ${a.same ? "the same" : "different"}`}
                tabIndex={i === (at ?? fallback) ? 0 : -1}
                className={`r03-mark${a.same ? "" : " r03-differs"}${shown === a ? " r03-on" : ""}`}
                onMouseEnter={() => setAt(i)}
                onFocus={() => setAt(i)}
              />
            ))}
            {agentNext && <span className="r03-mark r03-agent" role="option" aria-selected={false} aria-label="The agent, today" />}
          </div>
          <div className="r03-ends s">
            <span>{day(d.first)}</span>
            <span>{agentNext ? "Today" : day(d.last)}</span>
          </div>
          <p className="r03-read m" aria-live="polite">
            {agentNext && at === null ? (
              <>The agent, today: paused the gig for the {d.waiting[0].vehicle} at {d.waiting[0].place}.</>
            ) : shown ? (
              <>
                <Link href={historyHref(p, shown.caseId)} className="r03-who">
                  {shown.by.name}, {dayW(shown.at)}
                </Link>
                : {shown.same ? "paused the gig" : lower(shown.decision)} for the {shown.car} at {shown.place}.{" "}
                {shown.reason && <span className="rk-quiet">&ldquo;{shown.reason}&rdquo;</span>}
              </>
            ) : (
              " "
            )}
          </p>
        </figure>

        <p className="l ask">{on ? "The agent handles this kind alone now." : "Let the agent handle this kind alone?"}</p>
        <div className="answers">
          {on ? (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStatus("off")}>
              Turn it off
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => setStatus("on")}>
              Turn it on
            </button>
          )}
        </div>
        <p className="s next">
          {on
            ? agentNext
              ? `${d.waiting[0].person ? `It left ${d.waiting[0].person}'s tasks, and the` : "The"} next ones go the same way until you turn it off.`
              : `${afterWords(p, d.waiting, handled)} You can turn it off here at any time.`
            : `It will ${lower(p.then)} each time, without asking a person. You can turn it off here at any time.`}
        </p>
        {error && <p className="m now rk-err">{error}</p>}
        <Link href={historyHref(p)} className="rk-link r03-all">
          All {p.decided} answers in History
          <Icon name="chevron-right" size={16} />
        </Link>
      </section>
    </div>
  )
}
