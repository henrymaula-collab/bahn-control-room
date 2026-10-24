import { NextResponse } from "next/server"
import { type DecideInput, decide } from "@/lib/control-room/service"
import { body, fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/cr/decisions { caseId, personId, optionId, editedDetail?, why? }
 * Records the decision, marks the case decided, proposes a lesson and
 * recomputes trust-rule suggestions. -> { decision, case, lesson, trustRules }
 */
export async function POST(request: Request) {
  const input = await body<DecideInput>(request)
  if (!input.caseId || !input.personId || !input.optionId) return fail("caseId, personId and optionId are required")
  const result = await decide(input as DecideInput)
  if ("error" in result) return fail(result.error ?? "Failed", result.status)
  return NextResponse.json(result)
}
