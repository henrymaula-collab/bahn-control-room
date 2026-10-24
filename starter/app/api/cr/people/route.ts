import { NextResponse } from "next/server"
import { listPeople } from "@/lib/control-room/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/people -> OpsPerson[] (made-up team) */
export async function GET() {
  return NextResponse.json(await listPeople())
}
