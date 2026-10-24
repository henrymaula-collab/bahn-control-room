// What the agent knows about this kind of case (CaseKnowledge in types-chat.ts):
// how often people decided it before, how many chose what the agent suggests
// now, who, and the precedents with how much each answer counts. Pure: the
// loaders in context.ts hand it the history.

import type { Case, OpsPerson } from "@/lib/control-room/types"
import type { CaseKnowledge, Precedent } from "@/lib/control-room/types-chat"
import { optionKey, type Kind } from "./kind"

/**
 * Agreeing answers needed before the agent may propose to handle a kind alone
 * (the loop track's gate; about a 0.8 lower bound on agreement). At merge,
 * point this at the loop track's constant.
 */
export const NEEDED_DEFAULT = 16

export function neededAnswers(): number {
  const raw = Number(process.env.CR_GATE_NEEDED)
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : NEEDED_DEFAULT
}

/** From this many earlier decisions a kind counts as known; below it, rare. */
export const KNOWN_FROM = 5

/** One earlier decision, with the words the chat needs. */
export interface PastDecision {
  id: string
  caseId: string
  reference: string // the order reference ("CD-4" + five digits); empty for the made-up history, which has no order
  personId: string
  personName: string
  kind: Kind
  caseType: string
  placeId?: string
  placeName: string
  /** The car on that order ("Bentley Continental GT"); absent for the made-up history, which has no order. */
  car?: string
  optionId: string
  choice: string // the option label that was chosen
  why?: string
  at: string
  laterChanged: boolean
  onTime: boolean
  synthetic: boolean
}

/** A count, never a score: what one person decided on one kind. */
export interface PersonRecord {
  decided: number
  laterChanged: number
  onTime: number
}

export function recordOf(history: PastDecision[], personId: string, kindKey: string, opts: { before?: string; excludeCaseId?: string } = {}): PersonRecord {
  const rows = history.filter((d) => d.personId === personId && d.kind.key === kindKey && d.caseId !== opts.excludeCaseId && (!opts.before || d.at < opts.before))
  return { decided: rows.length, laterChanged: rows.filter((d) => d.laterChanged).length, onTime: rows.filter((d) => d.onTime).length }
}

/**
 * How much one answer counts, 0..1, from the person's record on this kind at
 * the time (decided, later changed, on time). Never title or tenure. A first
 * answer counts 0.5; a long clean record approaches 1; a record of changed or
 * late decisions goes below 0.5. The loop track owns the stored weight; this
 * is the same rule for precedents it has not weighted yet.
 */
export function answerWeight(r: PersonRecord): number {
  if (r.decided <= 0) return 0.5
  const experience = r.decided / (r.decided + 4)
  const reliability = ((r.decided - r.laterChanged) / r.decided + r.onTime / r.decided) / 2
  const w = 0.5 + 0.5 * experience * (2 * reliability - 1)
  return Math.round(Math.min(1, Math.max(0, w)) * 100) / 100
}

/** Strong record = enough decisions of this kind, few of them changed later. */
export function isExperienced(r: PersonRecord): boolean {
  return r.decided >= 5 && r.laterChanged / r.decided <= 0.2
}

export function computeKnowledge(input: { case: Case; kind: Kind; history: PastDecision[]; needed?: number }): CaseKnowledge {
  const { kind } = input
  const earlier = input.history
    .filter((d) => d.kind.key === kind.key && d.caseId !== input.case.id)
    .sort((a, b) => b.at.localeCompare(a.at))
  const suggestion = optionKey(input.case.suggestion.id)
  const precedents: Precedent[] = earlier.slice(0, 5).map((d) => ({
    caseId: d.caseId,
    reference: d.reference,
    place: d.placeName,
    decidedBy: d.personName,
    at: d.at,
    choice: d.choice,
    ...(d.why ? { why: d.why } : {}),
    weight: answerWeight(recordOf(input.history, d.personId, kind.key, { before: d.at, excludeCaseId: d.caseId })),
  }))
  return {
    kindKey: kind.key,
    kindLabel: kind.label,
    novelty: earlier.length === 0 ? "new" : earlier.length < KNOWN_FROM ? "rare" : "known",
    decided: earlier.length,
    sameAsSuggestion: earlier.filter((d) => optionKey(d.optionId) === suggestion).length,
    peopleCount: new Set(earlier.map((d) => d.personId)).size,
    needed: input.needed ?? neededAnswers(),
    precedents,
  }
}

/** The earlier decisions of this kind, newest first (all of them, for the get_precedents tool). */
export function earlierOfKind(history: PastDecision[], kindKey: string, caseId: string): PastDecision[] {
  return history.filter((d) => d.kind.key === kindKey && d.caseId !== caseId).sort((a, b) => b.at.localeCompare(a.at))
}

export function firstName(people: OpsPerson[], id: string): string {
  const bare = id.replace(/^p-/, "")
  return people.find((p) => p.id === id || p.id.replace(/^p-/, "") === bare)?.name ?? bare.replace(/^./, (ch) => ch.toUpperCase())
}
