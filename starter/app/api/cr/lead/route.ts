import { NextResponse } from "next/server"
import { getLead } from "@/lib/control-room/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/lead -> { team, coverage, lessons: { proposed, accepted }, trustRules, today, money } */
export async function GET() {
  return NextResponse.json(await getLead())
}
