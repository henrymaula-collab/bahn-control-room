import { NextRequest, NextResponse } from "next/server"
import { getDesk } from "@/lib/control-room/service"
import { fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/desk?person=<id> -> { person, focus, queue, quiet } */
export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("person")
  if (!personId) return fail("Add ?person=<id>. GET /api/cr/people lists the team.")
  const desk = await getDesk(personId)
  if (!desk) return fail("Person not found", 404)
  return NextResponse.json(desk)
}
