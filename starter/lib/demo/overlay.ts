// Puts the demo cases' made-up depth (lib/demo/depth.ts) where the chat's read
// tools look: lib/agent/data.ts reads the packet's JSONL once and keeps each
// table as an array in memory; installDemoDepth() appends the demo rows to
// those arrays. The packet files stay as they are, and the engine (cards,
// derived cases, routing, counts) reads Postgres, so it never sees these rows.
// The chat calls installDemoDepth() in loadContext and adds placeNotes() to
// get_pickup_place and get_place_history (lib/chat/context.ts, lib/chat/depth.ts).
//
// Idempotent and cheap: call it before any lookup (the chat's loadContext).
// A row is added once, by id, even if the cache was cleared in between.

import { table } from "@/lib/agent/data"
import { DEMO_ORIGIN, DEMO_ROWS } from "./depth"

export { placeNotes, DEMO_ORDER_IDS, DEMO_PLACE_IDS } from "./depth"

/** Adds every demo row the table cache does not hold yet. Returns how many were added. */
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
  // An earlier version put the place notes into the pickup places' access notes; a running
  // server may still hold those rows. Put the packet's own row back (place notes now come via placeNotes()).
  const sites = table("sites")
  sites.forEach((row, i) => {
    if (row.data_origin !== DEMO_ORIGIN || typeof row.packet_pickup_access_note !== "string") return
    const { packet_pickup_access_note: original, data_origin: _origin, ...rest } = row
    void _origin
    sites[i] = { ...rest, pickup_access_note: original }
  })
  return changed
}
