import { NextRequest, NextResponse } from "next/server"
import { getOverview } from "@/lib/control-room/service"
import { fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/overview?person=<id> -> Overview (types-v3.ts): counts, every car active today, this person's cases */
export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("person")
  if (!personId) return fail("Add ?person=<id>. GET /api/cr/people lists the team.")
  const view = await getOverview(personId)
  if (!view) return fail("Person not found", 404)
  return NextResponse.json(view)
}
