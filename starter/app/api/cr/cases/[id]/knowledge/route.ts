import { NextResponse } from "next/server"
import { getCaseKnowledge } from "@/lib/control-room/service"
import { fail } from "../../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/cases/:id/knowledge -> CaseKnowledge (types-chat.ts): what the agent knows about this kind of case. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const knowledge = await getCaseKnowledge(id)
  return knowledge ? NextResponse.json(knowledge) : fail("Case not found", 404)
}
