// demo:reset — put the whole demo back, from any state (VISION_V4.md, two rounds).
//
// 1. Reseed the control room's own tables, agent rows included: the made-up
//    team and history, case records, lessons, the trust proposals (seed-cr.ts).
//    Live decisions, records, lessons and any rule someone turned on are gone.
// 2. Replay the agent's recorded first looks (DEMO.replay): its cases, calls
//    (with audio) and runs come back exactly as recorded. Runs that belong to a
//    later moment of the story are left out (DEMO.skipped says why), so no
//    lesson from Aino's round-1 decision exists before she makes it.
// 3. Round 1 waits for Aino; round 2 is stored but held back until round 1 is
//    decided, for Sofie; the fast-forward proposal is suggested, not on.
// 4. The chat workstream's messages (cr_chat_messages, when the table exists)
//    are cleared, so every thread starts with its opener.
// Deterministic and idempotent: run it twice, get the same rows.

import { sql } from "drizzle-orm"
import { initStore } from "../../lib/agent/store"
import { replayTrace } from "../../lib/agent/loop"
import { listTraces } from "../../lib/agent/trace"
import { crDb } from "../../lib/control-room/db"
import { buildState, getKinds, refreshTrustRules } from "../../lib/control-room/service"
import { getStoredCase, saveCase } from "../../lib/control-room/store"
import type { Routing } from "../../lib/control-room/types"
import { DEMO, round2Case } from "../../lib/demo/scenario"
import { seedControlRoom } from "./seed-cr"

export type ResetSummary = {
  database: string
  decisions: number
  replayed: string[]
  round1: { caseId: string; status: string; routedTo: string | null }
  round2: { caseId: string; stored: boolean; visible: boolean; routedTo: string | null }
  fastForward: { caseId: string; status: string | null; ruleId: string; ruleStatus: string | null; line: string | null }
  sellerHold: { line: string; needed: number }
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" })

export function databaseName(url = process.env.DATABASE_URL ?? "postgres://controlroom:controlroom@localhost:5438/controlroom") {
  try { return new URL(url).pathname.replace(/^\//, "") || "?" } catch { return "?" }
}

export async function demoReset(): Promise<ResetSummary> {
  // 1. Seed, agent rows included.
  const seeded = await seedControlRoom({ wipeAll: true })

  // 2. The agent's recorded first looks.
  await initStore("foundation")
  const traces = listTraces()
  const replayed: string[] = []
  for (const runId of DEMO.replay) {
    const trace = traces.find((candidate) => candidate.runId === runId)
    if (!trace) throw new Error(`Recorded run ${runId} is missing from traces/`)
    await replayTrace(trace.file)
    replayed.push(runId)
  }

  // 3. Who gets the two rounds, with the counts that say why.
  let state = await buildState()
  const net = (personId: string, filter: (row: (typeof state.decisions)[number]) => boolean = () => true) =>
    state.decisions.filter((row) => row.personId === personId && !row.laterChanged && filter(row)).length
  const since = (personId: string) => {
    const first = state.decisions.filter((row) => row.personId === personId).map((row) => row.at).sort()[0]
    return first ? ` since ${MONTH.format(new Date(first))}` : ""
  }
  const onShift = state.people.filter((person) => person.onShift && person.role === "ops" && person.desks.includes("ops-readiness"))
  const ainoCount = net(DEMO.round1.personId)
  const most = onShift.every((person) => person.id === DEMO.round1.personId || net(person.id) <= ainoCount)
  const round1Routing: Routing = {
    personId: DEMO.round1.personId,
    why: `New kind of case: nobody has decided a seller hold before. Sent to you because you have decided ${ainoCount} pickup readiness cases${since(DEMO.round1.personId)}${most ? ", the most of anyone on shift" : ""}.`,
    mode: "best_record",
    at: state.now,
  }
  const round1 = await getStoredCase(DEMO.round1.caseId)
  if (!round1) throw new Error(`Round 1 case ${DEMO.round1.caseId} was not restored by the replay`)
  await saveCase({ ...round1, status: "waiting_for_person", routedTo: round1Routing }, "agent")

  const sweden = net(DEMO.round2.personId, (row) => row.country === "SE")
  const round2Routing: Routing = {
    personId: DEMO.round2.personId,
    why: `Sent to you because you have handled ${sweden} pickup readiness case${sweden === 1 ? "" : "s"} in Sweden${since(DEMO.round2.personId)}, and you speak Swedish.`,
    mode: "best_record",
    at: state.now,
  }
  await saveCase(round2Case(state.world, state.now, round2Routing), "agent")

  // 4. Chat threads start from their openers again.
  const chat = await crDb.execute(sql`SELECT to_regclass('public.cr_chat_messages') AS t`) as unknown as { t: string | null }[]
  if (chat[0]?.t) await crDb.execute(sql`TRUNCATE cr_chat_messages`)

  await refreshTrustRules()
  state = await buildState()
  const kinds = (await getKinds(state)).kinds
  const r1 = state.cases.find((c) => c.id === DEMO.round1.caseId)
  const r2Stored = await getStoredCase(DEMO.round2.caseId)
  const r2 = state.cases.find((c) => c.id === DEMO.round2.caseId)
  const ff = state.cases.find((c) => c.id === DEMO.fastForward.caseId)
  const rule = state.rules.find((candidate) => candidate.id === DEMO.fastForward.ruleId)
  const seller = kinds.find((kind) => kind.kindKey === DEMO.kind)
  const known = kinds.find((kind) => kind.kindKey === DEMO.fastForward.kindKey)
  return {
    database: databaseName(),
    decisions: seeded.decisions,
    replayed,
    round1: { caseId: DEMO.round1.caseId, status: r1?.status ?? "missing", routedTo: r1?.routedTo?.personId ?? null },
    round2: { caseId: DEMO.round2.caseId, stored: !!r2Stored, visible: !!r2, routedTo: r2Stored?.routedTo?.personId ?? null },
    fastForward: { caseId: DEMO.fastForward.caseId, status: ff?.status ?? null, ruleId: DEMO.fastForward.ruleId, ruleStatus: rule?.status ?? null, line: known?.line ?? null },
    sellerHold: { line: seller?.line ?? "New kind of case", needed: seller?.needed ?? 16 },
  }
}
