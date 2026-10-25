// The case as the chat reads it, with the recorded trace's clock times that name no day and no zone
// taken out of the option text and the agent's step lines (the Ferrari's "checks with the branch
// again at 10:00" is a UTC time: 12:00 in Hamburg, 13:00 on the room's clock). Track C's helper,
// so the card, the decided feed, the chat and its receipt say the same. The recorded traces stay as they are.

import { withoutBareTimes } from "@/app/(control-room)/_ui/card-line"
import type { Case, Option } from "@/lib/control-room/types"

const cleanOption = (o: Option): Option =>
  o && { ...o, effect: withoutBareTimes(o.effect), changes: o.changes?.map((ch) => (ch.detail ? { ...ch, detail: withoutBareTimes(ch.detail) } : ch)) }

export function cleanCase(c: Case): Case {
  return {
    ...c,
    suggestion: cleanOption(c.suggestion),
    alternatives: c.alternatives.map(cleanOption),
    ...(c.agentSteps ? { agentSteps: c.agentSteps.map((s) => ({ ...s, summary: withoutBareTimes(s.summary) })) } : {}),
  }
}

export { withoutBareTimes }
