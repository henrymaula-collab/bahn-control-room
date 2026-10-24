// The order-check engine. For every order it says what was checked, from the
// records, every time it is asked (reseed-safe: no order ids in code).
//
// States (contract `OrderCheck.state`):
//   needs_person   a decision needs authority the agent does not have (money,
//                  a customer, safety, a failed or pending action), or a hidden
//                  risk that no signal shows. These are the orders on the board.
//   agent_working  something is open, but it is legwork the agent may do
//                  without a yes: chase a pickup place, wait for a reply.
//   not_checked    nothing is open, but a check the order needs could not be
//                  made from the records ("An order nobody checked is not fine").
//   checked_quiet  every check the order needs passed. Back-office items
//                  (evidence after delivery, expense review, a system-set
//                  promise) stay listed as checks but do not ask for a person.
//
// The tiers follow research/02-dataset.md section 2: the five starter signals
// plus hidden-risk rules H1-H13, with H5 dropped (too noisy) and H7/H8/H10
// kept in a background queue. Every rule is generic; nothing names an order.

import { chosenWindows, latestTracking, milestones } from "../present/attention"
import { type Bundle, type RelatedRow, num, obj, rows, str, strings } from "../present/bundle"
import { label } from "../present/labels"
import { fmtDateTime } from "../present/time"
import type { Case, OrderCheck } from "./types"
import { type OrderWorld, type World, hoursFrom, worldNow } from "./world"

export type Tier = "person" | "agent" | "background" | "unchecked"

export type Flag = {
  code: string
  tier: Tier
  /** Plain sentence in Bahn's words. */
  label: string
  /** Where the fact comes from, e.g. "alerts:alert-x123". */
  source: string
  at?: string
}

export type CheckRow = OrderCheck["checks"][number]

export type OrderCheckResult = OrderCheck & {
  reference: string
  flags: Flag[]
  /** Which desk would own the decision, from the record's owner fields. */
  desk: string | null
  /** For the scale toggle: made-up orders are marked. */
  synthetic?: boolean
}

const LIVE = new Set(["ASSIGNED", "IN_PROGRESS"])
const OPEN_WORK = new Set(["OPEN", "NEEDS_EXTERNAL_INPUT", "IN_PROGRESS", "WAITING"])

function ref(collection: string, id: string) {
  return `${collection}:${id}`
}

function liveAssignments(bundle: Bundle): RelatedRow[] {
  return rows(bundle, "work_assignments").filter((row) => LIVE.has(str(row.details.status) ?? ""))
}

function pickupEndpoint(bundle: Bundle): RelatedRow | null {
  return rows(bundle, "order_endpoint_details").find((row) => row.details.boundary === "PICKUP") ?? null
}

function deliveryEndpoint(bundle: Bundle): RelatedRow | null {
  return rows(bundle, "order_endpoint_details").find((row) => row.details.boundary === "DELIVERY") ?? null
}

function lastMessage(bundle: Bundle, conversationId: string) {
  const list = bundle.messages.filter((message) => message.conversationId === conversationId && message.details.visibility !== "INTERNAL")
  return list[list.length - 1] ?? null
}

/** Shared lookups the cross-order rules need. */
type Context = {
  world: World
  now: string
  roadEstimates: Map<string, Record<string, unknown>>
}

