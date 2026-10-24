import { NextResponse } from "next/server"
import { getKinds } from "@/lib/control-room/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/cr/kinds -> { kinds: KindSummary[], gate: { needed, minPeople, lowerBound } }
 * Every kind of case people decided, plus the kinds of today's open cases:
 * novelty, agreement, "n of N" toward a proposal, "People answer this differently".
 */
export async function GET() {
  return NextResponse.json(await getKinds())
}
