"use client"

// rule 02: the rule as a setting, not a question. When and Then in a grouped list, one real switch
// "The agent does this alone", and a Settings-style footnote that says who taught it and how to
// take it back. The answers behind it open under the footnote.

import Link from "next/link"
import { useState } from "react"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import { afterWords, changedWords, day, dayW, Face, historyHref, lower, names, useHandled, useNoPanel, useRuleData, whenText, type RuleCardProps, ShotWait } from "../shared/kit"
import "./switch.css"

export function RuleSwitch({ proposal: p, personName, status, changed, pending, error, setStatus }: RuleCardProps) {
  useNoPanel()
  const on = status === "on"
  const d = useRuleData(p, personName)
  const handled = useHandled(status, d.waiting)
  const lab = useLab()
  const [open, setOpen] = useState(lab.why)

  return (
    <div className="detail-inner lab-rule-02 lab-rule-kit">
      <ShotWait ready={d.ready} />
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changedWords(status, changed, p.changedAt) : "The agent asks to do this alone"}</p>
        <h1 className="l what">{p.kindLabel}</h1>

        <div className="r02-group" role="group" aria-label="The rule">
          <div className="r02-row">
            <span className="r02-label">When</span>
            <span className="r02-value">{whenText(p.when)}</span>
          </div>
          <div className="r02-row">
            <span className="r02-label">Then</span>
            <span className="r02-value">{p.then}</span>
          </div>
          <div className="r02-row r02-toggle">
            <span className="r02-text">
              <span className="r02-title" id="r02-title">
                The agent does this alone
              </span>
              <span className="r02-sub">{on ? `On${changed?.at ? ` since ${changed.at}` : ""}. Nobody is asked.` : "Off. A person decides each time."}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby="r02-title"
              className="r02-switch"
              disabled={pending}
              onClick={() => setStatus(on ? "off" : "on")}
            >
              <span className="r02-knob" />
            </button>
          </div>
        </div>

        <p className="s r02-foot">
          {on
            ? `${afterWords(p, d.waiting, handled)} Turn the switch off to give these back to people.`
            : `${d.people.length ? `${names(d.people.map((x) => x.name))} answered ${p.agreeing} of ${p.decided} the same way since ${day(d.first)}. ` : ""}You can turn it off here at any time.`}
        </p>
        {error && <p className="m now rk-err">{error}</p>}
      </section>

      <div className="rows work-rows r02-rows">
        <details className="row" open={open || undefined} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>
            <span className="m title">The answers behind it</span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <ul className="r02-people">
              {d.people.map((x) => (
                <li key={x.id}>
                  <Face person={x} size="1.75em" />
                  <span className="r02-name">{x.name}</span>
                  <span className="r02-n">{x.same === x.n ? `${x.n} of ${x.n} the same` : `${x.same} of ${x.n} the same`}</span>
                </li>
              ))}
            </ul>
            {d.differ[0] && (
              <p className="m r02-differ">
                {d.differ[0].by.name} answered differently once, on {dayW(d.differ[0].at)}: {lower(d.differ[0].decision)} for the {d.differ[0].car} at {d.differ[0].place}.{" "}
                <span className="rk-quiet">&ldquo;{d.differ[0].reason}&rdquo;</span>
              </p>
            )}
            <Link href={historyHref(p)} className="rk-link r02-all">
              All {p.decided} in History
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
        </details>
      </div>
    </div>
  )
}
