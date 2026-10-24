// npm run demo:reset — restore the two-round demo (scripts/lib/demo-reset.ts).
// Export the database first; dotenv/config reads .env, not .env.local:
//   export DATABASE_URL=postgres://controlroom:controlroom@localhost:5438/<db>

import "dotenv/config"
import { closeCrDb } from "../lib/control-room/db"
import { databaseName, demoReset } from "./lib/demo-reset"

async function main() {
  console.log(`demo:reset on database "${databaseName()}"`)
  const s = await demoReset()
  console.log(`Seeded ${s.decisions} made-up past decisions; replayed ${s.replayed.length} recorded agent runs.`)
  console.log(`Round 1 ${s.round1.caseId}: ${s.round1.status}, for ${s.round1.routedTo}. Seller hold: ${s.sellerHold.line} (${s.sellerHold.needed} needed).`)
  console.log(`Round 2 ${s.round2.caseId}: stored ${s.round2.stored}, shown ${s.round2.visible} (shows after round 1 is decided), for ${s.round2.routedTo}.`)
  console.log(`Fast-forward ${s.fastForward.caseId}: ${s.fastForward.status}; proposal ${s.fastForward.ruleId} is ${s.fastForward.ruleStatus} (${s.fastForward.line}).`)
  await closeCrDb()
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
