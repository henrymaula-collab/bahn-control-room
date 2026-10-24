"use client"

// Mount points that sit in server components (pages, layouts): each picks the slot's part on the
// client and falls back to today's component. Client components call useLabPart directly.

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { setTrustRule } from "../actions"
import { Question, type QuestionProps } from "../_ui/question"
import { Shell, type ShellProps } from "../_ui/shell"
import { useLab, useLabPart } from "./context"
import { RuleCard, type RuleCardProps } from "./rule/00-today/rule-card"
import type { RuleProposal } from "./server"

/** Slot `card`: the decision card on Your tasks. */
export function LabQuestion(props: QuestionProps) {
  const Card = useLabPart("card", "Question", Question)
  return <Card {...props} />
}

/** Slot `menu`: the frame with the side menu. */
export function LabShell(props: ShellProps) {
  const Frame = useLabPart("menu", "Shell", Shell)
  return <Frame {...props} />
}

/**
 * Slot `rule`: the agent's trust-rule proposal in Kaisa's Your tasks. Holds the state and calls
 * the real API (POST /api/cr/trust-rules/:id through the setTrustRule action, lab database).
 * ?rulestate=on shows it turned on without saving anything.
 */
export function LabRuleCard({ proposal, personName, nextHref }: { proposal: RuleProposal; personName: string; nextHref?: string }) {
  const Card = useLabPart("rule", "RuleCard", RuleCard)
  const lab = useLab()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ status: RuleProposal["status"]; by?: string; at?: string } | null>(
    lab.ruleState === "on" ? { status: "on", by: personName, at: "12:04" } : null,
  )
  const status = saved?.status ?? proposal.status
  const setStatus: RuleCardProps["setStatus"] = (next) => {
    setError(null)
    start(async () => {
      try {
        const rule = await setTrustRule(proposal.id, next)
        const at = rule.changedAt ? new Date(rule.changedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" }) : undefined
        setSaved({ status: rule.status, by: personName, at })
        router.refresh()
      } catch {
        setError("This was not saved. Nothing changed for the agent. Try again.")
      }
    })
  }
  return (
    <Card
      proposal={proposal}
      personName={personName}
      status={status}
      changed={saved ? { by: saved.by ?? personName, at: saved.at } : proposal.changedBy ? { by: personName, at: undefined } : undefined}
      pending={pending}
      error={error}
      setStatus={setStatus}
      nextHref={nextHref}
    />
  )
}
