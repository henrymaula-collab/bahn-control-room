// cr_case_depth: write the baseline for every case (seed), read it for one
// case (chat). Reading never fails the chat: a missing table, a missing row or
// a row made for another case type or generator version is regenerated in
// memory from the same deterministic generator.

import { eq, inArray, not } from "drizzle-orm"
import { crCaseDepth } from "@/lib/chat/schema"
import { crDb } from "@/lib/control-room/db"
import { DEMO_ORDER_REFS, type DepthCase, generateAll, generateDepth } from "./generate"
import { type CaseDepth, DEPTH_VERSION } from "./types"

async function readRow(orderId: string): Promise<(typeof crCaseDepth.$inferSelect) | undefined> {
  try {
    const [row] = await crDb.select().from(crCaseDepth).where(eq(crCaseDepth.orderId, orderId)).limit(1)
    return row
  } catch {
    // No table yet (db:push not run on this database): the generator still answers.
    return undefined
  }
}

/** The baseline for one case: the stored row when it fits, else generated now. Null for the demo orders without a row. */
export async function depthForCase(c: DepthCase & { orderId: string }, now: string): Promise<CaseDepth | null> {
  const row = await readRow(c.orderId)
  if (row && DEMO_ORDER_REFS.has(row.reference)) return row.data
  if (row && row.version === DEPTH_VERSION && row.caseType === c.type) return row.data
  try {
    return generateDepth({ order: c.orderId, case: c, now })
  } catch {
    return null
  }
}

/** Seed: one row per non-demo order that has a case now. Replaces earlier generated rows; demo rows stay. */
export async function saveDepth(cases: (DepthCase & { orderId: string })[], now: string): Promise<CaseDepth[]> {
  const rows = generateAll(cases, now)
  const at = new Date()
  await crDb.transaction(async (tx) => {
    await tx.delete(crCaseDepth).where(not(inArray(crCaseDepth.reference, [...DEMO_ORDER_REFS])))
    if (rows.length)
      await tx.insert(crCaseDepth).values(rows.map((d) => ({
        orderId: d.orderId, reference: d.reference, caseId: d.caseId, caseType: d.caseType, version: d.v, synthetic: true, generatedAt: at, data: d,
      })))
  })
  return rows
}

/** Seed from the engine's current cases (every status: waiting, agent working, done). */
export async function seedDepth(): Promise<CaseDepth[]> {
  const { buildState } = await import("@/lib/control-room/service")
  const state = await buildState()
  return saveDepth(state.cases.map((c) => ({ id: c.id, orderId: c.orderId, type: c.type, createdAt: c.createdAt, facts: c.facts })), state.now)
}
