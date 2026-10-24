// The kind of a case: a property of the problem ("Seller hold on the car"),
// never one pickup place, so the same kind can repeat across places and a
// rule can actually fire. The learning-loop track may store its own kind on a
// case or a decision; when it does, that wins (see storedKind).

import type { Case } from "@/lib/control-room/types"

export interface Kind {
  key: string
  label: string
}

type Rule = Kind & { test: (c: Case, text: string) => boolean }

/** Strongest property first: a seller hold is what stops the car even when the release document is missing too. */
const RULES: Rule[] = [
  {
    key: "seller_hold",
    label: "Seller hold on the car",
    test: (_c, t) => /seller\W{0,3}s?\s+hold|seller[^.]{0,60}\bhold\b|\bhold\b[^.]{0,40}\bseller\b|seller_hold/i.test(t),
  },
  { key: "release_document_missing", label: "Release document missing", test: (c) => c.type === "readiness.release_document_missing" || c.reasons.includes("papers_missing") },
  { key: "fee_requested", label: "Pickup place asks a fee", test: (c) => c.type === "readiness.fee_requested" },
  { key: "key_holder_not_named", label: "Key holder not named", test: (c) => c.type === "readiness.keys_or_access" },
  { key: "car_not_ready", label: "Car not ready", test: (c) => c.type === "readiness.car_not_ready" || c.reasons.includes("car_not_ready") },
  { key: "facts_disagree", label: "Order and pickup place disagree", test: (c) => c.type === "readiness.facts_disagree" },
  { key: "no_answer", label: "Pickup place not answering", test: (c) => c.type === "readiness.no_answer" || c.reasons.includes("pickup_place_not_answering") },
]

/** A decision without a stored case (the made-up history) only knows its case type. */
const BY_TYPE: Record<string, Kind> = {
  "readiness.release_document_missing": { key: "release_document_missing", label: "Release document missing" },
  "readiness.fee_requested": { key: "fee_requested", label: "Pickup place asks a fee" },
  "readiness.keys_or_access": { key: "key_holder_not_named", label: "Key holder not named" },
  "readiness.car_not_ready": { key: "car_not_ready", label: "Car not ready" },
  "readiness.facts_disagree": { key: "facts_disagree", label: "Order and pickup place disagree" },
  "readiness.no_answer": { key: "no_answer", label: "Pickup place not answering" },
}

export const KIND_LABELS: Record<string, string> = Object.fromEntries(RULES.map((r) => [r.key, r.label]))

/** A kind another track stored on the object (Case or decision data), in any of the shapes we expect. */
export function storedKind(o: unknown): Kind | undefined {
  if (!o || typeof o !== "object") return undefined
  const r = o as Record<string, unknown>
  const k = r.kind
  if (k && typeof k === "object" && typeof (k as Kind).key === "string") {
    const kk = k as Kind
    return { key: kk.key, label: kk.label ?? KIND_LABELS[kk.key] ?? kk.key }
  }
  const key = typeof r.kindKey === "string" ? r.kindKey : typeof k === "string" ? k : undefined
  if (!key) return undefined
  return { key, label: typeof r.kindLabel === "string" ? r.kindLabel : KIND_LABELS[key] ?? key }
}

function caseText(c: Case): string {
  return [c.headline, ...c.facts.map((f) => f.statement), c.suggestion?.label ?? "", c.suggestion?.effect ?? ""].join(" \n")
}

export function kindOf(c: Case): Kind {
  const stored = storedKind(c)
  if (stored) return stored
  const text = caseText(c)
  const rule = RULES.find((r) => r.test(c, text))
  if (rule) return { key: rule.key, label: rule.label }
  return kindOfType(c.type)
}

export function kindOfType(caseType: string): Kind {
  return BY_TYPE[caseType] ?? { key: caseType.replace(/^readiness\./, ""), label: caseType.replace(/^readiness\./, "").replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase()) }
}

/** Option ids are Bahn's semantic keys, with a suffix when one case has two of a kind ("ask_customer_2"). */
export const optionKey = (id: string) => id.replace(/_\d+$/, "")
