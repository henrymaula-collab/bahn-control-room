import { NextResponse } from "next/server"
import { replayAll } from "@/lib/agent/loop"
import { agentServer } from "@/lib/agent/server"
import { body } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/cr/agent/replay { order? }
 * Loads the recorded agent runs (cases, calls, decisions, lessons) into the
 * control room tables, oldest first, so a fresh clone shows the agent's work
 * without a model. -> { replayed: [{ runId, order, outcome }] }
 */
export async function POST(request: Request) {
  const input = await body<{ order: string }>(request)
  await agentServer()
  const replayed = await replayAll(input.order)
  return NextResponse.json({ replayed })
}
