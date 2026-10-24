// What the agent knows about this kind of case (CaseKnowledge in types-chat.ts):
// how often people decided it before, how many chose what the agent suggests
// now, who, and the precedents with how much each answer counts. Pure, and
// counted by the learning loop's trust gate (lib/control-room/trust-gate.ts):
// one answer per case, the same weights, the same "n of 16". In engine mode the
// chat takes the loop's own knowledgeFor() (context.ts); this is the same count
// over the chat's history, for the fixture store and the tests.

import { type Answer, GATE_N, evaluateKind, kindLine, onePerCase, personWeight } from "@/lib/control-room/trust-gate"
import type { Case, OpsPerson } from "@/lib/control-room/types"
import type { CaseKnowledge, KindGateLine, Precedent } from "@/lib/control-room/types-chat"
import type { Kind } from "./kind"

/** Agreeing answers the gate needs before the agent may propose to handle a new kind alone. */
export const NEEDED_DEFAULT = GATE_N

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
  held: number // neither changed later nor followed by a missed promise (the gate's word)
}

export function recordOfRows(rows: Pick<PastDecision, "laterChanged" | "onTime">[]): PersonRecord {
  return {
    decided: rows.length,
    laterChanged: rows.filter((d) => d.laterChanged).length,
    onTime: rows.filter((d) => d.onTime).length,
    held: rows.filter((d) => !d.laterChanged && d.onTime).length,
  }
}

export function recordOf(history: PastDecision[], personId: string, kindKey: string, opts: { before?: string; excludeCaseId?: string } = {}): PersonRecord {
  return recordOfRows(history.filter((d) => d.personId === personId && d.kind.key === kindKey && d.caseId !== opts.excludeCaseId && (!opts.before || d.at < opts.before)))
}

/**
 * How much one answer counts, 0..1: the trust gate's weight from the person's
 * record on this kind, never title or tenure. Every answer starts at full
 * weight; each decision that was changed later or missed its promise lowers it:
 * (held + 1) / (decided + 1).
 */
export function answerWeight(r: PersonRecord): number {
  return Math.round(personWeight({ decided: r.decided, held: r.held }) * 100) / 100
}

/** Strong record = enough decisions of this kind, few of them changed later. */
export function isExperienced(r: PersonRecord): boolean {
  return r.decided >= 5 && r.laterChanged / r.decided <= 0.2
}

/** The chat's history as the gate's answers: one per case (the latest), as the loop counts them. */
export function answersOf(history: PastDecision[]): (Answer & { row: PastDecision })[] {
  const answers = history.map((d) => ({ caseId: d.caseId, personId: d.personId, optionId: d.optionId, at: d.at, laterChanged: d.laterChanged, onTime: d.onTime, row: d }))
  return onePerCase(answers) as (Answer & { row: PastDecision })[]
}

function gateOf(answers: (Answer & { row: PastDecision })[]): KindGateLine {
  const gate = evaluateKind(answers)
  const names = [...new Set(answers.map((a) => a.personId))].map((id) => answers.find((a) => a.personId === id)!.row.personName)
  return { status: gate.status, line: kindLine(gate, names), agreeing: gate.agreeing, agreeingPeople: gate.agreeingPeople, needed: gate.decided ? gate.needed : GATE_N }
}

export function computeKnowledge(input: { case: Case; kind: Kind; history: PastDecision[]; needed?: number }): CaseKnowledge {
  const { kind } = input
  const all = answersOf(input.history.filter((d) => d.kind.key === kind.key))
  const answers = all.filter((a) => a.caseId !== input.case.id)
  const gate = evaluateKind(answers)
  const earlier = [...answers].sort((a, b) => b.at.localeCompare(a.at))
  const precedents: Precedent[] = earlier.slice(0, 5).map(({ row: d }) => ({
    caseId: d.caseId,
    reference: d.reference,
    place: d.placeName,
    decidedBy: d.personName,
    at: d.at,
    choice: d.choice,
    ...(d.why ? { why: d.why } : {}),
    weight: Math.round((gate.weights[d.personId] ?? 1) * 100) / 100,
  }))
  return {
    kindKey: kind.key,
    kindLabel: kind.label,
    novelty: gate.decided === 0 ? "new" : gate.decided < KNOWN_FROM ? "rare" : "known",
    decided: gate.decided,
    sameAsSuggestion: answers.filter((a) => a.optionId === input.case.suggestion.id).length,
    peopleCount: gate.people,
    needed: input.needed ?? (gate.decided ? gate.needed : GATE_N),
    precedents,
    gate: gateOf(all.length === answers.length ? answers : all),
  }
}

/** The earlier decisions of this kind, newest first (all of them, for the get_precedents tool). */
export function earlierOfKind(history: PastDecision[], kindKey: string, caseId: string): PastDecision[] {
  return answersOf(history.filter((d) => d.kind.key === kindKey && d.caseId !== caseId)).map((a) => a.row).sort((a, b) => b.at.localeCompare(a.at))
}

export function firstName(people: OpsPerson[], id: string): string {
  const bare = id.replace(/^p-/, "")
  return people.find((p) => p.id === id || p.id.replace(/^p-/, "") === bare)?.name ?? bare.replace(/^./, (ch) => ch.toUpperCase())
}
