// Reads and writes for the control room's own tables. The agent workstream
// saves its work through saveCase(), saveCall() and saveAgentRun(); the API
// routes use the rest. Every write stores the contract object as jsonb plus a
// few columns for filtering.

import { asc, desc, eq, or } from "drizzle-orm"
import { crDb } from "./db"
import { crAgentRuns, crCalls, crCases, crDecisions, crLessons, crOpsPeople, crTrustRules } from "./schema"
import type { AgentRun, Call, Case, Decision, Lesson, OpsPerson, TrustRule } from "./types"

export type StoredTrustRule = TrustRule & { optionId: string }

export type DecisionRecord = {
  id: string
  caseId: string
  personId: string
  optionId: string
  caseType: string
  placeId: string | null
  customerId: string | null
  country: string | null
  tookSuggestion: boolean
  laterChanged: boolean
  onTime: boolean
  synthetic: boolean
  at: string
  data: Decision
}

// ---- People ---------------------------------------------------------------

export async function listPeople(): Promise<OpsPerson[]> {
  const rows = await crDb.select().from(crOpsPeople).orderBy(asc(crOpsPeople.id))
  return rows.map((row) => ({ ...row.data, onShift: row.onShift }))
}

export async function setOnShift(personId: string, onShift: boolean): Promise<OpsPerson | null> {
  const [row] = await crDb.select().from(crOpsPeople).where(eq(crOpsPeople.id, personId)).limit(1)
  if (!row) return null
  const data = { ...row.data, onShift }
  await crDb.update(crOpsPeople).set({ onShift, data }).where(eq(crOpsPeople.id, personId))
  return data
}

// ---- Cases ----------------------------------------------------------------

export async function listStoredCases(): Promise<Case[]> {
  const rows = await crDb.select().from(crCases).orderBy(asc(crCases.createdAt))
  return rows.map((row) => row.data)
}

export async function getStoredCase(id: string): Promise<Case | null> {
  const [row] = await crDb.select().from(crCases).where(eq(crCases.id, id)).limit(1)
  return row?.data ?? null
}

/**
 * Save (insert or replace) a case. The agent calls this with its own cases;
 * a saved case for an order replaces the case the engine derives for it.
 * Leave `routedTo` empty and the engine routes it on the next read.
 */
export async function saveCase(c: Case, source: "agent" | "derived" = "agent"): Promise<Case> {
  const now = new Date()
  const values = {
    id: c.id, orderId: c.orderId, desk: c.desk, caseType: c.type, status: c.status, routedTo: c.routedTo?.personId ?? null,
    placeId: c.placeId ?? null, source, createdAt: new Date(c.createdAt), updatedAt: now, data: c,
  }
  await crDb.insert(crCases).values(values).onConflictDoUpdate({
    target: crCases.id,
    set: { desk: values.desk, caseType: values.caseType, status: values.status, routedTo: values.routedTo, placeId: values.placeId, updatedAt: now, data: c },
  })
  return c
}

// ---- Decisions --------------------------------------------------------------

export async function listDecisions(): Promise<DecisionRecord[]> {
  const rows = await crDb.select().from(crDecisions).orderBy(asc(crDecisions.at))
  return rows.map((row) => ({ ...row, at: row.at.toISOString() }))
}

export async function saveDecision(record: Omit<DecisionRecord, "at"> & { at: string }) {
  await crDb.insert(crDecisions).values({ ...record, at: new Date(record.at) }).onConflictDoNothing()
}

// ---- Lessons ----------------------------------------------------------------

export async function listLessons(): Promise<Lesson[]> {
  const rows = await crDb.select().from(crLessons).orderBy(desc(crLessons.createdAt))
  return rows.map((row) => row.data)
}

export async function saveLesson(lesson: Lesson) {
  const values = { id: lesson.id, status: lesson.status, caseType: lesson.scope.caseType, placeId: lesson.scope.placeId ?? null, createdAt: new Date(lesson.createdAt), data: lesson }
  await crDb.insert(crLessons).values(values).onConflictDoUpdate({ target: crLessons.id, set: { status: values.status, data: lesson } })
  return lesson
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const [row] = await crDb.select().from(crLessons).where(eq(crLessons.id, id)).limit(1)
  return row?.data ?? null
}

// ---- Trust rules -----------------------------------------------------------

export async function listTrustRules(): Promise<StoredTrustRule[]> {
  const rows = await crDb.select().from(crTrustRules).orderBy(asc(crTrustRules.id))
  return rows.map((row) => ({ ...row.data, optionId: row.optionId }))
}

export async function saveTrustRule(rule: StoredTrustRule) {
  const { optionId, ...data } = rule
  const values = { id: rule.id, status: rule.status, caseType: rule.caseType, placeId: rule.scope.placeId ?? null, optionId, data: data as TrustRule }
  await crDb.insert(crTrustRules).values(values).onConflictDoUpdate({ target: crTrustRules.id, set: { status: values.status, data: values.data, optionId } })
  return rule
}

// ---- Calls and agent runs (the agent workstream writes these) -------------

export async function saveCall(call: Call): Promise<Call> {
  const values = { id: call.id, caseId: call.caseId ?? null, orderId: call.orderId, startedAt: new Date(call.startedAt), data: call }
  await crDb.insert(crCalls).values(values).onConflictDoUpdate({ target: crCalls.id, set: { caseId: values.caseId, data: call } })
  return call
}

export async function listCalls(filter: { caseId?: string; orderId?: string }): Promise<Call[]> {
  const conditions = [filter.caseId ? eq(crCalls.caseId, filter.caseId) : undefined, filter.orderId ? eq(crCalls.orderId, filter.orderId) : undefined].filter((c) => !!c)
  if (!conditions.length) return []
  const rows = await crDb.select().from(crCalls).where(or(...conditions)).orderBy(asc(crCalls.startedAt))
  return rows.map((row) => row.data)
}

export async function saveAgentRun(run: AgentRun): Promise<AgentRun> {
  const values = { id: run.id, orderId: run.orderId, caseId: run.caseId ?? null, startedAt: new Date(run.startedAt), stepCount: run.steps.length, data: run }
  await crDb.insert(crAgentRuns).values(values).onConflictDoUpdate({ target: crAgentRuns.id, set: { caseId: values.caseId, stepCount: values.stepCount, data: run } })
  return run
}

export async function listAgentRuns(filter: { caseId?: string; orderId?: string }): Promise<AgentRun[]> {
  const conditions = [filter.caseId ? eq(crAgentRuns.caseId, filter.caseId) : undefined, filter.orderId ? eq(crAgentRuns.orderId, filter.orderId) : undefined].filter((c) => !!c)
  if (!conditions.length) return []
  const rows = await crDb.select().from(crAgentRuns).where(or(...conditions)).orderBy(desc(crAgentRuns.startedAt))
  return rows.map((row) => row.data)
}
