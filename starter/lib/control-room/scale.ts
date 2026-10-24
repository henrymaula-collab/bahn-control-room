// The scale toggle. CR_SCALE=300 adds 300 made-up quiet, checked orders so the
// board can be shown with hundreds of orders. Off by default. Deterministic:
// the same number always makes the same orders. Fiction, like everything else.

import type { OrderCheckResult } from "./checks"
import type { World } from "./world"

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAGES = [
  { status: "WAITING_FOR_PICKUP", checks: ["Driver booked", "Pickup place confirmed by phone", "Release code on file"] },
  { status: "IN_TRANSIT", checks: ["Position from the driver app", "On time for the delivery promise", "No message waiting for an answer"] },
  { status: "DELIVERED", checks: ["Delivered", "Handover photos checked", "No open alerts"] },
  { status: "NEW", checks: ["Pickup place confirmed by phone", "Gig published", "No message waiting for an answer"] },
] as const

export function scaleChecks(world: World, now: string, count = Number(process.env.CR_SCALE ?? 0)): OrderCheckResult[] {
  if (!Number.isFinite(count) || count <= 0) return []
  const random = rng(20261024)
  const customers = [...world.customers.values()]
  const places = [...world.places.values()].filter((place) => place.city)
  // Make and model as they appear on real orders, so a made-up dot reads like a real car.
  const vehicles = [...new Set(world.orders.flatMap((order) => order.bundle.items.map((item) => `${item.vehicle.make} ${item.vehicle.model}`)))].sort()
  const out: OrderCheckResult[] = []
  for (let i = 0; i < count; i++) {
    const stage = STAGES[Math.floor(random() * STAGES.length)]!
    const minutesAgo = 2 + Math.floor(random() * 55)
    const at = new Date(new Date(now).getTime() - minutesAgo * 60_000).toISOString()
    const from = places[Math.floor(random() * places.length)]!
    const to = places[Math.floor(random() * places.length)]!
    const customer = customers[Math.floor(random() * customers.length)]!
    const id = `scale-${String(i + 1).padStart(4, "0")}`
    // Map fields draw from their own stream, so the fields above stay exactly as they were.
    const extra = rng(20261024 + 7919 * (i + 1))
    out.push({
      orderId: id,
      reference: `CD-43${String(1000 + i).padStart(4, "0")}`,
      state: "checked_quiet",
      checkedAt: now,
      checks: stage.checks.map((label) => ({ label, ok: true, source: "made-up order (CR_SCALE)", at })),
      flags: [],
      desk: null,
      synthetic: true,
      syntheticCustomer: customer.name,
      syntheticFrom: from.city,
      syntheticTo: to.city,
      syntheticStatus: stage.status,
      syntheticFromId: from.id,
      syntheticToId: to.id,
      syntheticVehicle: vehicles.length ? vehicles[Math.floor(extra() * vehicles.length)]! : "Car",
      syntheticProgress: Math.round((0.08 + extra() * 0.84) * 1000) / 1000,
    })
  }
  return out
}
