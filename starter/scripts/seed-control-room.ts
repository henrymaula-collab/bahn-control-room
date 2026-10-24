// Seeds the control room's own tables (made-up team, past decisions and their
// case records, lessons, trust-rule proposals). The logic lives in
// scripts/lib/seed-cr.ts so demo:reset can run it too.
//
// Run after `npm run db:seed`:  npm run db:seed:cr   (add -- --all to also
// clear agent cases, calls and runs).

import "dotenv/config"
import { closeCrDb } from "../lib/control-room/db"
import { seedControlRoom } from "./lib/seed-cr"

async function main() {
  const result = await seedControlRoom({ wipeAll: process.argv.includes("--all") })
  console.log(`Seeded ${result.people} made-up people, ${result.decisions} made-up past decisions (${result.records} case records), ${result.lessons} lessons, ${result.rules.length} trust-rule proposal(s).`)
  for (const rule of result.rules) console.log(`  ${rule.status}: ${rule.when} -> ${rule.then} (${rule.matched} of ${rule.total})`)
  await closeCrDb()
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
