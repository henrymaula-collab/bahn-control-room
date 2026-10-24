// Puts the demo cases' made-up depth (lib/demo/depth.ts) where the chat's read
// tools look: lib/agent/data.ts reads the packet's JSONL once and keeps each
// table as an array in memory. installDemoDepth() appends the demo rows to
// those arrays, and swaps the four demo pickup places' profile rows for a copy
// whose access note carries Bahn's notes on the place. The packet files stay as
// they are, and the engine (cards, derived cases, routing, counts) reads
// Postgres, so it never sees any of this.
//
// Idempotent and cheap: call it before any lookup (the chat's loadContext).
// A row is added once, by id, even if the cache was cleared in between.

import { table } from "@/lib/agent/data"
import { DEMO_ORIGIN, DEMO_ROWS, DEMO_SITE_NOTES } from "./depth"

export { placeNotes, DEMO_ORDER_IDS, DEMO_PLACE_IDS } from "./depth"

/** Adds every demo row the table cache does not hold yet. Returns how many rows changed. */
export function installDemoDepth(): number {
  let changed = 0
  for (const [name, rows] of Object.entries(DEMO_ROWS)) {
    const cached = table(name)
    const have = new Set(cached.map((row) => row.id))
    for (const row of rows) {
      if (have.has(row.id)) continue
      cached.push({ ...row })
      changed++
    }
  }
  const sites = table("sites")
  for (const [placeId, notes] of Object.entries(DEMO_SITE_NOTES)) {
    const i = sites.findIndex((row) => row.id === placeId)
    const packet = sites[i]
    if (!packet || packet.data_origin === DEMO_ORIGIN) continue
    const before = typeof packet.pickup_access_note === "string" ? packet.pickup_access_note : ""
    sites[i] = { ...packet, pickup_access_note: before ? `${before} ${notes}` : notes, packet_pickup_access_note: before, data_origin: DEMO_ORIGIN }
    changed++
  }
  return changed
}
