"use client"

import { useState, useTransition } from "react"
import type { TrustRule } from "@/lib/control-room/types"
import { lcFirst, ruleSentence } from "@/lib/control-room/format"
import type { EvidenceRow } from "@/lib/control-room/views"
import { reviewLesson, setTrustRule } from "../actions"

/** Earned trust: one narrow rule, its evidence, one button to turn it on, and the way back. */
export function SuggestedRule({
  rule,
  evidence,
  changedByName,
  changedAtWords,
}: {
  rule: TrustRule
  evidence: (EvidenceRow & { dayWords: string })[]
  changedByName?: string
  changedAtWords?: string
}) {
  const [showCases, setShowCases] = useState(false)
  const [pending, start] = useTransition()
  const set = (status: TrustRule["status"]) => start(async () => void (await setTrustRule(rule.id, status)))
  const { matched, total } = rule.evidence

  if (rule.status === "on") {
    return (
      <div className="panel rule-panel" aria-live="polite">
        <p className="t-label">On. The agent decides these alone now.</p>
        <p className="t-lead">{ruleSentence(rule)}</p>
        <p className="t-body evidence-line">
          Turned on by {changedByName ?? "the shift lead"}
          {changedAtWords ? ` at ${changedAtWords}` : ""}. Every case it decides shows on the desk as handled by the agent under this rule.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => set("off")}>
            Turn it off
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel rule-panel">
      <p className="t-label">The agent could decide this alone</p>
      <p className="t-lead">{ruleSentence(rule)}</p>
      <p className="t-body evidence-line">
        The agent would have decided like you in {matched} of {total} cases.{" "}
        {evidence.length > 0 && (
          <button type="button" className="btn-text" style={{ minHeight: 0 }} aria-expanded={showCases} onClick={() => setShowCases((s) => !s)}>
            {showCases ? "Hide the cases" : `Show the ${total} cases`}
          </button>
        )}
      </p>
      {showCases && (
        <ul className="evidence">
          {evidence.map((e) => (
            <li key={e.caseId} className="evidence-row">
              <time dateTime={e.at}>{e.dayWords}</time>
              <span>{e.placeName}</span>
              <span className="chose">
                {e.personName}: {lcFirst(e.personChose)}
                {e.matched ? "" : `. The agent would have said: ${lcFirst(e.agentWouldHave)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => set("on")}>
          Let the agent decide these
        </button>
        {rule.status === "suggested" && (
          <button type="button" className="btn-text" disabled={pending} onClick={() => set("off")}>
            Not yet
          </button>
        )}
      </div>
      <p className="t-2 reversible">
        Only this kind of case. You can turn it off at any time, and the desk sees every case the agent decides under it.
        {rule.status === "off" && changedByName ? ` ${changedByName} said not yet${changedAtWords ? ` at ${changedAtWords}` : ""}.` : ""}
      </p>
    </div>
  )
}

/** A rule already on (or off), as a quiet row with the way back. */
export function RuleRow({ rule, sub }: { rule: TrustRule; sub: string }) {
  const [pending, start] = useTransition()
  return (
    <li className="row">
      <p className="row-main">{ruleSentence(rule)}</p>
      <p className="row-sub">{sub}</p>
      <div className="actions">
        <button
          type="button"
          className="btn-text"
          disabled={pending}
          onClick={() => start(async () => void (await setTrustRule(rule.id, rule.status === "on" ? "off" : "on")))}
        >
          {rule.status === "on" ? "Turn it off" : "Turn it on"}
        </button>
      </div>
    </li>
  )
}

/** A lesson waiting for review: accept it, edit it, or retire it. */
export function LessonRow({ id, text, sub }: { id: string; text: string; sub: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [pending, start] = useTransition()
  const act = (action: "accept" | "retire" | "edit", t?: string) =>
    start(async () => {
      await reviewLesson(id, action, t)
      if (action === "edit") setEditing(false)
    })

  return (
    <li className="row">
      {editing ? (
        <>
          <label className="sr-only" htmlFor={`lesson-${id}`}>
            Lesson text
          </label>
          <textarea id={`lesson-${id}`} className="text-input" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <p className="row-sub" style={{ marginTop: 6 }}>{sub}</p>
          <div className="actions">
            <button type="button" className="btn btn-secondary btn-small" disabled={pending || !draft.trim()} onClick={() => act("edit", draft.trim())}>
              Accept with this wording
            </button>
            <button type="button" className="btn-text" onClick={() => (setDraft(text), setEditing(false))}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="row-main">{text}</p>
          <p className="row-sub">{sub}</p>
          <div className="actions">
            <button type="button" className="btn btn-secondary btn-small" disabled={pending} onClick={() => act("accept")}>
              Accept
            </button>
            <button type="button" className="btn-text" disabled={pending} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn-text" disabled={pending} onClick={() => act("retire")}>
              Retire
            </button>
          </div>
        </>
      )}
    </li>
  )
}
