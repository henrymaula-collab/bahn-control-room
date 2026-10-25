import { NextResponse } from "next/server"
import { colleagues, sendToColleague, undoHandoff } from "@/lib/handoff/store"
import { body, fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/cr/handoff?case=<caseId>&person=<personId>
 * The colleagues this person could send the case to, the recommended one first, each with one line
 * that is true from the data. -> { pick, others }
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const caseId = url.searchParams.get("case")
  const person = url.searchParams.get("person")
  if (!caseId || !person) return fail("case and person are required")
  const result = await colleagues(caseId, person)
  if (!result) return fail("Case or person not found", 404)
  return NextResponse.json(result)
}

/**
 * POST /api/cr/handoff { caseId, from, to, note? }
 * Moves a case that waits for `from` to `to`'s Your tasks and records the hand-off on the case.
 * -> { case, handoff }
 */
export async function POST(request: Request) {
  const input = await body<{ caseId: string; from: string; to: string; note?: string }>(request)
  if (!input.caseId || !input.from || !input.to) return fail("caseId, from and to are required")
  const result = await sendToColleague({ caseId: input.caseId, from: input.from, to: input.to, note: input.note })
  if ("error" in result) return fail(result.error ?? "Failed", result.status)
  return NextResponse.json(result)
}

/**
 * DELETE /api/cr/handoff { caseId, personId }
 * Undo: the last hand-off goes back to the sender, while the colleague has not decided it.
 */
export async function DELETE(request: Request) {
  const input = await body<{ caseId: string; personId: string }>(request)
  if (!input.caseId || !input.personId) return fail("caseId and personId are required")
  const result = await undoHandoff({ caseId: input.caseId, personId: input.personId })
  if ("error" in result) return fail(result.error ?? "Failed", result.status)
  return NextResponse.json(result)
}
