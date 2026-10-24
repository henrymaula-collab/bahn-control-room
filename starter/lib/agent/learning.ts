// Learning hooks for the Readiness agent. A person's decision becomes a
// lesson (reviewed by a shift lead before the agent relies on it); the next
// case at the same pickup place or customer uses accepted lessons and says
// so: "Learned from Aino's decision on 21 Oct: ...".
//
// summariseLesson(case, decision) has the same arguments as the foundation's
// template version in lib/control-room/learning.ts; this one asks the model
// (async) and falls back to the template when there is no model.

import type { Case, Decision, Lesson } from "@/lib/control-room/types"
import { dayLabel } from "./clock"
import { agentProvider, callModel, emptyUsage, type Provider, type Usage } from "./config"
import { site } from "./data"
import { personName } from "./people"
import { structured } from "./providers"

export interface LessonScopeQuery {
  placeId?: string
  customerId?: string
  country?: string
  caseType?: string
}

/** Accepted lessons that apply to this pickup place, customer or country. */
export function acceptedLessons(lessons: Lesson[], q: LessonScopeQuery): Lesson[] {
  return lessons.filter((l) => {
    if (l.status !== "accepted") return false
    if (q.caseType && l.scope.caseType && !l.scope.caseType.startsWith("readiness")) return false
    if (l.scope.placeId) return l.scope.placeId === q.placeId
    if (l.scope.customerId) return l.scope.customerId === q.customerId
    if (l.scope.country) return l.scope.country === q.country && (!q.caseType || l.scope.caseType === q.caseType)
    return Boolean(q.caseType && l.scope.caseType === q.caseType)
  })
}

/** Where a lesson came from, in one line: "Learned from Aino's decision on 21 Oct". */
export function lessonOrigin(decisions: Decision[], lesson: Lesson): { who: string; when: string; at: string } {
  const decision = decisions.find((d) => lesson.fromDecisionIds.includes(d.id))
  const at = decision?.at ?? lesson.createdAt
  return { who: personName(decision?.personId), when: dayLabel(at), at }
}

export function lessonStatement(decisions: Decision[], lesson: Lesson): string {
  const o = lessonOrigin(decisions, lesson)
  return `Learned from ${o.who}'s decision on ${o.when}: ${lesson.text}`
}

function chosenOption(c: Case, d: Decision) {
  return [c.suggestion, ...c.alternatives].find((o) => o.id === d.optionId)
}

/** The no-model version: the pickup place's own words plus what the person chose. */
export function templateLesson(c: Case, d: Decision): string {
  const place = site(c.placeId)?.name ?? "This pickup place"
  const placeFact = c.facts.find((f) => f.source.kind === "pickup_place" && /(release|fee|ready|keys|only|hold|yard|warehouse)/i.test(f.statement))
  const option = chosenOption(c, d)
  const did = d.optionId === "other" ? d.editedDetail ?? d.why ?? "decided otherwise" : option?.label ?? "decided"
  const rule = placeFact ? placeFact.statement.replace(/^We /, `${place} `).replace(/\bwe\b/g, "they").replace(/\bour\b/g, "their").replace(/\bus\b/g, "them") : `${place}: ${c.headline}`
  return `${rule.replace(/\.$/, "")}. Next time: ${did.charAt(0).toLowerCase()}${did.slice(1)} before the pickup day.`
}

const LESSON_SCHEMA = {
  type: "object",
  properties: { text: { type: "string", description: "One or two plain sentences, at most 35 words" } },
  required: ["text"],
  additionalProperties: false,
}

/** Decision -> Lesson.text. Short, Bahn's tone, about the place or customer, never about the person. */
export async function summariseLesson(c: Case, d: Decision, opts: { provider?: Provider; usage?: Usage } = {}): Promise<string> {
  const provider = opts.provider ?? agentProvider()
  if (provider === "mock" || provider === "replay") return templateLesson(c, d)
  const option = chosenOption(c, d)
  const place = site(c.placeId)
  const facts = c.facts.map((f) => `- [${f.source.kind}${f.source.name ? `, ${f.source.name}` : ""}] ${f.statement}`).join("\n")
  try {
    const r = await structured<{ text: string }>(
      {
        provider,
        model: callModel(),
        system:
          "You write know-how for Bahn's Readiness desk (car delivery). From one decided case, write the one thing the next person or agent should know ahead of time about this pickup place or customer: the place's rule or habit and what to do before the pickup day. Plain English, Bahn's words (order, pickup place, driver, customer, release document, gig). No names of people, no praise, no 'AI'. At most 35 words.",
        prompt: `Pickup place: ${place?.name ?? "unknown"} (${place?.city ?? ""}, ${place?.country ?? ""})\nCase: ${c.headline}\nCase type: ${c.type}\nFacts:\n${facts}\nThe person chose: ${d.optionId === "other" ? d.editedDetail ?? "something else" : option?.label ?? d.optionId}${d.why ? `\nTheir reason: ${d.why}` : ""}`,
        schema: LESSON_SCHEMA,
      },
      opts.usage ?? emptyUsage(),
    )
    return r.text.trim()
  } catch {
    return templateLesson(c, d)
  }
}

export function newLesson(c: Case, d: Decision, text: string, at: string): Lesson {
  return {
    id: `lesson-${c.id.replace(/^case-/, "")}`,
    scope: { caseType: c.type, placeId: c.placeId, ...(c.placeId ? {} : { customerId: c.customerId }) },
    text,
    fromDecisionIds: [d.id],
    status: "proposed",
    createdAt: at,
  }
}
