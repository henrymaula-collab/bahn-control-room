// The learning loop: decision -> lesson -> trust rule.
//
// proposeLesson() turns one decision into a proposed lesson. The text comes
// from a template today; the agent workstream can plug an LLM summariser in
// with setLessonSummariser() without changing the signature.
//
// suggestTrustRules() groups decisions by case type + pickup place + the
// option people chose, and suggests a rule when at least 5 decisions exist and
// at least 90% chose the same option. Options that message a customer never
// become trust rules: the agent never contacts a customer on its own.

import type { Case, CaseType, Decision, Lesson, Option, TrustRule } from "./types"
import { caseTypeWords } from "./vocab"

export const TRUST_MIN_DECISIONS = 5
export const TRUST_MIN_SHARE = 0.9

/** What each semantic option id means, for rule and lesson text. */
export const OPTION_TEXT: Record<string, { then: string; customer: boolean }> = {
  pause_gig: { then: "Pause the gig until the pickup place confirms", customer: false },
  follow_pickup_place: { then: "Go with what the pickup place said and update the driver's instruction", customer: false },
  keep_slot_call_again: { then: "Keep the slot and call the pickup place again in an hour", customer: false },
  hold_driver_until_key_holder: { then: "Hold the driver until the pickup place names the key holder", customer: false },
  driver_waits: { then: "Ask the driver to wait 30 minutes more", customer: false },
  release_driver: { then: "Release the driver and pay the empty pickup", customer: true },
  accept_fee: { then: "Accept the fee and confirm the pickup", customer: false },
  ask_customer: { then: "Ask the customer", customer: true },
  ask_customer_for_release: { then: "Ask the customer for the signed release", customer: true },
  move_pickup_next_day: { then: "Move the pickup to the next working day", customer: true },
}

const WHEN_TEXT: Record<string, string> = {
  "readiness.facts_disagree": "the pickup place and the order disagree on where to collect the car",
  "readiness.keys_or_access": "nobody has named who hands over the keys",
  "readiness.no_answer": "the pickup place does not answer about the pickup",
  "readiness.car_not_ready": "the car is not ready for the pickup slot",
  "readiness.release_document_missing": "the release document is missing",
  "readiness.fee_requested": "the pickup place asks for a storage fee up to EUR 50",
}

export function whenText(type: CaseType, placeName?: string) {
  const base = WHEN_TEXT[type] ?? `a ${caseTypeWords(type).one} comes up`
  return placeName ? `At ${placeName}, ${base}` : `When ${base}`
}

export type LessonInput = {
  decision: Decision
  case: Pick<Case, "id" | "type" | "placeId" | "customerId" | "suggestion" | "alternatives" | "headline">
  personName: string
  placeName?: string
  country?: string
}

export type LessonSummariser = (input: LessonInput & { option: Option | null }) => Promise<string>

/** The default: a plain template, no model. */
export const templateSummariser: LessonSummariser = async ({ decision, case: c, personName, placeName, option }) => {
  const place = placeName ?? "this pickup place"
  const chose = option?.label ?? decision.editedDetail ?? "another way"
  const tookSuggestion = decision.optionId === c.suggestion.id
  const because = decision.why ? ` because ${decision.why.replace(/\.$/, "").replace(/^./, (ch) => ch.toLowerCase())}` : ""
  const edited = decision.editedDetail ? ` (changed: ${decision.editedDetail})` : ""
  return tookSuggestion
    ? `${place}: when ${WHEN_TEXT[c.type] ?? "this comes up"}, ${chose.replace(/^./, (ch) => ch.toLowerCase())}${edited}. ${personName} decided so.`
    : `${place}: when ${WHEN_TEXT[c.type] ?? "this comes up"}, ${personName} did not take the suggestion and chose to ${chose.replace(/^./, (ch) => ch.toLowerCase())}${because}${edited}.`
}

let summariser: LessonSummariser = templateSummariser

/** The agent workstream calls this to swap in an LLM summariser. */
export function setLessonSummariser(next: LessonSummariser) {
  summariser = next
}

