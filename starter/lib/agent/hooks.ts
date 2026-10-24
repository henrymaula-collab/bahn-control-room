// Plug the agent into the foundation's learning loop: the LLM lesson
// summariser replaces the template (setLessonSummariser), with the full case
// (facts included) loaded from the store.

import type { Case } from "@/lib/control-room/types"
import { setLessonSummariser, templateSummariser } from "@/lib/control-room/learning"
import { getStoredCase } from "@/lib/control-room/store"
import { agentProvider } from "./config"
import { summariseLesson } from "./learning"

let registered = false

export function registerAgentHooks(): void {
  if (registered) return
  registered = true
  setLessonSummariser(async (input) => {
    const provider = agentProvider("replay")
    if (provider === "mock" || provider === "replay") return templateSummariser(input)
    const full = ((await getStoredCase(input.case.id)) ?? { ...input.case, facts: [], agentSteps: [], reasons: [], status: "decided", desk: "ops-readiness", orderId: "", createdAt: input.decision.at }) as Case
    try {
      return await summariseLesson(full, input.decision, { provider })
    } catch {
      return templateSummariser(input)
    }
  })
}
