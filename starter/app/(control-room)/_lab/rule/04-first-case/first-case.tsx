"use client"

// rule 04: what changes next time, shown on the case of this kind that is waiting now. Today
// against With the rule, side by side; turned on, the case says it has left the person's tasks.

import Link from "next/link"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import { changedWords, day, dayW, Faces, historyHref, lower, names, useHandled, useNoPanel, useRuleData, type RuleCardProps } from "../shared/kit"
import "./first-case.css"

export function RuleFirstCase({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  useNoPanel()
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const lab = useLab()
  const w = d.waiting[0]
  const mins = p.medianMinutes

  return (
    <div className="detail-inner lab-rule-04 lab-rule-kit">
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed) : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>
        <p className="l ask">{on ? "The agent handles this kind alone now." : w ? "Let the agent handle these alone, starting with the one waiting now?" : "Let the agent handle these alone?"}</p>

        {w && (
          <div className={`r04-case${handled ? " r04-done" : ""}`}>
            <div className="r04-case-head">
              <span className="r04-car">{w.vehicle}</span>
              <span className="r04-ref mono">{w.reference}</span>
              <span className="r04-where">{handled ? `${w.place}. The agent paused the gig, and it left ${w.person}'s tasks.` : `${w.place}, waiting in ${w.person}'s tasks`}</span>
            </div>
            {!on && (
              <div className="r04-compare">
                <div>
                  <p className="r04-h">Today</p>
                  <p>
                    {w.person} reads it and decides.{mins ? ` People took ${mins} minutes on these, at the median.` : ""}
                  </p>
                </div>
                <div>
                  <p className="r04-h">With the rule</p>
                  <p>At once, the agent will {lower(p.then)}. It leaves {w.person}&rsquo;s tasks.</p>
                </div>
              </div>
            )}
          </div>
        )}

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
            ? "The next ones go the same way. If people start answering this differently, the agent asks a person again."
            : "If people start answering differently, the agent asks a person again. You can turn it off here at any time."}
        </p>
        {error && <p className="m now rk-err">{error}</p>}
      </section>

      <div className="rows work-rows">
        <details className="row" open={lab.why || undefined}>
          <summary>
            <span className="r04-sum">
              <span className="m title">Why the agent asks</span>
              <span className="s sub">
                {p.line}
              </span>
            </span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body r04-body">
            <p className="r04-people">
              <Faces people={d.people} size="1.9em" />
              <span>
                {names(d.people.map((x) => x.name))} answered {p.agreeing} of {p.decided} the same way between {day(d.first)} and {day(d.last)}.
              </span>
            </p>
            {d.differ[0] && (
              <p>
                {d.differ[0].by.name} answered differently once, on {dayW(d.differ[0].at)}: {lower(d.differ[0].decision)}. <span className="rk-quiet">&ldquo;{d.differ[0].reason}&rdquo;</span>
              </p>
            )}
            {d.reasons[0] && (
              <p>
                Said most often: <span className="rk-quiet">&ldquo;{d.reasons[0].text}&rdquo;</span>
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
