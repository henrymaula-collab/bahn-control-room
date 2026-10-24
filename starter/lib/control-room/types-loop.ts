// Contract for the learning loop (v4 Track 4): one case record per decided
// case, the kinds of case with their gate, and the trust-rule extras.
// Words in every string follow design/BAHN-VOCABULARY.md.

import type { GateStatus } from "./trust-gate"

/** What the person saw, decided and said, kept as one record. Also the eval case. */
export interface CaseRecord {
  id: string // "rec-<caseId>"
  caseId: string
  decisionId: string
  orderId?: string
  reference?: string // the order reference; made-up past records carry made-up references
  kindKey: string
  kindLabel: string // "Seller hold on the car"
  /** A snapshot of the situation when the person decided. */
  situation: {
    headline: string
    place?: string
    placeId?: string
    country?: string
    facts: { statement: string; source: string; at: string }[]
    suggestion: { id: string; label: string }
    alternatives: { id: string; label: string }[]
  }
  choice: { optionId: string; label: string; tookSuggestion: boolean; editedDetail?: string; changes?: string[] } // changes: the change kinds the option makes ("customer_message", "booking", ...)
  reason?: string // the person's own words
  /** The conversation with the agent before deciding: message ids in cr_chat_messages, or a short summary. */
  chat?: { messageIds: string[]; summary?: string; via?: "text" | "voice" | "mixed" }
  decidedBy: { personId: string; name: string }
  /** How much this answer counted when it was given: the person's record on this kind before it. */
  weight: { value: number; decided: number; held: number }
  minutes?: number // case shown to decision
  at: string // ISO
  synthetic: boolean // made-up demo history
}

/** A kind of case with what people decided on it. GET /api/cr/kinds */
export interface KindSummary {
  kindKey: string
  label: string
  novelty: "new" | "rare" | "known"
  decided: number
  people: number
  peopleNames: string[]
  agreeing: number
  leading: { optionId: string; label: string } | null
  needed: number
  status: GateStatus // new | learning | differ | ready
  line: string // "New kind of case" | "Decided once, by Aino" | "2 of 16" | "29 of 30 agree, 4 people" | "People answer this differently"
  lowerBound: number
  /** False when the agreed answer messages the customer: a person always sends those. */
  alone: boolean
  /** Median minutes from case shown to decision, over the records that have it. */
  medianMinutes: number | null
  ruleId?: string
  ruleStatus?: "suggested" | "on" | "off"
}

/** What a kind-level trust rule carries besides the contract's TrustRule. */
export interface RuleGateExtras {
  kindKey: string
  gate: { people: number; lowerBound: number; weightedAgreeing: number; weightedTotal: number; needed: number; blocked: boolean }
}
