import { NextResponse } from "next/server"
import { setTrustRule } from "@/lib/control-room/service"
import { body, fail } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/cr/trust-rules/:id { status: "on" | "off", personId } -> TrustRule (always reversible) */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const input = await body<{ status: "on" | "off"; personId: string }>(request)
  if ((input.status !== "on" && input.status !== "off") || !input.personId) return fail('status ("on" or "off") and personId are required')
  const rule = await setTrustRule(id, input.status, input.personId)
  if (!rule) return fail("Trust rule not found", 404)
  return NextResponse.json(rule)
}
