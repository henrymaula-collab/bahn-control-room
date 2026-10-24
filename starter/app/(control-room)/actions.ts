"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { dataSource, postDecision, postLessonReview, postTrustRule } from "@/lib/control-room/client"
import type { TrustRule } from "@/lib/control-room/types"
import { PERSON_COOKIE, currentPersonId } from "./_ui/session"

export async function choosePerson(personId: string) {
  const jar = await cookies()
  jar.set(PERSON_COOKIE, personId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 })
}

/**
 * Saves the decision, then the agent carries it out. Both callers post once per decision, with the
 * reason in the same post (the card's sheet and the chat's tap), so this is the last post. The engine
 * updates a decision in place only while the case is "decided"; carry-out makes it "done".
 */
export async function decide(input: { id: string; caseId: string; optionId: string; why?: string; editedDetail?: string }) {
  const personId = await currentPersonId()
  const decision = await postDecision({ ...input, personId })
  await carryOut(input.caseId)
  return decision
}

/**
 * POST /api/cr/agent/carry-out: the agent calls the pickup place back and makes the approved change
 * (replayed from a recording unless CR_AGENT_PROVIDER names a model). The decision is already saved,
 * so a failure here never fails it; a live model run that takes longer goes on without the person waiting.
 */
async function carryOut(caseId: string) {
  if (dataSource() !== "api") return
  const h = await headers()
  const base = process.env.CR_API_BASE ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? `127.0.0.1:${process.env.PORT ?? 3000}`}`
  const run = fetch(`${base}/api/cr/agent/carry-out`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseId }),
  })
    .then(async (res) => {
      // In replay mode a case without a recorded call-back stays decided (one line in the server log).
      if (!res.ok) console.warn(`carry-out ${caseId}: ${res.status} ${(await res.text()).slice(0, 200)}`)
    })
    .catch((error) => console.warn(`carry-out ${caseId}: ${error instanceof Error ? error.message : String(error)}`))
  await Promise.race([run, new Promise((resolve) => setTimeout(resolve, 8000))])
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
