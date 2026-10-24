import { NextResponse } from "next/server"
import { listTraces, readTrace } from "@/lib/agent/trace"
import { fail } from "../../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/agent/traces/:runId -> the run's trace lines (steps, call, case, facts, end). */
export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params
  const t = listTraces().find((x) => x.runId === runId)
  if (!t) return fail("Trace not found", 404)
  return NextResponse.json({ runId, orderRef: t.orderRef, provider: t.provider, model: t.model, lines: readTrace(t.file) })
}
