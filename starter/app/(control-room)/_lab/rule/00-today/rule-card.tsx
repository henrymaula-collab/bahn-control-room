"use client"

import Link from "next/link"
import { Icon } from "../../../_ui/icons"
import { useLab } from "../../context"
import type { RuleProposal } from "../../server"

/** Props of the proposal card (slot `rule`, part `RuleCard`). LabRuleCard (mounts.tsx) holds the state. */
export type RuleCardProps = {
  proposal: RuleProposal // the kind, the rule's when/then, the evidence (29 of 30, 4 people)
  personName: string // the shift lead, "Kaisa Lindqvist"
  status: "suggested" | "on" | "off"
  changed?: { by: string; at?: string } // who turned it on or off, at what time (Helsinki), when known
  pending: boolean
  error: string | null
  setStatus: (status: "on" | "off") => void // the real API: POST /api/cr/trust-rules/:id
  nextHref?: string
}

/**
 * Today's minimal default (no screen existed before the lab): the proposal as a decision card,
 * one question, "Turn it on" as the one filled button, the evidence one tap away.
 */
export function RuleCard({ proposal: p, status, changed, pending, error, setStatus }: RuleCardProps) {
  const on = status === "on"
  const lab = useLab() // ?why=open: the evidence open
  return (
    <div className="detail-inner">
      <section className="question" aria-live="polite">
        <p className="m due">{on ? `Turned on${changed ? ` by ${changed.by.split(" ")[0]}${changed.at ? ` at ${changed.at}` : ""}` : ""}` : "The agent asks"}</p>
        <h1 className="l what">{p.kindLabel}</h1>
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
          {on ? "From now on" : "Once it is on"}, the agent will {p.then.charAt(0).toLowerCase() + p.then.slice(1)} on its own. You can turn it off at any time.
        </p>
        {error && <p className="m now" style={{ marginTop: 12 }}>{error}</p>}
      </section>
      <div className="rows work-rows">
        <details className="row" open={lab.why || undefined}>
          <summary>
            <span className="m title">Why the agent asks</span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <dl className="kv m">
              <dt>Agree</dt>
              <dd>{p.line}</dd>
              <dt>Decided by</dt>
              <dd>{p.people.join(", ")}</dd>
              <dt>When</dt>
              <dd>{p.when.replace(/^When /, "")}</dd>
              <dt>Then</dt>
              <dd>{p.then}</dd>
            </dl>
          </div>
        </details>
        <Link href="/history?who=agent" className="row-link">
          <span className="row-text">
            <span className="m title">What the agent did alone</span>
          </span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </Link>
      </div>
    </div>
  )
}
