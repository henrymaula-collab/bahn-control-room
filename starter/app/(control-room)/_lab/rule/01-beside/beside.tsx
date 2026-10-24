"use client"

// rule 01: the proposal is a card like every case, and the evidence sits beside it where the
// situation sits on a case: the four people, the one answer that differs, their own words.

import Link from "next/link"
import { createPortal } from "react-dom"
import { Icon } from "../../../_ui/icons"
import { usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { afterWords, changedWords, dayW, Face, historyHref, lower, names, useHandled, useRuleData, type RuleCardProps, ShotWait } from "../shared/kit"
import "./beside.css"

export function RuleBeside({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const { slot } = usePanel()
  const lab = useLab()
  const first = d.people.map((x) => x.name)

  return (
    <div className="detail-inner lab-rule-01 lab-rule-kit">
      <ShotWait ready={d.ready} />
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed, p.changedAt) : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>
        <p className="l ask">{on ? `The agent will ${lower(p.then)}, without asking a person.` : `Let the agent ${lower(p.then)}, without asking a person?`}</p>
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
            ? `${afterWords(p, d.waiting, handled)} If people start answering this differently, it asks a person again.`
            : first.length
              ? `${names(first)} answered ${p.agreeing} of ${p.decided} the same way. If people start answering differently, the agent asks a person again. You can turn it off here at any time.`
              : `If people start answering differently, the agent asks a person again. You can turn it off here at any time.`}
        </p>
        {error && <p className="m now rk-err">{error}</p>}
      </section>

      {slot &&
        createPortal(
          <aside className="panel open lab-rule-01 lab-rule-kit r01-panel" aria-label="The answers behind it">
            <h2 className="m strong">
              {p.agreeing} of {p.decided} answered the same
            </h2>
            <p className="s">{d.first ? `Since ${dayW(d.first)}, ${d.people.length} people` : " "}</p>

            <ul className="r01-people">
              {d.people.map((x) => (
                <li key={x.id}>
                  <details open={(lab.why && x.same < x.n) || undefined}>
                    <summary>
                      <Face person={x} size="2.1em" />
                      <span className="r01-who">
                        <span className="r01-name">{x.name}</span>
                        <span className="r01-sub">{x.same === x.n ? `${x.n} answers, all the same` : `${x.n} answers, ${x.same} the same`}</span>
                      </span>
                      <span className="chev">
                        <Icon name="chevron-right" size={16} />
                      </span>
                    </summary>
                    <ul className="r01-answers">
                      {x.answers.map((a) => (
                        <li key={a.caseId} className={a.same ? undefined : "r01-differs"}>
                          <Link href={historyHref(p, a.caseId)}>
                            <span className="r01-car">{a.car}</span>
                            <span className="r01-place">{a.place}</span>
                            <time>{dayW(a.at)}</time>
                          </Link>
                          {!a.same && <p className="r01-said">Answered differently: {lower(a.decision)}. &ldquo;{a.reason}&rdquo;</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>

            {d.differ[0] && (
              <div className="r01-block">
                <h3 className="r01-h">The one that differs</h3>
                <p>
                  {d.differ[0].by.name} chose to {lower(d.differ[0].decision)} for the {d.differ[0].car} at {d.differ[0].place}, {dayW(d.differ[0].at)}.
                </p>
                {d.differ[0].reason && <p className="rk-quiet">&ldquo;{d.differ[0].reason}&rdquo;</p>}
              </div>
            )}

            {d.reasons.length > 0 && (
              <div className="r01-block">
                <h3 className="r01-h">In their words</h3>
                <ul className="r01-words">
                  {d.reasons.slice(0, 2).map((r) => (
                    <li key={r.text}>
                      <p>&ldquo;{r.text}&rdquo;</p>
                      <p className="rk-quiet">{r.n} times</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link href={historyHref(p)} className="rk-link r01-all">
              All {p.decided} in History
              <Icon name="chevron-right" size={16} />
            </Link>
          </aside>,
          slot,
        )}
    </div>
  )
}
