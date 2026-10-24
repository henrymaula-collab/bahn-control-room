import { NextResponse } from "next/server"
import { setOnShift } from "@/lib/control-room/store"
import { body, fail } from "../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/cr/people/:id { onShift: boolean } -> OpsPerson. For demos: take a desk off shift to see the next-shift queue. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const input = await body<{ onShift: boolean }>(request)
  if (typeof input.onShift !== "boolean") return fail("onShift (boolean) is required")
  const person = await setOnShift(id, input.onShift)
  if (!person) return fail("Person not found", 404)
  return NextResponse.json(person)
}
