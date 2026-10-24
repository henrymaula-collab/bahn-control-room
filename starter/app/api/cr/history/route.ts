import { NextRequest, NextResponse } from "next/server"
import { getHistory } from "@/lib/control-room/history"
import { fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/cr/history?person=<id>[&scope=everyone] -> HistoryView (lib/control-room/history.ts)
 * The person's finished cases, newest first, each with what was decided, the reason, the
 * chat, the kind and what it counted toward. A shift lead can ask for everyone's.
 */
export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("person")
  if (!personId) return fail("Add ?person=<id>. GET /api/cr/people lists the team.")
  const scope = request.nextUrl.searchParams.get("scope") === "everyone" ? "everyone" : "mine"
  const view = await getHistory(personId, scope)
  if (!view) return fail("Person not found", 404)
  return NextResponse.json(view)
}