function rulesFor(order: OrderWorld, ctx: Context): Flag[] {
  const { bundle } = order
  const { now, world } = ctx
  const flags: Flag[] = []
  const lane = bundle.order.lane
  const status = bundle.order.status
  const h = (value: string | null | undefined) => hoursFrom(now, value)
  const windows = chosenWindows(bundle)
  const live = liveAssignments(bundle)
  const pickupStart = windows.pickupSlot?.start ?? null
  const pickupIn = h(pickupStart)

  // ---- The five starter signals, tiered ----------------------------------
  for (const alert of bundle.alerts) {
    const severe = alert.severity === "high" || alert.severity === "critical"
    if (alert.status === "OPEN") {
      flags.push({
        code: "ALERT_OPEN", tier: severe ? "person" : "agent",
        label: `Open alert: ${label(alert.signal)}. ${alert.summary}`, source: ref("alerts", alert.id), at: alert.triggeredAt,
      })
    } else if (alert.status === "ACKNOWLEDGED") {
      const owner = bundle.dir.title(alert.details.owner)
      flags.push({
        code: "ALERT_OWNED", tier: severe ? "person" : "agent",
        label: `${label(alert.signal)}: owned by ${owner ?? "no one recorded"}, not resolved.`, source: ref("alerts", alert.id),
        at: str(alert.details.acknowledged_at) ?? alert.triggeredAt,
      })
    }
  }
  for (const row of rows(bundle, "incidents")) {
    if (str(row.details.resolved_at)) continue
    flags.push({
      code: "INCIDENT", tier: "person", label: `Incident: ${label(str(row.details.kind))}. ${str(row.details.reported_symptom) ?? ""}`.trim(),
      source: ref("incidents", row.id), at: str(row.details.opened_at) ?? undefined,
    })
  }
  for (const row of rows(bundle, "work_items")) {
    if (!OPEN_WORK.has(str(row.details.status) ?? "")) continue
    const due = str(row.details.due_at)
    const dueIn = h(due)
    const overdue = dueIn !== null && dueIn < 0
    const high = str(row.details.priority) === "high"
    const tier: Tier = overdue || (high && dueIn !== null && dueIn < 24) ? "person" : "agent"
    flags.push({
      code: overdue ? "WORK_OVERDUE" : "WORK_OPEN", tier,
      label: `${label(str(row.details.kind))}${overdue ? `: was due ${fmtDateTime(due)}` : due ? `: due ${fmtDateTime(due)}` : ""}.`,
      source: ref("work_items", row.id), at: due ?? undefined,
    })
  }
  for (const row of rows(bundle, "endpoint_claims")) {
    if (str(row.details.resolution_status) !== "OPEN") continue
    flags.push({ code: "CLAIM_OPEN", tier: "agent", label: `Unchecked claim about the ${label(str(row.details.field)).toLowerCase()}.`, source: ref("endpoint_claims", row.id), at: str(row.details.recorded_at) ?? undefined })
  }
  for (const row of rows(bundle, "agent_proposals")) {
    const s = str(row.details.status)
    if (s === "PENDING_REVIEW") {
      flags.push({ code: "PROPOSAL_PENDING", tier: "person", label: `Agent suggestion waiting for a person: ${str(row.details.summary) ?? ""}`.trim(), source: ref("agent_proposals", row.id), at: str(row.details.created_at) ?? undefined })
    } else if (s === "FAILED") {
      flags.push({ code: "PROPOSAL_FAILED", tier: "person", label: `Agent action failed: ${str(obj(row.details.execution)?.error) ?? str(row.details.summary) ?? ""}`.trim(), source: ref("agent_proposals", row.id), at: str(obj(row.details.execution)?.attempted_at) ?? undefined })
    } else if (s === "APPROVED_AWAITING_EXECUTION") {
      flags.push({ code: "PROPOSAL_APPROVED", tier: "agent", label: `Approved, not carried out yet: ${str(row.details.summary) ?? ""}`.trim(), source: ref("agent_proposals", row.id), at: str(obj(row.details.review)?.reviewed_at) ?? undefined })
    }
  }
  // A thread that a newer thread follows up is superseded by it.
  const followed = new Set(bundle.conversations.map((thread) => str(thread.details.follows_conversation_id)).filter(Boolean))
  for (const thread of bundle.conversations) {
    if (thread.status !== "OPEN" || followed.has(thread.id)) continue
    const waitingOn = str(thread.details.waiting_on)
    const last = lastMessage(bundle, thread.id)
    const counterparty = str(thread.details.counterparty_type)
    // Only a person may answer a customer, so a customer waiting on us needs one.
    const customerWaiting = !!last && last.authorType === "customer"
    const waitingOnCustomer = !!waitingOn && waitingOn.startsWith("CUSTOMER")
    if (customerWaiting || waitingOnCustomer) {
      flags.push({
        code: customerWaiting ? "CUSTOMER_WAITING" : "WAITING_ON_CUSTOMER", tier: "person",
        label: customerWaiting ? `The customer wrote at ${fmtDateTime(last!.authoredAt)} and has no answer yet.` : `Waiting for the customer: ${label(waitingOn)}.`,
        source: ref("conversations", thread.id), at: last?.authoredAt ?? thread.updatedAt,
      })
    } else {
      flags.push({
        code: "THREAD_OPEN", tier: "agent",
        label: waitingOn ? `Waiting on ${label(waitingOn).toLowerCase()}.` : `Open ${label(thread.category).toLowerCase()} thread with the ${counterparty ? label(counterparty).toLowerCase() : "other side"}.`,
        source: ref("conversations", thread.id), at: str(thread.details.next_check_at) ?? thread.updatedAt,
      })
    }
  }
  for (const row of rows(bundle, "custody_assets")) {
    if (!str(row.details.next_action)) continue
    flags.push({ code: "CUSTODY_OPEN", tier: "agent", label: `Key holder not confirmed: ${str(row.details.next_action)}`, source: ref("custody_assets", row.id), at: str(row.details.followup_due_at) ?? undefined })
  }
  for (const visit of rows(bundle, "site_visits")) {
    if (str(visit.details.outcome) === "VEHICLE_NOT_FOUND" && lane !== "cancelled") {
      flags.push({ code: "EMPTY_PICKUP", tier: "person", label: "The driver is at the pickup place and the car was not found.", source: ref("site_visits", visit.id), at: str(visit.details.arrived_at) ?? undefined })
    }
  }

  // ---- Hidden-risk rules (no signal, real risk) ---------------------------
  if (lane === "cancelled") {
    const payoutDue = rows(bundle, "work_assignments").filter((row) => str(row.details.cancellation_payout_decision) === "PAYOUT_DUE")
    const openClaims = rows(bundle, "expenses").filter((row) => str(row.details.status) === "SUBMITTED")
    if (payoutDue.length || openClaims.length) {
      const fee = payoutDue.reduce((sum, row) => sum + (num(row.details.fee_cents) ?? 0), 0) / 100
      flags.push({
        code: "H12_CANCELLED_COST_OPEN", tier: "person",
        label: `Cancelled, but money is still open: ${payoutDue.length ? `driver fee EUR ${fee.toFixed(0)} payout due` : ""}${payoutDue.length && openClaims.length ? " and " : ""}${openClaims.length ? `${openClaims.length} expense claim${openClaims.length > 1 ? "s" : ""} not reviewed` : ""}.`,
        source: ref("work_assignments", payoutDue[0]?.id ?? openClaims[0]!.id),
      })
    }
    return flags
  }

  const tracking = rows(bundle, "tracking_observations")
  // H1: in transit, last fix older than 3 h, and no tracking alert.
  if (status === "IN_TRANSIT" && tracking.length) {
    const last = [...tracking].sort((a, b) => String(b.details.received_at).localeCompare(String(a.details.received_at)))[0]!
    const age = -(h(str(last.details.received_at)) ?? 0)
    const gapAlert = bundle.alerts.some((alert) => alert.signal.includes("TRACKING") && alert.status !== "RESOLVED")
    if (age > 3 && !gapAlert) {
      flags.push({
        code: "H1_STALE_TRACKING_NO_ALERT", tier: "person",
        label: `In transit, last position ${age.toFixed(1)} h old and no alert was raised.`, source: ref("tracking_observations", last.id), at: str(last.details.received_at) ?? undefined,
      })
    }
  }
  // H2: ferry check-in within 12 h and the road estimate leaves under 60 min.
  for (const reservation of rows(bundle, "travel_reservations")) {
    const d = reservation.details
    if (d.kind !== "FERRY" || d.status !== "BOOKED" || d.check_in_confirmation === "CONFIRMED_BY_GATE_SCAN") continue
    const cutoffIn = h(str(d.check_in_cutoff_at))
    if (cutoffIn === null || cutoffIn <= 0 || cutoffIn >= 12 || !tracking.length) continue
    const road = ctx.roadEstimates.get(str(d.terminal_road_estimate_id) ?? "")
    if (!road) continue
    const last = [...tracking].sort((a, b) => String(b.details.observed_at).localeCompare(String(a.details.observed_at)))[0]!
    const planId = str(bundle.order.details.active_plan_id)
    const total = rows(bundle, "transport_segments").filter((seg) => seg.details.plan_id === planId).reduce((sum, seg) => sum + (num(seg.details.distance_km) ?? 0), 0)
    const remaining = num(last.details.distance_remaining_km) ?? total
    const roadKm = num(road.approximate_road_distance_km) ?? 0
    if (!roadKm) continue
    const left = Math.max(roadKm - (total - remaining), 0)
    const slowMinutes = (left / roadKm) * (num(road.drive_minutes_high) ?? 0)
    const arrivalSlow = new Date(new Date(str(last.details.observed_at)!).getTime() + slowMinutes * 60_000)
    const margin = (new Date(str(d.check_in_cutoff_at)!).getTime() - arrivalSlow.getTime()) / 60_000
    if (margin < 60) {
      flags.push({
        code: "H2_FERRY_CUTOFF_AT_RISK", tier: "person",
        label: `Ferry check-in closes ${fmtDateTime(str(d.check_in_cutoff_at))}. The road estimate leaves ${Math.round(margin)} min at the slow end. An estimate, so ask the driver.`,
        source: ref("travel_reservations", reservation.id), at: str(d.check_in_cutoff_at) ?? undefined,
      })
    }
  }
  // H3: pickup slot within 30 h and no driver booked.
  if ((status === "NEW" || status === "WAITING_FOR_PICKUP") && pickupStart && !live.length && pickupIn !== null && pickupIn < 30) {
    const offers = rows(bundle, "market_offers").filter((row) => str(row.details.status) === "PUBLISHED")
    flags.push({
      code: "H3_PICKUP_SOON_NO_DRIVER", tier: "person",
      label: `Pickup ${fmtDateTime(pickupStart, windows.pickupSlot?.zone)} and no driver booked${offers.length ? " (gig published, nobody took it)" : " (gig not published)"}.`,
      source: ref("time_windows", findWindowId(bundle, "SELECTED_PICKUP_SLOT", true) ?? ""), at: pickupStart,
    })
  }
  // H3b: intake draft with an unselected pickup slot within 30 h.
  if (status === "NEW" && !pickupStart) {
    const draft = rows(bundle, "time_windows").find((row) => row.details.purpose === "SELECTED_PICKUP_SLOT")
    const draftIn = h(str(draft?.details.start_at))
    if (draft && draftIn !== null && draftIn < 30) {
      flags.push({
        code: "H3b_DRAFT_SLOT_SOON", tier: "person",
        label: `Still being prepared, with a pickup slot ${fmtDateTime(str(draft.details.start_at), str(draft.details.timezone))}.`,
        source: ref("time_windows", draft.id), at: str(draft.details.start_at) ?? undefined,
      })
    }
  }
  // H4 / H4b / H9: can the driver credibly reach the pickup?
  const reservationsByAssignment = new Set(rows(bundle, "travel_reservations").map((row) => str(row.details.assignment_id)).filter(Boolean))
  for (const assignment of live) {
    const d = assignment.details
    const driverId = str(d.driver_id)
    const positioning = obj(d.positioning) ?? {}
    const posReservations = strings(positioning.positioning_reservation_ids)
    const others = (world.assignmentsByDriver.get(driverId ?? "") ?? []).filter((other) => other.row.id !== assignment.id && str(other.row.details.status) === "IN_PROGRESS")
    // A driver whose other job ends in this pickup's city needs no travel to reach it.
    const pickupCity = order.pickup.city.toLowerCase()
    const endsHere = others.some((other) => world.byId.get(other.orderId)?.delivery.city.toLowerCase() === pickupCity)
    if (str(d.status) === "ASSIGNED" && pickupIn !== null && pickupIn < 48) {
      if (others.length && !posReservations.length && !endsHere) {
        const otherRefs = others.map((other) => world.byId.get(other.orderId)?.reference ?? other.orderId)
        flags.push({
          code: "H4_POSITIONING_NOT_EVIDENCED", tier: "person",
          label: `The driver is still on ${otherRefs.join(", ")} and nothing shows how he reaches this pickup ${fmtDateTime(pickupStart, windows.pickupSlot?.zone)}.`,
          source: ref("work_assignments", assignment.id), at: pickupStart ?? undefined,
        })
      } else if (!others.length && !posReservations.length && !reservationsByAssignment.has(assignment.id) && bundle.order.routeKind === "IMPORT") {
        flags.push({
          code: "H4b_IMPORT_NO_TRAVEL_BOOKED", tier: "person",
          label: `Import pickup ${fmtDateTime(pickupStart, windows.pickupSlot?.zone)} and no travel is booked for the driver.`,
          source: ref("work_assignments", assignment.id), at: pickupStart ?? undefined,
        })
      }
    }
    const previousId = str(positioning.previous_assignment_id)
    const nextPickup = str(positioning.next_pickup_start_at)
    const previousEnd = str(positioning.previous_delivery_eta_at)
    if (previousId && nextPickup && previousEnd) {
      const between = (world.assignmentsByDriver.get(driverId ?? "") ?? []).filter((other) =>
        other.row.id !== assignment.id && other.row.id !== previousId && LIVE.has(str(other.row.details.status) ?? ""))
      for (const other of between) {
        const otherOrder = world.byId.get(other.orderId)
        const otherStart = otherOrder ? chosenWindows(otherOrder.bundle).pickupSlot?.start ?? null : null
        if (otherStart && previousEnd < otherStart && otherStart < nextPickup) {
          flags.push({
            code: "H9_POSITIONING_IGNORES_INTERVENING_DUTY", tier: "person",
            label: `Travel was planned from ${str(positioning.planned_release_city) ?? "the previous drop"}, but the driver has ${otherOrder!.reference} in between.`,
            source: ref("work_assignments", assignment.id), at: otherStart,
          })
        }
      }
    }
  }
  // H6: delivery within 12 h to a place that is not a managed site, and no way to reach the receiver.
  const promise = windows.promise
  if (status === "IN_TRANSIT" && promise) {
    const startIn = h(promise.start)
    const endpoint = deliveryEndpoint(bundle)
    if (startIn !== null && startIn < 12 && endpoint && !order.delivery.site
      && str(endpoint.details.contact_status) !== "CONFIRMED" && !str(endpoint.details.contact_handle) && !str(endpoint.details.contact_name)) {
      flags.push({
        code: "H6_DELIVERY_SOON_NO_RECEIVER", tier: "person",
        label: `Delivery ${fmtDateTime(promise.start, promise.zone)} to a private address with no receiver name or phone on file.`,
        source: ref("order_endpoint_details", endpoint.id), at: promise.start,
      })
    }
  }
  // H13: an open support inbox thread that may concern this order.
  for (const thread of bundle.inboxThreads) {
    if (str(thread.details.status) === "CLOSED") continue
    const confirmed = strings(thread.details.linked_order_ids).includes(bundle.order.id)
    // An unmatched message needs a person to decide whose it is. A matched one
    // on a delivered order is a lookup the agent can answer.
    const tier: Tier = !confirmed || status !== "DELIVERED" ? "person" : "agent"
    flags.push({
      code: "H13_OPEN_INBOX_THREAD", tier,
      label: confirmed ? "An open support message about this order has no owner yet." : "An unmatched support message may be about this order.",
      source: ref("support_inbox_threads", thread.id), at: str(thread.details.updated_at) ?? undefined,
    })
  }

  // ---- Background queue (listed, never on a person's board) ---------------
  if (status === "DELIVERED") {
    const stale = rows(bundle, "proofs").filter((row) => str(row.details.status) === "SUBMITTED" && (h(str(row.details.submitted_at)) ?? 0) < -48)
    const rejected = rows(bundle, "proofs").filter((row) => str(row.details.status) === "REJECTED")
    const missing = rows(bundle, "documents").filter((row) => str(row.details.status) === "MISSING")
    if (stale.length || rejected.length || missing.length) {
      flags.push({ code: "H7_EVIDENCE_OPEN", tier: "background", label: "Handover evidence still open after delivery (back office).", source: ref((stale[0] ?? rejected[0]) ? "proofs" : "documents", (stale[0] ?? rejected[0] ?? missing[0])!.id) })
    }
  }
  const oldClaims = rows(bundle, "expenses").filter((row) => str(row.details.status) === "SUBMITTED" && (h(str(row.details.submitted_at)) ?? 0) < -72)
  if (oldClaims.length) {
    flags.push({ code: "H8_EXPENSE_WAITING", tier: "background", label: `${oldClaims.length} driver expense claim${oldClaims.length > 1 ? "s" : ""} waiting over 72 h (back office).`, source: ref("expenses", oldClaims[0]!.id) })
  }
  if (promise && status !== "DELIVERED" && (promise.source === "SYSTEM" || promise.source === "OPS")) {
    flags.push({ code: "H10_PROMISE_NOT_FROM_CUSTOMER", tier: "background", label: `The delivery promise was set by ${promise.source === "OPS" ? "Ops" : "the system"}, not agreed with the customer.`, source: ref("time_windows", findWindowId(bundle, "CUSTOMER_DELIVERY_PROMISE", true) ?? "") })
  }

  // ---- Checks nobody has made yet (not urgent, but not fine) --------------
  const preTrip = status === "NEW" || status === "WAITING_FOR_PICKUP"
  if (preTrip) {
    const endpoint = pickupEndpoint(bundle)
    if (endpoint) {
      const access = str(endpoint.details.access_status)
      const contact = str(endpoint.details.contact_status)
      if (access !== "CONFIRMED" || contact !== "CONFIRMED") {
        flags.push({
          code: "PICKUP_NOT_CONFIRMED", tier: "unchecked",
          label: `Nobody has confirmed the pickup place for this order yet (access ${access === "CONFIRMED" ? "confirmed" : "not checked"}, contact ${contact === "CONFIRMED" ? "confirmed" : "not checked"}).`,
          source: ref("order_endpoint_details", endpoint.id), at: str(endpoint.details.last_confirmed_at) ?? undefined,
        })
      }
    }
  }
  if (status === "IN_TRANSIT" && !latestTracking(bundle).direct && !milestones(bundle).deliveredAt) {
    flags.push({ code: "NO_POSITION", tier: "unchecked", label: "No position from the driver app since pickup.", source: ref("work_assignments", live[0]?.id ?? "") })
  }
  return flags
}

