// The two-round demo (VISION_V4.md) as data. Kept outside lib/control-room on
// purpose: the engine never names an order; only this file and demo:reset do.
//
// Round 1: CD-420458, a seller hold on a Ferrari Roma at Calverona Hamburg.
//   The packet's only seller hold; nobody in the made-up history has decided one,
//   so it is a new kind. The case is the agent's recorded API run (German call).
// Round 2: CD-420442, a Bentley at Orvendin Cars Stockholm, a different pickup
//   place in another country. It appears only once round 1 is decided. Its slot,
//   driver, fee and release rule are the order's own data; the collection desk's
//   report of the seller's hold is MADE UP for the demo (recordRef "demo:...").
// Fast-forward: CD-420347 at Arvelano Hamburg, "details disagree while the gig
//   is posted", a kind with 29 of 30 agreeing answers from 4 people in the
//   made-up history. The shift lead turns the proposal on; the agent then
//   handles 347 alone.

import type { HeldBack } from "@/lib/control-room/service"
import type { Case, Fact, Option, Routing } from "@/lib/control-room/types"
import { dayTime } from "@/lib/control-room/vocab"
import type { World } from "@/lib/control-room/world"
import { rows } from "@/lib/present/bundle"

export const DEMO = {
  kind: "seller_hold",
  round1: {
    reference: "CD-420458",
    orderId: "ord-00458",
    caseId: "case-ord-00458-agent",
    personId: "p-aino",
    trace: "run-cd-420458-20261024-104612-g5n",
  },
  round2: {
    reference: "CD-420442",
    orderId: "ord-00442",
    caseId: "case-ord-00442-demo",
    personId: "p-sofie",
  },
  fastForward: {
    reference: "CD-420347",
    caseId: "case-ord-00347-facts_disagree",
    kindKey: "facts_disagree_open_gig",
    ruleId: "rule-kind-facts_disagree_open_gig-pause_gig",
    shiftLeadId: "p-kaisa",
  },
  /** Recorded first-look runs that make up the rest of the agent's day. */
  replay: [
    "run-cd-420458-20261024-104612-g5n",
    "run-cd-420516-20261024-105004-4sp",
    "run-cd-420015-20261024-105502-rx7",
  ],
  /** Recorded runs left out of the demo state, and why. */
  skipped: {
    "run-cd-420458-cb-20261024-104722-ivw": "the call back after Aino's decision: it happens live in round 1 (carry-out replays it)",
    "run-cd-420578-20261024-104904-o7d": "it applies the lesson from Aino's decision on 458, which in v4 is made live in round 1",
    "run-cd-420347-20261024-104951-kva": "handled under an ON rule: that is the fast-forward's end state, not its start",
  } as Record<string, string>,
} as const

const firstHand = (statement: string, at: string, name: string): Fact => ({
  id: "f-demo-hold",
  statement,
  source: { kind: "pickup_place", name, channel: "call", recordRef: "demo:seller-hold-report", at },
  strength: "stated",
})

