import { NextResponse } from "next/server"
import { getCaseDetail } from "@/lib/control-room/service"
import { fail } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/cases/:id -> { case, order, routedTo, lessons, calls, agentRuns, check, derived } */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const detail = await getCaseDetail(id)
  if (!detail) return fail("Case not found", 404)
  return NextResponse.json(detail)
}