function findWindowId(bundle: Bundle, purpose: string, selected: boolean): string | null {
  return rows(bundle, "time_windows").find((row) => row.details.purpose === purpose && row.details.is_selected === selected)?.id ?? null
}

/** The positive checks: what was looked at and found fine. Shown on hover of a quiet order. */
function passedChecks(order: OrderWorld, flags: Flag[], now: string): CheckRow[] {
  const { bundle } = order
  const status = bundle.order.status
  const codes = new Set(flags.map((flag) => flag.code))
  const out: CheckRow[] = []
  const live = liveAssignments(bundle)
  const endpoint = pickupEndpoint(bundle)
  if (status === "NEW" || status === "WAITING_FOR_PICKUP") {
    if (live.length) {
      const driver = bundle.dir.driverName(live[0]!.details.driver_id)
      out.push({ label: `Driver booked${driver ? `: ${driver}` : ""}`, ok: true, source: ref("work_assignments", live[0]!.id), at: str(live[0]!.details.accepted_at) ?? undefined })
    }
    if (endpoint && !codes.has("PICKUP_NOT_CONFIRMED")) {
      const by = str(endpoint.details.last_confirmed_source)
      out.push({ label: `Pickup place confirmed${by ? ` (${label(by).toLowerCase()})` : ""}`, ok: true, source: ref("order_endpoint_details", endpoint.id), at: str(endpoint.details.last_confirmed_at) ?? undefined })
    }
    const release = rows(bundle, "documents").find((row) => row.details.kind === "RELEASE_AUTHORITY" && row.details.status === "VERIFIED")
    if (release) out.push({ label: "Release document checked", ok: true, source: ref("documents", release.id), at: str(release.details.updated_at) ?? undefined })
  }
  if (status === "IN_TRANSIT") {
    const direct = latestTracking(bundle).direct
    if (direct && !codes.has("H1_STALE_TRACKING_NO_ALERT")) out.push({ label: "Position from the driver app", ok: true, source: "tracking_observations", at: direct.receivedAt ?? undefined })
  }
  if (status === "DELIVERED") {
    const delivered = milestones(bundle).deliveredAt
    if (delivered) out.push({ label: "Delivered", ok: true, source: "operational_events", at: delivered })
  }
  if (!flags.some((flag) => flag.code === "ALERT_OPEN" || flag.code === "ALERT_OWNED")) out.push({ label: "No open alerts", ok: true, source: "alerts", at: now })
  if (!flags.some((flag) => flag.code.startsWith("THREAD") || flag.code.startsWith("CUSTOMER") || flag.code === "WAITING_ON_CUSTOMER")) {
    out.push({ label: "No message waiting for an answer", ok: true, source: "conversations", at: now })
  }
  return out
}

