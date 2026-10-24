import { NextResponse } from "next/server"
import { carryOutDecision } from "@/lib/agent/callback"
import { agentServer, routeProvider } from "@/lib/agent/server"
import { appendTrace } from "@/lib/agent/trace"
import { getStoredCase, listDecisions, listLessons } from "@/lib/control-room/store"
import { body, fail } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/cr/agent/carry-out { caseId, provider? }
 * After POST /api/cr/decisions: the agent carries out the person's decision
 * (calls the pickup place back, makes the approved change) and the case is done.
 * -> { run, case, calls, handover }
 */
export async function POST(request: Request) {
  const input = await body<{ caseId: string; provider: string }>(request)
  if (!input.caseId) return fail("caseId is required")
  await agentServer()
  const c = await getStoredCase(input.caseId)
  if (!c) return fail("Case not found", 404)
  const decision = (await listDecisions()).filter((d) => d.caseId === c.id).at(-1)?.data
  if (!decision) return fail("No decision on this case yet", 409)
  try {
    const res = await carryOutDecision(c, decision, routeProvider(input.provider))
    const lesson = (await listLessons()).find((l) => l.fromDecisionIds.includes(decision.id))
    // A live run gets the decision and lesson appended to its new trace; a replay leaves the recording alone.
    if (res.run.mode !== "replay") appendTrace(res.traceFile, [{ type: "decision", decision }, ...(lesson ? [{ type: "lesson" as const, lesson }] : [])])
    return NextResponse.json({ run: res.run, case: res.case ?? null, calls: res.calls, handover: res.handover })
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500)
  }
}
