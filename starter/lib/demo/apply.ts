// The database part of the demo depth: the agent's calls on the demo cases go
// to cr_calls, so get_calls and the chat's context find them. Run by
// npm run demo:reset after the reset (which clears all calls first).
// The rest of the depth is in memory (lib/demo/overlay.ts).

import { saveCall } from "@/lib/control-room/store"
import { DEMO_CALLS } from "./depth"

export async function applyDemoDepth(): Promise<{ calls: string[] }> {
  for (const call of DEMO_CALLS) await saveCall(call)
  return { calls: DEMO_CALLS.map((call) => call.id) }
}