export async function proposeLesson(input: LessonInput, now = new Date().toISOString()): Promise<Lesson> {
  const option = [input.case.suggestion, ...input.case.alternatives].find((candidate) => candidate.id === input.decision.optionId) ?? null
  const text = await summariser({ ...input, option })
  return {
    id: `lesson-${input.decision.id}`,
    scope: { caseType: input.case.type, placeId: input.case.placeId, customerId: input.case.customerId, country: input.country },
    text,
    fromDecisionIds: [input.decision.id],
    status: "proposed",
    createdAt: now,
  }
}

export function reviewLesson(lesson: Lesson, accept: boolean, reviewerId: string, editedText?: string): Lesson {
  return { ...lesson, text: editedText?.trim() || lesson.text, status: accept ? "accepted" : "retired", reviewedBy: reviewerId }
}

/** Accepted lessons that apply to a case: same type and same pickup place (or no place). */
export function lessonsFor(c: Pick<Case, "type" | "placeId" | "customerId">, lessons: Lesson[]): Lesson[] {
  return lessons.filter((lesson) => lesson.status === "accepted"
    && lesson.scope.caseType === c.type
    && (!lesson.scope.placeId || lesson.scope.placeId === c.placeId)
    && (!lesson.scope.customerId || lesson.scope.customerId === c.customerId))
}

export type DecisionFact = {
  caseId: string
  optionId: string
  caseType: string
  placeId: string | null
}

export function trustRuleId(caseType: string, placeId: string | null, optionId: string) {
  return `rule-${caseType.replace(/\W+/g, "_")}-${placeId ?? "any"}-${optionId}`
}

/**
 * Suggest trust rules from decisions. Existing rules keep their status and who
 * changed it; only the evidence is refreshed.
 */
export function suggestTrustRules(decisions: DecisionFact[], existing: (TrustRule & { optionId?: string })[], placeNames: Map<string, string>): (TrustRule & { optionId: string })[] {
  const groups = new Map<string, DecisionFact[]>()
  for (const decision of decisions) {
    if (!decision.placeId) continue
    const key = `${decision.caseType}|${decision.placeId}`
    const list = groups.get(key) ?? []
    list.push(decision)
    groups.set(key, list)
  }
  const byId = new Map(existing.map((rule) => [rule.id, rule]))
  const out = new Map<string, TrustRule & { optionId: string }>()
  for (const [key, list] of groups) {
    const [caseType, placeId] = key.split("|") as [string, string]
    const counts = new Map<string, DecisionFact[]>()
    for (const decision of list) counts.set(decision.optionId, [...(counts.get(decision.optionId) ?? []), decision])
    const [optionId, matched] = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]!
    const id = trustRuleId(caseType, placeId, optionId)
    const known = byId.get(id)
    const meets = list.length >= TRUST_MIN_DECISIONS && matched.length / list.length >= TRUST_MIN_SHARE
    const eligible = OPTION_TEXT[optionId] ? !OPTION_TEXT[optionId]!.customer : false
    if (!known && !(meets && eligible)) continue
    out.set(id, {
      id,
      caseType,
      scope: { placeId },
      when: whenText(caseType, placeNames.get(placeId)),
      then: OPTION_TEXT[optionId]?.then ?? optionId,
      evidence: { matched: matched.length, total: list.length, caseIds: matched.map((decision) => decision.caseId) },
      status: known?.status ?? "suggested",
      changedBy: known?.changedBy,
      changedAt: known?.changedAt,
      optionId,
    })
  }
  // Rules whose evidence disappeared (e.g. history reseeded) stay as they were.
  for (const rule of existing) if (!out.has(rule.id)) out.set(rule.id, { ...rule, optionId: rule.optionId ?? "" })
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** The ON rule that lets the agent decide this case alone, if any. */
export function ruleFor(c: Pick<Case, "type" | "placeId" | "customerId" | "suggestion">, rules: (TrustRule & { optionId?: string })[]) {
  return rules.find((rule) => rule.status === "on"
    && rule.caseType === c.type
    && (!rule.scope.placeId || rule.scope.placeId === c.placeId)
    && (!rule.scope.customerId || rule.scope.customerId === c.customerId)
    && rule.optionId === c.suggestion.id
    && !c.suggestion.changes.some((change) => change.kind === "customer_message")) ?? null
}
