"use client"

// Kaisa's rule (night lab rule:04, Henry 25 Oct: "yes, rule:04 goes into v4"). The agent's proposal
// to handle one kind of case alone, shown on the case of that kind waiting now: Today against
// With the rule. Turned on, the engine decides that case and every next one of the kind
// (lib/control-room/service.ts buildState, ruleFor), and the block says it left the person's tasks.
// The copy never promises an automatic take-back: the rule stays on until someone turns it off.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import type { RuleView } from "@/app/api/cr/lead/rule/view"
import { setTrustRule } from "../actions"
import { Icon } from "./icons"

const HEL = "Europe/Helsinki"
/** "12 Aug" */
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: HEL }) : "")
/** "Tue 6 Oct" */
const dayW = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: HEL }).replace(",", "") : "")
/** "09:52" */
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: HEL }) : "")
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** "Jonas, Mikko, Lea and Sofie" */
const names = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)
const avatarOf = (id: string) => `/control-room/people/${id.replace(/^p-/, "")}.jpg`

export function RuleCard({ view, personName }: { view: RuleView; personName: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // What was just saved on this screen, until the refreshed page carries it.
  const [saved, setSaved] = useState<{ status: "on" | "off"; at?: string; by: string } | null>(null)
  const status = saved?.status ?? view.rule.status
  const on = status === "on"

  // Who had the waiting case: once the agent has decided it, the case has no person any more.
  const had = useRef(new Map<string, string>())
  for (const w of view.waiting) if (w.person && !had.current.has(w.caseId)) had.current.set(w.caseId, w.person)
  const w = view.waiting[0]
  const who = w ? w.person || had.current.get(w.caseId) || "" : ""
  const handled = on && !!w?.handled
  const mins = view.kind.medianMinutes
  const r = view.rule
  const ev = view.evidence

  const by = saved?.status === status ? saved.by : r.changedBy?.name
  const at = saved?.status === status ? saved.at : r.changedAt
  const changed = `${on ? "Turned on" : "Turned off"}${by ? ` by ${by.split(" ")[0]}` : ""}${at ? ` at ${hhmm(at)}` : ""}`

  const set = (next: "on" | "off") => {
    setError(null)
    start(async () => {
      try {
        const rule = await setTrustRule(r.id, next)
        setSaved({ status: next, at: rule?.changedAt, by: personName })
        router.refresh()
      } catch {
        setError("That did not save. Try again.")
      }
    })
  }

  return (
    <div className="detail-inner rule-card">
      <section className="question" aria-live="polite">
        <p className="m due">{on ? changed : "The agent asks"}</p>
        <h1 className="l what">{view.kind.label}</h1>
        <p className="l ask">
          {on ? "The agent handles this kind alone now." : w ? "Let the agent handle these alone, starting with the one waiting now?" : "Let the agent handle these alone?"}
        </p>

        {w && (
          <div className={`rule-case${handled ? " rule-done" : ""}`}>
            <div className="rule-case-head">
              <span className="rule-car">{w.vehicle}</span>
              <span className="rule-ref mono">{w.reference}</span>
              <span className="rule-where">
                {handled
                  ? `${w.place}. The agent paused the gig${who ? `, and it left ${who}'s tasks` : "; nobody had to decide it"}.`
                  : `${w.place}, waiting in ${who ? `${who}'s` : "a person's"} tasks`}
              </span>
            </div>
            {!on && (
              <div className="rule-compare">
                <div>
                  <p className="rule-h">Today</p>
                  <p>
                    {who || "A person"} reads it and decides.{mins ? ` People took ${mins} minutes on these, at the median.` : ""}
                  </p>
                </div>
                <div>
                  <p className="rule-h">With the rule</p>
                  <p>
                    At once, the agent will {lower(r.then)}.{who ? ` It leaves ${who}'s tasks.` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="answers">
          {on ? (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => set("off")}>
              Turn it off
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => set("on")}>
              Turn it on
            </button>
          )}
        </div>
        <p className="s next">{on ? "The next ones go the same way until you turn it off." : "You can turn it off here at any time, and these come to people again."}</p>
        {error && <p className="m now rule-err">{error}</p>}
      </section>

      <div className="rows work-rows">
        <details className="row">
          <summary>
            <span className="rule-sum">
              <span className="m title">Why the agent asks</span>
              <span className="s sub">{view.kind.line}</span>
            </span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body rule-body">
            <p className="rule-people">
              <span className="rule-faces" aria-label={names(ev.people.map((p) => p.name))}>
                {ev.people.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} className="rule-face" src={avatarOf(p.id)} alt="" width={40} height={40} />
                ))}
              </span>
              <span>
                {names(ev.people.map((p) => p.name))} answered {view.kind.agreeing} of {view.kind.decided} the same way between {day(ev.first)} and {day(ev.last)}.
              </span>
            </p>
            {ev.differ[0] && (
              <p>
                {ev.differ[0].name} answered differently once, on {dayW(ev.differ[0].at)}: {lower(ev.differ[0].decision)}.
                {ev.differ[0].reason && <span className="rule-quiet"> &ldquo;{ev.differ[0].reason}&rdquo;</span>}
              </p>
            )}
            {ev.said && (
              <p>
                Said most often: <span className="rule-quiet">&ldquo;{ev.said.text}&rdquo;</span>
              </p>
            )}
            <Link href={`/history?kind=${encodeURIComponent(view.kind.key)}&who=all`} className="rule-link">
              All {view.kind.decided} in History
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
        </details>
      </div>
    </div>
  )
}
