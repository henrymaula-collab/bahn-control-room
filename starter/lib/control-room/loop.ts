// The learning loop over the engine's state: answers grouped by kind of case,
// the trust gate per kind, precedents, what the agent knows about a case's
// kind (CaseKnowledge for the chat), and kind-level trust-rule proposals.
//
// Inputs are plain arrays so this file has no database access and no import
// cycle with service.ts.

import { hel } from "./fixtures/clock"
import { clock, dayKey } from "./format"
import { OPTION_TEXT } from "./learning"
import { type KindKey, kindDef, kindForType, kindOf } from "./kinds"
import type { DecisionRecord, StoredTrustRule } from "./store"
import { type Answer, type KindGate, GATE_N, evaluateKind, kindLine, onePerCase, personWeight, recordsOf } from "./trust-gate"
import type { Case, OpsPerson } from "./types"
import type { CaseKnowledge, KindGateLine, Precedent } from "./types-chat"
import type { CaseRecord, KindSummary } from "./types-loop"

/** Fewer decisions than this and a kind is "rare"; none and it is "new". */
export const KNOWN_FROM = 5

export interface LoopInput {
  decisions: DecisionRecord[]
  records: CaseRecord[]
  cases: Case[] // stored and derived, to read the kind of a decision that has no record
  people: OpsPerson[]
  /** Order reference and pickup place name for a case, when the engine knows them. */
  describe?: (caseId: string) => { reference?: string; place?: string } | undefined
  /** The room's clock: a precedent decided after it (live, on the wall clock) is dated on the room's day, as History files it. */
  now?: string
}

/** A decision's date as every surface shows it: one made after the room's clock goes on the room's day, at its own time. */
export function onRoomDay(at: string, now?: string): string {
  return !now || at <= now ? at : hel(dayKey(now), clock(at))
}

export interface KindAnswer extends Answer {
  kindKey: KindKey
  record?: CaseRecord
}

/** Every person's answer, one per case, with its kind. */
export function kindAnswers(input: LoopInput): KindAnswer[] {
  const records = new Map(input.records.map((record) => [record.caseId, record]))
  const cases = new Map(input.cases.map((c) => [c.id, c]))
  const answers: KindAnswer[] = input.decisions.map((row) => {
    const record = records.get(row.caseId)
    const c = cases.get(row.caseId)
    const kindKey = record?.kindKey ?? (c ? kindOf(c) : kindForType(row.caseType))
    return {
      caseId: row.caseId, personId: row.personId, optionId: row.optionId, at: row.at, laterChanged: row.laterChanged, onTime: row.onTime,
      kindKey, record,
    }
  })
  return onePerCase(answers) as KindAnswer[]
}

export function answersByKind(input: LoopInput): Map<KindKey, KindAnswer[]> {
  const out = new Map<KindKey, KindAnswer[]>()
  for (const answer of kindAnswers(input)) out.set(answer.kindKey, [...(out.get(answer.kindKey) ?? []), answer])
  return out
}

export function gateFor(input: LoopInput, kindKey: KindKey): KindGate {
  return evaluateKind(answersByKind(input).get(kindKey) ?? [])
}

/** A person's record and weight on one kind, counted from the ledger (before `exceptCaseId`, if given). */
export function weightOn(input: LoopInput, kindKey: KindKey, personId: string, exceptCaseId?: string) {
  const mine = (answersByKind(input).get(kindKey) ?? []).filter((answer) => answer.personId === personId && answer.caseId !== exceptCaseId)
  const record = recordsOf(mine).get(personId) ?? { decided: 0, held: 0 }
  return { value: personWeight(record), decided: record.decided, held: record.held }
}

function messagesCustomer(optionId: string, answers: KindAnswer[]) {
  const known = OPTION_TEXT[optionId]
  if (known) return known.customer
  const latest = [...answers].reverse().find((answer) => answer.optionId === optionId && answer.record)
  return latest?.record?.choice.changes?.includes("customer_message") ?? false
}

