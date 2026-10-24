// Kinds of case. A kind is a property of the case ("Seller hold on the car",
// "Details disagree while the gig is posted"), never one pickup place: places
// rarely repeat a type of problem (Track C), so a rule keyed on a place would
// almost never fire. The learning loop, the trust gate and the chat all group
// decisions by kind.
//
// Most kinds are the case type itself. A few are narrower properties read from
// what the case says, because inside one type people answer the same only when
// that property holds (a posted gig turns "details disagree" into "pause the gig").

import type { Case, CaseType, Fact } from "./types"
import { caseTypeWords } from "./vocab"

export type KindKey = string

export interface KindDef {
  key: KindKey
  label: string // "Seller hold on the car"
  caseType: CaseType // the case type the kind belongs to (trust rules keep it for the agent's tool gate)
  when: string // "the seller has put a hold on the car": completes "When ..."
  one: string // "seller hold"
  many: string // "seller holds"
}

export const KINDS: Record<KindKey, KindDef> = {
  seller_hold: {
    key: "seller_hold", label: "Seller hold on the car", caseType: "readiness.release_document_missing",
    when: "the seller has put a hold on the car", one: "seller hold", many: "seller holds",
  },
  facts_disagree_open_gig: {
    key: "facts_disagree_open_gig", label: "Details disagree while the gig is posted", caseType: "readiness.facts_disagree",
    when: "the pickup place and the order disagree on where to collect the car while the gig is posted",
    one: "pickup where the details disagreed with the gig posted", many: "pickups where the details disagreed with the gig posted",
  },
  facts_disagree: {
    key: "facts_disagree", label: "Details disagree", caseType: "readiness.facts_disagree",
    when: "the pickup place and the order disagree on where to collect the car", one: "pickup where the details disagreed", many: "pickups where the details disagreed",
  },
  release_document_missing: {
    key: "release_document_missing", label: "Release document missing", caseType: "readiness.release_document_missing",
    when: "the release document is missing", one: "missing release document", many: "missing release documents",
  },
  car_not_ready: {
    key: "car_not_ready", label: "Car not ready", caseType: "readiness.car_not_ready",
    when: "the car is not ready for the pickup slot", one: "car that was not ready", many: "cars that were not ready",
  },
  keys_or_access: {
    key: "keys_or_access", label: "Keys or access", caseType: "readiness.keys_or_access",
    when: "nobody has named who hands over the keys", one: "key or access question", many: "key and access questions",
  },
  no_answer: {
    key: "no_answer", label: "Pickup place not answering", caseType: "readiness.no_answer",
    when: "the pickup place does not answer about the pickup", one: "pickup place that did not answer", many: "pickup places that did not answer",
  },
  fee_requested: {
    key: "fee_requested", label: "Fee requested", caseType: "readiness.fee_requested",
    when: "the pickup place asks for a storage fee up to EUR 50", one: "fee request from a pickup place", many: "fee requests from pickup places",
  },
}

/** The kind a case type falls into when no narrower property applies. */
export function kindForType(type: CaseType): KindKey {
  const suffix = String(type).split(".").pop() ?? String(type)
  return KINDS[suffix] ? suffix : String(type)
}

export function kindDef(key: KindKey): KindDef {
  const known = KINDS[key]
  if (known) return known
  const words = caseTypeWords(key)
  return { key, label: words.label, caseType: key, when: `a ${words.one} comes up`, one: words.one, many: words.many }
}

// A seller's hold: the seller (not the pickup place) withholds the car, e.g.
// over an unpaid invoice. Read from what the pickup place, the customer or a
// record says about this car; never from a lesson or the agent's own summary,
// which can mention a hold from another order.
const SELLER_HOLD = /\bseller(?:'s)?\b[^.]{0,80}\b(hold|withdr[ae]wn?|withheld|will not release)\b|\bhold\b[^.]{0,40}\bseller\b|seller-imposed/i
const POSTED_GIG = /\bgig\b[^.]{0,40}\b(published|posted)\b|\bpublished (gig|to drivers)\b|\bgig posted\b/i

const firstHand = (fact: Fact) => fact.source.kind !== "agent" && fact.source.kind !== "person"

export type KindInput = Pick<Case, "type" | "headline" | "facts" | "suggestion" | "alternatives">

/** The kind of this case, read from its properties. */
export function kindOf(c: KindInput): KindKey {
  const facts = c.facts ?? []
  if (SELLER_HOLD.test(c.headline ?? "") || facts.some((fact) => firstHand(fact) && SELLER_HOLD.test(fact.statement))) return "seller_hold"
  if (c.type === "readiness.facts_disagree") {
    const options = [c.suggestion, ...(c.alternatives ?? [])].filter(Boolean)
    const posted = facts.some((fact) => POSTED_GIG.test(fact.statement))
      || options.some((option) => option.changes?.some((change) => change.kind === "booking" && POSTED_GIG.test(change.detail)))
    if (posted) return "facts_disagree_open_gig"
  }
  return kindForType(c.type)
}

export function kindLabel(key: KindKey) {
  return kindDef(key).label
}