function deskFor(order: OrderWorld, flags: Flag[]): string | null {
  const { bundle } = order
  const owners = [
    ...rows(bundle, "work_items").map((row) => str(row.details.owner)),
    ...bundle.alerts.map((alert) => str(alert.details.owner)),
    ...bundle.conversations.filter((thread) => thread.status === "OPEN").map((thread) => str(thread.details.owner)),
  ].filter((owner): owner is string => !!owner && owner.startsWith("ops-"))
  if (owners.length) return owners[0]!
  if (flags.some((flag) => flag.code.startsWith("H4") || flag.code.startsWith("H9"))) return "ops-travel"
  if (flags.some((flag) => flag.code.startsWith("H3"))) return "ops-dispatch"
  if (flags.some((flag) => flag.code === "H12_CANCELLED_COST_OPEN")) return "ops-finance"
  if (flags.some((flag) => flag.code === "PICKUP_NOT_CONFIRMED")) return "ops-readiness"
  return "ops-support"
}

/**
 * Every order's check, computed now. `cases` lets the check reflect cases that
 * were saved (agent working, decided, handled by agent).
 */
export function computeOrderChecks(world: World, cases: Case[] = []): OrderCheckResult[] {
  const now = worldNow(world)
  const ctx: Context = { world, now, roadEstimates: world.roadEstimates }
  const caseByOrder = new Map<string, Case>()
  for (const item of cases) {
    const known = caseByOrder.get(item.orderId)
    if (!known || STATUS_RANK[item.status] < STATUS_RANK[known.status]) caseByOrder.set(item.orderId, item)
  }

  return world.orders.map((order) => {
    const flags = rulesFor(order, ctx)
    const person = flags.filter((flag) => flag.tier === "person")
    const agent = flags.filter((flag) => flag.tier === "agent")
    const unchecked = flags.filter((flag) => flag.tier === "unchecked")
    let state: OrderCheck["state"] = person.length ? "needs_person" : agent.length ? "agent_working" : unchecked.length ? "not_checked" : "checked_quiet"
    const linked = caseByOrder.get(order.id)
    if (linked) {
      if (linked.status === "waiting_for_person") state = "needs_person"
      else if (linked.status === "agent_working") state = state === "needs_person" ? state : "agent_working"
    }
    const checks: CheckRow[] = [
      ...flags.map((flag) => ({ label: flag.label, ok: false, source: flag.source, at: flag.at })),
      ...passedChecks(order, flags, now),
    ]
    if (linked?.status === "handled_by_agent") {
      checks.unshift({ label: "Handled by the agent under a trust rule", ok: true, source: `cr_cases:${linked.id}`, at: linked.createdAt })
    }
    return {
      orderId: order.id,
      reference: order.reference,
      state,
      checkedAt: now,
      checks,
      caseId: linked?.id,
      flags,
      desk: state === "checked_quiet" ? null : deskFor(order, flags),
    }
  })
}

const STATUS_RANK: Record<Case["status"], number> = { waiting_for_person: 0, agent_working: 1, decided: 2, handled_by_agent: 3, done: 4 }

export type CheckCounts = Record<OrderCheck["state"], number> & { total: number }

export function countChecks(checks: Pick<OrderCheck, "state">[]): CheckCounts {
  const counts: CheckCounts = { needs_person: 0, checked_quiet: 0, not_checked: 0, agent_working: 0, total: checks.length }
  for (const check of checks) counts[check.state]++
  return counts
}
