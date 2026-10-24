// Seeds the control room's own tables (made-up team, past decisions and their
// case records, lessons, trust-rule proposals), then the baseline depth for
// every open or finished case (lib/depth: a short thread, a call, a note,
// documents, the pickup place's people, hours and earlier pickups). The logic
// lives in scripts/lib/seed-cr.ts and lib/depth/store.ts so demo:reset can run it too.
//
// Run after `npm run db:seed`:  npm run db:seed:cr   (add -- --all to also
// clear agent cases, calls and runs; -- --depth-only to write only the depth,
// e.g. after demo:reset, without touching people, decisions or cases).

import "dotenv/config"
import { closeCrDb } from "../lib/control-room/db"
import { seedDepth } from "../lib/depth/store"
import { seedControlRoom } from "./lib/seed-cr"

async function main() {
  if (!process.argv.includes("--depth-only")) {
    const result = await seedControlRoom({ wipeAll: process.argv.includes("--all") })
    console.log(`Seeded ${result.people} made-up people, ${result.decisions} made-up past decisions (${result.records} case records), ${result.lessons} lessons, ${result.rules.length} trust-rule proposal(s).`)
    for (const rule of result.rules) console.log(`  ${rule.status}: ${rule.when} -> ${rule.then} (${rule.matched} of ${rule.total})`)
  }
  const depth = await seedDepth()
  console.log(`Seeded baseline depth for ${depth.length} made-up case record(s) (demo orders left to lib/demo): ${depth.map((d) => `${d.reference} ${d.messages.length}m ${d.calls.length}c ${d.documents.length}d`).join(", ") || "none"}.`)
  await closeCrDb()
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
