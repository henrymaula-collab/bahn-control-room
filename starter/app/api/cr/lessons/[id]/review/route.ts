import { NextResponse } from "next/server"
import { reviewLessonById } from "@/lib/control-room/service"
import { body, fail } from "../../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/cr/lessons/:id/review { accept: boolean, personId, text? } -> Lesson */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const input = await body<{ accept: boolean; personId: string; text?: string }>(request)
  if (typeof input.accept !== "boolean" || !input.personId) return fail("accept (boolean) and personId are required")
  const lesson = await reviewLessonById(id, input.accept, input.personId, input.text)
  if (!lesson) return fail("Lesson not found", 404)
  return NextResponse.json(lesson)
}