function optionLabel(optionId: string, answers: KindAnswer[]) {
  const latest = [...answers].reverse().find((answer) => answer.optionId === optionId && answer.record)
  return latest?.record?.choice.label ?? OPTION_TEXT[optionId]?.then ?? optionId
}

const firstName = (people: OpsPerson[], id: string) => people.find((person) => person.id === id)?.name ?? id

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

/** Earlier decisions on this kind, newest first, at most `limit`. */
export function precedentsFor(input: LoopInput, kindKey: KindKey, opts: { exceptCaseId?: string; limit?: number } = {}): Precedent[] {
  const answers = answersByKind(input).get(kindKey) ?? []
  const gate = evaluateKind(answers)
  return answers
    .filter((answer) => answer.caseId !== opts.exceptCaseId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, opts.limit ?? 5)
    .map((answer) => {
      const described = input.describe?.(answer.caseId)
      return {
        caseId: answer.caseId,
        reference: answer.record?.reference ?? described?.reference ?? "",
        place: answer.record?.situation.place ?? described?.place ?? "",
        decidedBy: firstName(input.people, answer.personId),
        at: onRoomDay(answer.record?.at ?? answer.at, input.now),
        choice: answer.record?.choice.label ?? optionLabel(answer.optionId, answers),
        ...(answer.record?.reason ? { why: answer.record.reason } : {}),
        weight: Math.round((gate.weights[answer.personId] ?? 1) * 100) / 100,
      }
    })
}

/** The kind's gate as the chat's CaseKnowledge carries it: the line Know-how shows, and what it rests on. */
export function gateLine(input: LoopInput, answers: KindAnswer[], gate = evaluateKind(answers)): KindGateLine {
  const names = [...new Set(answers.map((answer) => answer.personId))].map((id) => firstName(input.people, id))
  return { status: gate.status, line: kindLine(gate, names), agreeing: gate.agreeing, agreeingPeople: gate.agreeingPeople, needed: gate.decided ? gate.needed : GATE_N }
}

export function summarizeKind(input: LoopInput, kindKey: KindKey, rules: StoredTrustRule[] = [], answers = answersByKind(input).get(kindKey) ?? []): KindSummary {
  const gate = evaluateKind(answers)
  const def = kindDef(kindKey)
  const peopleIds = [...new Set(answers.map((answer) => answer.personId))]
  const names = peopleIds.map((id) => firstName(input.people, id))
  const rule = rules.find((candidate) => candidate.kindKey === kindKey && (!gate.leadingOptionId || candidate.optionId === gate.leadingOptionId))
    ?? rules.find((candidate) => candidate.kindKey === kindKey)
  const minutes = answers.map((answer) => answer.record?.minutes).filter((value): value is number => typeof value === "number")
  return {
    kindKey,
    label: def.label,
    novelty: gate.decided === 0 ? "new" : gate.decided < KNOWN_FROM ? "rare" : "known",
    decided: gate.decided,
    people: gate.people,
    peopleNames: names,
    agreeing: gate.agreeing,
    leading: gate.leadingOptionId ? { optionId: gate.leadingOptionId, label: optionLabel(gate.leadingOptionId, answers) } : null,
    needed: gate.needed,
    status: gate.status,
    line: kindLine(gate, names),
    lowerBound: Math.round(gate.lowerBound * 1000) / 1000,
    alone: gate.leadingOptionId ? !messagesCustomer(gate.leadingOptionId, answers) : true,
    medianMinutes: median(minutes),
    ...(rule ? { ruleId: rule.id, ruleStatus: rule.status } : {}),
  }
}

/** Every kind that people decided, plus the known kinds nobody has decided yet. */
export function kindSummaries(input: LoopInput, rules: StoredTrustRule[] = [], extraKinds: KindKey[] = []): KindSummary[] {
  const grouped = answersByKind(input)
  const keys = new Set<KindKey>([...grouped.keys(), ...extraKinds])
  return [...keys].map((key) => summarizeKind(input, key, rules, grouped.get(key) ?? []))
    .sort((a, b) => b.decided - a.decided || a.label.localeCompare(b.label))
}

/**
 * What the agent knows about this case's kind (types-chat.ts CaseKnowledge).
 * Counts exclude this case itself, so a case being decided does not count toward itself.
 */
