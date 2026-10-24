import { NextResponse } from "next/server"
import { runReadinessAgent } from "@/lib/agent/loop"
import { agentServer, routeProvider } from "@/lib/agent/server"
import { body, fail } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/cr/agent/run { order: "CD-420516", provider? }
 * Runs the Readiness agent on one order (or replays its recorded run when no
 * model is configured). -> { run, case, calls, handover }
 */
export async function POST(request: Request) {
  const input = await body<{ order: string; provider: string }>(request)
  if (!input.order) return fail("order is required")
  await agentServer()
  try {
    const res = await runReadinessAgent(input.order, { provider: routeProvider(input.provider) })
    return NextResponse.json({ run: res.run, case: res.case ?? null, calls: res.calls, handover: res.handover })
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500)
  }
}
