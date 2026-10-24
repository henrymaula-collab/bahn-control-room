"use client"

// rule 05: the contract first. What the agent will do, what still comes to a person, when it
// stops by itself and how to take it back, as label and value; Turn it on under it.

import Link from "next/link"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import { afterWords, changedWords, day, dayW, Faces, historyHref, lower, names, useHandled, useNoPanel, useRuleData, whenText, type RuleCardProps } from "../shared/kit"
import "./limits.css"

export function RuleLimits({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  useNoPanel()
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const lab = useLab()

  return (
    <div className="detail-inner lab-rule-05 lab-rule-kit">
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed) : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>
        <p className="l ask">{on ? "The agent handles this kind alone now, within these limits." : "Let the agent handle this kind alone, within these limits?"}</p>

        <dl className="r05-kv">
          <dt>When</dt>
          <dd>{whenText(p.when).replace(/^the/, "The")}</dd>
          <dt>It will</dt>
          <dd>{p.then}. Nothing else.</dd>
          <dt>A person still</dt>
          <dd>Gets every other kind of case, and anything this one does not cover.</dd>
          <dt>It stops</dt>
          <dd>By itself, if people start answering this kind differently.</dd>
          <dt>Take it back</dt>
          <dd>Turn it off here at any time.</dd>
        </dl>

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
        {on && <p className="s next">{afterWords(p, d.waiting, handled)}</p>}
        {error && <p className="m now rk-err">{error}</p>}
      </section>

      <div className="rows work-rows">
        <details className="row" open={lab.why || undefined}>
          <summary>
            <span className="r05-sum">
              <span className="m title">Why the agent asks</span>
              <span className="s sub">{p.line}</span>
            </span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body r05-body">
            <p className="r05-people">
              <Faces people={d.people} size="1.9em" />
              <span>
                {names(d.people.map((x) => `${x.name} ${x.n}`))}, between {day(d.first)} and {day(d.last)}.
              </span>
            </p>
            {d.differ[0] && (
              <p>
                One answer differed: {d.differ[0].by.name}, {dayW(d.differ[0].at)}, chose to {lower(d.differ[0].decision)}. <span className="rk-quiet">&ldquo;{d.differ[0].reason}&rdquo;</span>
              </p>
            )}
            <Link href={historyHref(p)} className="rk-link">
              All {p.decided} in History
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
        </details>
      </div>
    </div>
  )
}