export function knowledgeFor(input: LoopInput, c: Case): CaseKnowledge {
  const kindKey = kindOf(c)
  const all = answersByKind(input).get(kindKey) ?? []
  const answers = all.filter((answer) => answer.caseId !== c.id)
  const gate = evaluateKind(answers)
  return {
    kindKey,
    kindLabel: kindDef(kindKey).label,
    novelty: gate.decided === 0 ? "new" : gate.decided < KNOWN_FROM ? "rare" : "known",
    decided: gate.decided,
    sameAsSuggestion: answers.filter((answer) => answer.optionId === c.suggestion.id).length,
    peopleCount: gate.people,
    needed: gate.decided ? gate.needed : GATE_N,
    precedents: precedentsFor(input, kindKey, { exceptCaseId: c.id }),
    // Where the kind stands now (this case's answer included once decided): the line Know-how shows.
    gate: all.length === answers.length ? gateLine(input, answers, gate) : gateLine(input, all),
  }
}

export function kindRuleId(kindKey: KindKey, optionId: string) {
  return `rule-kind-${kindKey.replace(/\W+/g, "_")}-${optionId}`
}

/**
 * Kind-level trust-rule proposals from the gate. A kind whose agreed answer
 * passes the gate, comes from more than one person and never messages a
 * customer gets a proposal ("suggested"); a shift lead turns it on. Existing
 * rules keep their status and who changed it. A proposal whose kind no longer
 * passes is withdrawn (returned in `drop`); a rule a person turned on stays,
 * marked blocked, for the shift lead to look at. Place-level proposals from the
 * old gate are withdrawn too; place-level rules a person turned on stay.
 */
export function kindRules(input: LoopInput, existing: StoredTrustRule[]): { rules: StoredTrustRule[]; drop: string[] } {
  const grouped = answersByKind(input)
  const byId = new Map(existing.map((rule) => [rule.id, rule]))
  const out = new Map<string, StoredTrustRule>()
  for (const [kindKey, answers] of grouped) {
    const gate = evaluateKind(answers)
    const optionId = gate.leadingOptionId
    if (!optionId) continue
    const id = kindRuleId(kindKey, optionId)
    const known = byId.get(id)
    const passes = gate.status === "ready" && !messagesCustomer(optionId, answers)
    if (!passes && !known) continue
    const def = kindDef(kindKey)
    out.set(id, {
      id,
      caseType: def.caseType,
      scope: {},
      when: `When ${def.when}`,
      then: OPTION_TEXT[optionId]?.then ?? optionLabel(optionId, answers),
      evidence: { matched: gate.agreeing, total: gate.decided, caseIds: answers.filter((answer) => answer.optionId === optionId).map((answer) => answer.caseId) },
      status: known?.status ?? "suggested",
      ...(known?.changedBy ? { changedBy: known.changedBy } : {}),
      ...(known?.changedAt ? { changedAt: known.changedAt } : {}),
      optionId,
      kindKey,
      gate: {
        people: gate.agreeingPeople, lowerBound: Math.round(gate.lowerBound * 1000) / 1000,
        weightedAgreeing: Math.round(gate.weightedAgreeing * 100) / 100, weightedTotal: Math.round(gate.weightedTotal * 100) / 100,
        needed: gate.needed, blocked: !passes,
      },
    })
  }
  const drop: string[] = []
  for (const rule of existing) {
    if (out.has(rule.id)) continue
    const isKind = !!rule.kindKey
    if (rule.status === "suggested") { drop.push(rule.id); continue }
    // A rule a person turned on or off stays as it was; a kind rule shows it is blocked now.
    out.set(rule.id, isKind && rule.gate ? { ...rule, gate: { ...rule.gate, blocked: true } } : rule)
  }
  for (const id of [...out.keys()]) {
    const rule = out.get(id)!
    if (rule.status === "suggested" && rule.gate?.blocked) { out.delete(id); drop.push(id) }
  }
  return { rules: [...out.values()].sort((a, b) => a.id.localeCompare(b.id)), drop }
}
