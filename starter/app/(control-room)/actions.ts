"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { postDecision, postLessonReview, postTrustRule } from "@/lib/control-room/client"
import type { TrustRule } from "@/lib/control-room/types"
import { PERSON_COOKIE, currentPersonId } from "./_ui/session"

export async function choosePerson(personId: string) {
  const jar = await cookies()
  jar.set(PERSON_COOKIE, personId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 })
}

/** Saves the choice at once. Called again with the same id to add the "why". */
export async function decide(input: { id: string; caseId: string; optionId: string; why?: string }) {
  const personId = await currentPersonId()
  return postDecision({ ...input, personId })
}

export async function setTrustRule(id: string, status: TrustRule["status"]) {
  const personId = await currentPersonId()
  const rule = await postTrustRule(id, status, personId)
  revalidatePath("/lead")
  return rule
}

export async function reviewLesson(id: string, action: "accept" | "retire" | "edit", text?: string) {
  const personId = await currentPersonId()
  const lesson = await postLessonReview(id, action, personId, text)
  revalidatePath("/lead")
  return lesson
}
