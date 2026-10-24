import { NextRequest, NextResponse } from "next/server"
import { getWork } from "@/lib/control-room/service"
import { fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/work?person=<id> -> WorkLists (types-v3.ts): needYou, agentWorking, doneToday */
export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("person")
  if (!personId) return fail("Add ?person=<id>. GET /api/cr/people lists the team.")
  const lists = await getWork(personId)
  if (!lists) return fail("Person not found", 404)
  return NextResponse.json(lists)
}