/** The round-2 case, built from the order's own data plus the made-up report of the seller's hold. */
export function round2Case(world: World, now: string, routedTo: Routing): Case & HeldBack {
  const order = world.byId.get(DEMO.round2.orderId)
  if (!order) throw new Error(`Round 2 order ${DEMO.round2.reference} is not in the dataset`)
  const { bundle } = order
  const place = order.pickup
  const zone = place.timezone ?? "Europe/Stockholm"
  const slot = rows(bundle, "time_windows").find((row) => row.details.purpose === "SELECTED_PICKUP_SLOT" && row.details.is_selected)
  const promise = rows(bundle, "time_windows").find((row) => row.details.purpose === "CUSTOMER_DELIVERY_PROMISE" && row.details.is_selected)
  const assignment = rows(bundle, "work_assignments").find((row) => row.details.status === "ASSIGNED")
  const driverName = assignment ? bundle.dir.driverName(assignment.details.driver_id) ?? "a driver" : null
  const fee = assignment ? Math.round(Number(assignment.details.fee_cents ?? 0) / 100) : null
  const slotAt = String(slot?.details.start_at ?? now)
  const vehicle = bundle.items[0]?.vehicle as { make?: string; model?: string } | undefined
  const car = vehicle?.model ? `the ${vehicle.make === "Bentley" ? "Bentley" : vehicle.model}` : "the car"
  const minutesAgo = (m: number) => new Date(new Date(now).getTime() - m * 60_000).toISOString()

  const facts: Fact[] = [
    firstHand(`${car.replace(/^./, (ch) => ch.toUpperCase())} is ready, but as the seller we have put a hold on it: the buyer's invoice is still open. The collection desk will not hand it over until the hold is lifted and a signed release is on file.`, minutesAgo(14), `${place.name}, collection desk`),
    {
      id: "f-release-rule", statement: `${place.name} hands a car over only against a signed release document. None is on file for this order.`,
      source: { kind: "pickup_place", name: place.name, channel: "record", recordRef: `sites:${place.id}`, at: bundle.order.createdAt }, strength: "stated",
    },
    ...(slot ? [{
      id: "f-slot", statement: `Pickup slot at ${place.name}, ${place.city}: ${dayTime(slotAt, zone)} local time.`,
      source: { kind: "record" as const, name: "Order", channel: "record" as const, recordRef: `time_windows:${slot.id}`, at: bundle.order.createdAt }, strength: "confirmed" as const,
    }] : []),
    ...(assignment ? [{
      id: "f-driver", statement: `Driver booked: ${driverName}, gig fee EUR ${fee}. The driver sets off tomorrow morning.`,
      source: { kind: "record" as const, name: "Driver marketplace", channel: "record" as const, recordRef: `work_assignments:${assignment.id}`, at: String(assignment.details.accepted_at ?? bundle.order.createdAt) }, strength: "confirmed" as const,
    }] : []),
    ...(promise ? [{
      id: "f-promise", statement: `Delivery promised to ${order.customer.name} in ${order.delivery.city}: ${dayTime(String(promise.details.start_at), order.delivery.timezone ?? undefined)}.`,
      source: { kind: "record" as const, name: "Order", channel: "record" as const, recordRef: `time_windows:${promise.id}`, at: bundle.order.createdAt }, strength: "confirmed" as const,
    }] : []),
  ]

  const askCustomer: Option = {
    id: "ask_customer_for_release",
    label: "Ask the customer to settle with the seller and send the signed release",
    effect: "The agent drafts the request to the customer; you send it. The driver is held until the release is on file.",
    changes: [
      { kind: "customer_message", detail: "Request to the customer to settle the seller's invoice and send the signed release" },
      { kind: "driver_message", detail: "The driver is asked not to set off until the release is on file" },
    ],
  }
  const holdDriver: Option = {
    id: "pause_gig",
    label: "Hold the driver until the seller lifts the hold",
    effect: "The driver is asked not to set off tomorrow; the agent checks with the collection desk and brings the answer back to you.",
    changes: [{ kind: "driver_message", detail: "The driver is asked not to set off until the seller lifts the hold" }],
  }

  return {
    id: DEMO.round2.caseId,
    orderId: order.id,
    desk: "ops-readiness",
    type: "readiness.release_document_missing",
    headline: `${car.replace(/^./, (ch) => ch.toUpperCase())} is ready at ${place.name}, but the seller has put a hold on it and no signed release is on file.`,
    decideBy: new Date(new Date(slotAt).getTime() - 3 * 3_600_000).toISOString(),
    reasons: ["papers_missing", "needs_the_customer"],
    facts,
    agentSteps: [
      { at: minutesAgo(16), kind: "read", summary: `Read the order and the profile of ${place.name}.`, factIds: ["f-release-rule", "f-slot", "f-driver", "f-promise"] },
      { at: minutesAgo(14), kind: "call", summary: `Called the collection desk at ${place.name}. The seller has put a hold on ${car} over an open invoice.`, factIds: ["f-demo-hold"] },
      { at: minutesAgo(12), kind: "lookup", summary: "Looked up the release document: none on file.", factIds: ["f-release-rule"] },
      { at: minutesAgo(11), kind: "propose", summary: `Stopped here and suggested: ${askCustomer.label.toLowerCase()}.` },
    ],
    suggestion: askCustomer,
    alternatives: [holdDriver],
    status: "waiting_for_person",
    routedTo,
    placeId: place.id,
    customerId: order.customer.id,
    createdAt: now,
    showAfter: { caseId: DEMO.round1.caseId, followPrecedent: true },
  }
}
