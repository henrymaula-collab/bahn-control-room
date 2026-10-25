// History rows for hand-offs: "Sent to Sofie at 12:06" under the sender, with the line they wrote.
// Shaped as History's own rows (lib/control-room/history.ts), so History only needs one line:
//   rows.push(...handoffHistoryRows(state))   // in historyRows(), before the sort
// A live hand-off made after the room clock is filed on the room's day, as live decisions are.

import { hel } from "@/lib/control-room/fixtures/clock"
import { clock, dayKey } from "@/lib/control-room/format"
import type { HistoryRow } from "@/lib/control-room/history"
import { kindDef, kindOf } from "@/lib/control-room/kinds"
import type { EngineState } from "@/lib/control-room/service"
import { vehicleName } from "@/lib/control-room/v3"
import type { WithHandoffs } from "./store"

export function handoffHistoryRows(state: EngineState): HistoryRow[] {
  const names = new Map(state.people.map((p) => [p.id, p.name]))
  const rows: HistoryRow[] = []
  for (const c of state.cases as WithHandoffs[]) {
    if (!c.handoffs?.length) continue
    const order = state.world.byId.get(c.orderId)
    const place = c.placeId ? state.world.places.get(c.placeId) : undefined
    const kindKey = kindOf(c)
    for (const h of c.handoffs) {
      const to = names.get(h.to) ?? h.to
      rows.push({
        caseId: c.id,
        reference: order?.reference ?? "",
        car: vehicleName(order),
        place: place?.name ?? "",
        ...(place?.country ? { country: place.country } : {}),
        kindKey,
        kindLabel: kindDef(kindKey).label,
        headline: c.headline,
        decision: `Sent to ${to} at ${clock(h.at)}`,
        ...(h.note ? { reason: h.note } : {}),
        by: { id: h.from, name: names.get(h.from) ?? h.from },
        shownAt: h.at <= state.now ? h.at : hel(dayKey(state.now), clock(h.at)),
        at: h.at,
        counted: `Sent to ${to}`,
        live: true,
      })
    }
  }
  return rows
}
