// Remove what the agent wrote into the control room tables (its cases,
// calls, runs, and the decisions and lessons on its cases), so a test run or
// a replay can be undone. Derived cases, the seeded team, seeded decisions,
// lessons and trust rules are left alone. Trust rules the agent's replay
// turned ON go back to "suggested".

import { eq, inArray, like } from "drizzle-orm"
import { crDb } from "@/lib/control-room/db"
import { crAgentRuns, crCalls, crCases, crDecisions, crLessons, crTrustRules } from "@/lib/control-room/schema"
import { listTraces, readTrace } from "./trace"

export async function purgeAgentRows(): Promise<Record<string, number>> {
  const agentCases = await crDb.select({ id: crCases.id }).from(crCases).where(eq(crCases.source, "agent"))
  const caseIds = agentCases.map((c) => c.id)
  const decisions = caseIds.length ? await crDb.select({ id: crDecisions.id }).from(crDecisions).where(inArray(crDecisions.caseId, caseIds)) : []
  const decisionIds = decisions.map((d) => d.id)
  const lessons = (await crDb.select().from(crLessons)).filter((l) => l.data.fromDecisionIds.some((id) => decisionIds.includes(id)) || l.id.endsWith("-agent"))
  const out: Record<string, number> = { cases: caseIds.length, decisions: decisionIds.length, lessons: lessons.length }
  if (lessons.length) await crDb.delete(crLessons).where(inArray(crLessons.id, lessons.map((l) => l.id)))
  if (decisionIds.length) await crDb.delete(crDecisions).where(inArray(crDecisions.id, decisionIds))
  if (caseIds.length) await crDb.delete(crCases).where(inArray(crCases.id, caseIds))
  out.calls = (await crDb.delete(crCalls).where(like(crCalls.id, "call-%")).returning({ id: crCalls.id })).length
  out.runs = (await crDb.delete(crAgentRuns).where(like(crAgentRuns.id, "run-%")).returning({ id: crAgentRuns.id })).length
  // Only rules the agent's replay switched (same id and change time as in a recorded trace).
  const replayed = new Set(listTraces().flatMap((t) => readTrace(t.file)).flatMap((l) => (l.type === "trust_rule" ? [`${l.rule.id}|${l.rule.changedAt}`] : [])))
  const rules = await crDb.select().from(crTrustRules)
  let reset = 0
  for (const r of rules) {
    if (r.status === "on" && replayed.has(`${r.id}|${r.data.changedAt}`)) {
      await crDb.update(crTrustRules).set({ status: "suggested", data: { ...r.data, status: "suggested", changedBy: undefined, changedAt: undefined } }).where(eq(crTrustRules.id, r.id))
      reset += 1
    }
  }
  out.rulesBackToSuggested = reset
  return out
}
