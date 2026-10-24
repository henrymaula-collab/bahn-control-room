"use client"

// rule 06: GitHub's merge box. The gate's three conditions, each met with a quiet tick (enough
// answers, more than one person, they agree), the people's faces on the second, Turn it on at the
// foot of the same box.

import Link from "next/link"
import { useState } from "react"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import { afterWords, changedWords, day, dayW, Faces, historyHref, lower, names, useHandled, useNoPanel, useRuleData, type RuleCardProps, ShotWait } from "../shared/kit"
import "./gate.css"

export function RuleGate({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  useNoPanel()
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const lab = useLab()
  const [open, setOpen] = useState(lab.why)
  const people = d.people.map((x) => x.name)

  return (
    <div className="detail-inner lab-rule-06 lab-rule-kit">
      <ShotWait ready={d.ready} />
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed, p.changedAt) : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>
        <p className="l ask">{on ? `The agent will ${lower(p.then)}, without asking a person.` : `Let the agent ${lower(p.then)}, without asking a person?`}</p>

        <div className="r06-box">
          <ul className="r06-checks" aria-label="What the agent needs before it may do this alone">
            <li>
              <span className="r06-tick" aria-hidden>
                <Icon name="check" size={16} />
              </span>
              <span className="r06-what">Enough answers</span>
              <span className="r06-how">
                {p.decided} since {day(d.first)}. At least {d.gate.needed} must agree.
              </span>
            </li>
            <li>
              <span className="r06-tick" aria-hidden>
                <Icon name="check" size={16} />
              </span>
              <span className="r06-what">From more than one person</span>
              <span className="r06-how r06-faces">
                <Faces people={d.people} size="1.6em" />
                {names(people)}
              </span>
            </li>
            <li>
              <span className="r06-tick" aria-hidden>
                <Icon name="check" size={16} />
              </span>
              <button type="button" className="r06-what r06-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                They agree
                <Icon name={open ? "chevron-down" : "chevron-right"} size={16} />
              </button>
              <span className="r06-how">
                {p.agreeing} of {p.decided} chose to {lower(p.then)}.
              </span>
              {open && (
                <div className="r06-detail">
                  {d.differ[0] && (
                    <p>
                      One differed: {d.differ[0].by.name}, {dayW(d.differ[0].at)}, chose to {lower(d.differ[0].decision)}. <span className="rk-quiet">&ldquo;{d.differ[0].reason}&rdquo;</span>
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
              )}
            </li>
          </ul>
          <div className="r06-foot">
            {on ? (
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStatus("off")}>
                Turn it off
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => setStatus("on")}>
                Turn it on
              </button>
            )}
            <p className="s">{on ? afterWords(p, d.waiting, handled) : "If people start answering differently, the agent asks a person again. You can turn it off here at any time."}</p>
          </div>
        </div>
        {error && <p className="m now rk-err">{error}</p>}
      </section>
    </div>
  )
}
