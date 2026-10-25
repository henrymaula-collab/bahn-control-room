// The shape GET /api/cr/lead/rule returns (route.ts), shared with the rule card.

/** What the shift lead's rule card shows (app/(control-room)/_ui/rule-card.tsx), from one build of the state. */
export type RuleView = {
  rule: { id: string; status: "suggested" | "on" | "off"; when: string; then: string; changedBy?: { id: string; name: string }; changedAt?: string }
  kind: { key: string; label: string; line: string; agreeing: number; decided: number; people: string[]; medianMinutes: number | null }
  /** The cases of this kind open now (waiting for a person), or decided by the agent under the rule. */
  waiting: { caseId: string; reference: string; vehicle: string; place: string; person: string; handled: boolean }[]
  /** Every person's answer on the kind, as History has them. */
  evidence: {
    people: { id: string; name: string; n: number }[] // most answers first
    differ: { name: string; decision: string; reason?: string; at: string }[]
    said?: { text: string; n: number } // the agreeing answers' own words, the most used
    first?: string
    last?: string
  }
}
