// After a person decides: record the decision, let the agent carry it out
// (call the pickup place back, make the approved change), and turn the
// decision into a proposed lesson for the shift lead to review.
//
// When the foundation service is in charge of decisions (POST /api/cr/decisions
// records the Decision and proposes the lesson), call carryOutDecision() only.

import type { Case, Decision, Lesson } from "@/lib/control-room/types"
import { worldNow } from "./clock"
import { agentProvider, emptyUsage, type Provider } from "./config"
import { findOrder } from "./data"
import { newLesson, summariseLesson } from "./learning"
import { runReadinessAgent, type RunResult } from "./loop"
import { personName } from "./people"
import type { CallbackBrief } from "./prompt"
import { getStore } from "./store"

export interface DecideInput {
  caseId: string
  optionId: string // an option id of the case, or "other"
  personId: string
  editedDetail?: string
  why?: string
  provider?: Provider
}

export interface DecideResult {
  decision: Decision
  carriedOut: RunResult
  lesson: Lesson
}

function briefFor(c: Case, d: Decision): CallbackBrief {
  const option = [c.suggestion, ...c.alternatives].find((o) => o.id === d.optionId)
  const label = d.optionId === "other" ? d.editedDetail ?? "another way" : option?.label ?? d.optionId
  return {
    caseId: c.id,
    decisionText: `${personName(d.personId)} chose: ${label}${d.editedDetail && d.optionId !== "other" ? ` (changed: ${d.editedDetail})` : ""}${d.why ? `. Why: ${d.why}` : ""}`,
    optionKey: d.optionId === "other" ? "other" : d.optionId.replace(/_\d+$/, ""),
    caseType: c.type,
    changes: (option?.changes ?? []).map((ch) => ({ kind: ch.kind, detail: ch.kind === "customer_message" && d.editedDetail ? d.editedDetail : ch.detail, amount_eur: ch.amountEur ?? null })),
  }
}

/** The agent carries out a decision a person already made (for the foundation's decide flow). */
export async function carryOutDecision(c: Case, d: Decision, provider?: Provider): Promise<RunResult> {
  const order = findOrder(c.orderId)
  if (!order) throw new Error(`No order ${c.orderId}`)
  // On the dataset clock the callback happens shortly after the case; with CR_CLOCK=real, at the decision time.
  const startAt = process.env.CR_CLOCK === "real" ? new Date(d.at) : new Date(new Date(c.createdAt).getTime() + 25 * 60_000)
  return runReadinessAgent(order.reference, { provider, callback: briefFor(c, d), startAt })
}

/** CLI / local flow: record the decision, carry it out, propose a lesson. */
export async function decideAndCarryOut(input: DecideInput): Promise<DecideResult> {
  const store = getStore()
  const c = await store.getCase(input.caseId)
  if (!c) throw new Error(`No case ${input.caseId}`)
  const ids = [c.suggestion, ...c.alternatives].map((o) => o.id)
  if (input.optionId !== "other" && !ids.includes(input.optionId)) throw new Error(`Case ${c.id} has no option ${input.optionId}. Options: ${ids.join(", ")}`)
  const at = new Date(Math.max(new Date(c.createdAt).getTime() + 25 * 60_000, worldNow().getTime())).toISOString()
  const decision: Decision = {
    id: `decision-${c.id.replace(/^case-/, "")}`,
    caseId: c.id,
    personId: input.personId,
    optionId: input.optionId,
    ...(input.editedDetail ? { editedDetail: input.editedDetail } : {}),
    ...(input.why ? { why: input.why } : {}),
    at,
  }
  await store.saveDecision(decision)
  await store.saveCase({ ...c, status: "decided" })
  const carriedOut = await carryOutDecision({ ...c, status: "decided" }, decision, input.provider)
  const text = await summariseLesson(c, decision, { provider: input.provider ?? agentProvider(), usage: emptyUsage() })
  const lesson = newLesson(c, decision, text, at)
  await store.saveLesson(lesson)
  return { decision, carriedOut, lesson }
}

/** The shift lead accepts (or retires) a lesson. */
export async function reviewLesson(lessonId: string, accept: boolean, reviewerId: string, editedText?: string): Promise<Lesson> {
  const store = getStore()
  const lesson = (await store.listLessons()).find((l) => l.id === lessonId)
  if (!lesson) throw new Error(`No lesson ${lessonId}`)
  const next: Lesson = { ...lesson, text: editedText?.trim() || lesson.text, status: accept ? "accepted" : "retired", reviewedBy: reviewerId }
  await store.saveLesson(next)
  return next
}
