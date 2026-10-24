// npm run demo:reset — restore the two-round demo (scripts/lib/demo-reset.ts).
// Export the database first; dotenv/config reads .env, not .env.local:
//   export DATABASE_URL=postgres://controlroom:controlroom@localhost:5438/<db>

import "dotenv/config"
import { listTraces } from "../lib/agent/trace"
import { closeCrDb } from "../lib/control-room/db"
import { applyDemoDepth } from "../lib/demo/apply"
import { DEMO } from "../lib/demo/scenario"
import { databaseName, demoReset } from "./lib/demo-reset"

/**
 * The agent's recorded call-backs for the two rounds (DEMO.round1/round2.callbacks): POST
 * /api/cr/agent/carry-out replays the one for the option the person chose (replay mode, no model).
 * The reset stores none of them; it checks that each recording is in traces/ and is for its option.
 */
function checkCallbacks(): string[] {
  const traces = listTraces()
  const lines: string[] = []
  for (const round of [DEMO.round1, DEMO.round2]) {
    const ready: string[] = []
    for (const [optionId, runId] of Object.entries(round.callbacks)) {
      const trace = traces.find((candidate) => candidate.runId === runId)
      if (!trace) throw new Error(`Recorded call-back ${runId} (${round.reference}, ${optionId}) is missing from traces/`)
      if (trace.optionKey !== optionId || trace.orderRef !== round.reference) throw new Error(`Recorded call-back ${runId} is for ${trace.orderRef} ${trace.optionKey}, not ${round.reference} ${optionId}`)
      ready.push(optionId)
    }
    lines.push(`${round.reference}: ${ready.join(", ")}`)
  }
  return lines
}

async function main() {
  console.log(`demo:reset on database "${databaseName()}"`)
  const s = await demoReset()
  // The demo cases' depth (lib/demo/depth.ts): the agent's calls go to the database; the rest is read in memory.
  const depth = await applyDemoDepth()
  console.log(`Demo depth: ${depth.calls.length} call(s) on the demo cases (${depth.calls.join(", ")}).`)
  console.log(`Seeded ${s.decisions} made-up past decisions; replayed ${s.replayed.length} recorded agent runs.`)
  console.log(`Round 1 ${s.round1.caseId}: ${s.round1.status}, for ${s.round1.routedTo}. Seller hold: ${s.sellerHold.line} (${s.sellerHold.needed} needed).`)
  console.log(`Round 2 ${s.round2.caseId}: stored ${s.round2.stored}, shown ${s.round2.visible} (shows after round 1 is decided), for ${s.round2.routedTo}.`)
  console.log(`Carry-out replays a recorded call-back for ${checkCallbacks().join("; ")}.`)
  console.log(`Fast-forward ${s.fastForward.caseId}: ${s.fastForward.status}; proposal ${s.fastForward.ruleId} is ${s.fastForward.ruleStatus} (${s.fastForward.line}).`)
  await closeCrDb()
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
