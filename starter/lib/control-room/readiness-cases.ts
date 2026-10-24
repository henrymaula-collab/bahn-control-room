// Readiness desk cases derived from the dataset, so the desk works without an
// LLM. The agent workstream produces richer cases through the same `Case`
// contract (lib/control-room/store.ts); a saved case for an order replaces the
// derived one.
//
// Derivation is generic: it reads signals (pickup soon with readiness not
// confirmed, release document state, key and access threads, notes that
// disagree with what the pickup place said, a pickup place that has not
// answered, a car that is not ready) and never names an order. Case ids are
// built from the order id and case type, so they are stable across requests
// and across a reseed of unchanged rows.

import { chosenWindows } from "../present/attention"
import { type Bundle, type MessageRow, type RelatedRow, num, rows, str } from "../present/bundle"
import { label } from "../present/labels"
import type { OrderCheckResult } from "./checks"
import type { AgentStep, Case, CaseReason, CaseType, Change, Fact, Option, SourceKind } from "./types"
import { dayTime } from "./vocab"
import { type OrderWorld, type World, hoursFrom, worldNow } from "./world"

const PRE_PICKUP = new Set(["NEW", "WAITING_FOR_PICKUP"])
const READINESS_THREADS = new Set(["pickup_and_release", "order_change", "vehicle_custody"])

type Signals = {
  order: OrderWorld
  pickupStart: string | null
  pickupZone: string | null
  pickupIn: number | null
  releaseMissing: RelatedRow | null
  releaseRequired: boolean
  releaseVerified: boolean
  accessReopened: boolean
  accessAlert: Bundle["alerts"][number] | null
  releaseAlert: Bundle["alerts"][number] | null
  customerNotes: RelatedRow[]
  siteMessages: MessageRow[]
  readinessMessages: MessageRow[]
  keyWork: RelatedRow | null
  readinessWork: RelatedRow[]
  custodyOpen: RelatedRow | null
  notReadyMessage: MessageRow | null
  emptyVisit: RelatedRow | null
  publishedOffer: RelatedRow | null
  unansweredOutbound: MessageRow | null
  /** An open pickup thread is waiting on the pickup place (site confirmation, stock control). */
  waitingOnSite: Bundle["conversations"][number] | null
  preparing: boolean
}

function pickupEndpoint(bundle: Bundle) {
  return rows(bundle, "order_endpoint_details").find((row) => row.details.boundary === "PICKUP") ?? null
}

function readSignals(order: OrderWorld, now: string): Signals {
  const { bundle } = order
  const windows = chosenWindows(bundle)
  const draft = rows(bundle, "time_windows").find((row) => row.details.purpose === "SELECTED_PICKUP_SLOT")
  const pickupStart = windows.pickupSlot?.start ?? str(draft?.details.start_at)
  const pickupZone = windows.pickupSlot?.zone ?? str(draft?.details.timezone) ?? order.pickup.timezone
  const docs = rows(bundle, "documents")
  const threads = bundle.conversations.filter((thread) => READINESS_THREADS.has(thread.category))
  const threadIds = new Set(threads.map((thread) => thread.id))
  const readinessMessages = bundle.messages.filter((message) => threadIds.has(message.conversationId) && message.details.visibility !== "INTERNAL")
  const siteMessages = readinessMessages.filter((message) => message.authorType === "site_contact")
  const work = rows(bundle, "work_items").filter((row) => str(row.details.status) === "OPEN")
  const readinessWork = work.filter((row) => str(row.details.owner) === "ops-readiness")
  const keyWork = work.find((row) => /KEY|ACCESS|CONTACT_HANDLE/.test(str(row.details.kind) ?? "")) ?? null
  const notReady = /not ready|no part|part (is|has) not|still being prepared|not finished|workshop/i
  // The latest outbound message to the pickup place that got no reply.
  const siteThreads = threads.filter((thread) => thread.status === "OPEN" && str(thread.details.counterparty_type) === "site_contact")
  let unansweredOutbound: MessageRow | null = null
  for (const thread of siteThreads) {
    const list = readinessMessages.filter((message) => message.conversationId === thread.id)
    const last = list[list.length - 1]
    if (last && last.authorType === "operator" && (hoursFrom(now, last.authoredAt) ?? 0) < -2) unansweredOutbound = last
  }
  return {
    order,
    pickupStart,
    pickupZone,
    pickupIn: hoursFrom(now, pickupStart),
    releaseMissing: docs.find((row) => row.details.kind === "RELEASE_AUTHORITY" && (row.details.status === "MISSING" || row.details.status === "REQUESTED")) ?? null,
    releaseRequired: order.pickup.site?.details.requires_signed_release === true,
    releaseVerified: docs.some((row) => row.details.kind === "RELEASE_AUTHORITY" && row.details.status === "VERIFIED"),
    accessReopened: bundle.events.some((event) => event.command === "endpoint.access_reopened"),
    accessAlert: bundle.alerts.find((alert) => alert.status !== "RESOLVED" && /SITE_ACCESS|ACCESS_CONFLICT/.test(alert.signal)) ?? null,
    releaseAlert: bundle.alerts.find((alert) => alert.status !== "RESOLVED" && /RELEASE/.test(alert.signal)) ?? null,
    customerNotes: rows(bundle, "order_notes").filter((row) => row.details.author_type === "customer"),
    siteMessages,
    readinessMessages,
    keyWork,
    readinessWork,
    custodyOpen: rows(bundle, "custody_assets").find((row) => !!str(row.details.next_action)) ?? null,
    notReadyMessage: readinessMessages.find((message) => message.authorType !== "operator" && notReady.test(message.body)) ?? null,
    emptyVisit: rows(bundle, "site_visits").find((row) => row.details.outcome === "VEHICLE_NOT_FOUND") ?? null,
    publishedOffer: rows(bundle, "market_offers").find((row) => row.details.status === "PUBLISHED") ?? null,
    unansweredOutbound,
    waitingOnSite: threads.find((thread) => thread.status === "OPEN" && /^(SITE|STOCK|BRANCH)/.test(str(thread.details.waiting_on) ?? "")) ?? null,
    preparing: str(bundle.order.details.readiness_status) === "PREPARING",
  }
}

/** Pick the case type the signals point to, strongest first. Null when nothing points to readiness. */
function classify(s: Signals): CaseType | null {
  const soon = s.pickupIn !== null && s.pickupIn < 72
  if (s.accessAlert || (s.accessReopened && (s.customerNotes.length || s.siteMessages.length))) return "readiness.facts_disagree"
  if (s.releaseMissing || s.releaseAlert || (s.releaseRequired && !s.releaseVerified && soon && s.siteMessages.length)) return "readiness.release_document_missing"
  if (s.emptyVisit || s.notReadyMessage || (s.preparing && s.pickupIn !== null && s.pickupIn < 48)) return "readiness.car_not_ready"
  if (s.keyWork || s.custodyOpen) return "readiness.keys_or_access"
  if ((s.unansweredOutbound || s.waitingOnSite) && soon) return "readiness.no_answer"
  return null
}

const sourceKind = (authorType: string): SourceKind =>
  authorType === "site_contact" || authorType === "handoff_contact" ? "pickup_place"
    : authorType === "customer" ? "customer"
      : authorType === "driver" ? "driver"
        : authorType === "agent" ? "agent" : "person"

const channelOf = (channel: string | null): Fact["source"]["channel"] =>
  !channel ? "record" : channel.includes("call") ? "call" : channel.includes("email") ? "email" : channel.includes("app") ? "app" : "message"

function trim(text: string, max = 220) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const stop = cut.lastIndexOf(". ")
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}...`
}

function buildFacts(s: Signals, world: World, now: string): Fact[] {
  const { order } = s
  const { bundle } = order
  const facts: Fact[] = []
  const place = order.pickup
  const created = bundle.order.createdAt

  if (s.pickupStart) {
    const window = rows(bundle, "time_windows").find((row) => row.details.purpose === "SELECTED_PICKUP_SLOT" && row.details.start_at === s.pickupStart)
    const setAt = window ? bundle.events.find((event) => event.targetId === window.id)?.recordedAt ?? created : created
    facts.push({
      id: "f-slot", statement: `Pickup slot at ${place.name}, ${place.city}: ${dayTime(s.pickupStart, s.pickupZone ?? undefined)} local time.`,
      source: { kind: "record", name: "Order", channel: "record", recordRef: window ? `time_windows:${window.id}` : `orders:${order.id}`, at: setAt },
      strength: window?.details.is_selected ? "confirmed" : "stated",
    })
  }
  const endpoint = pickupEndpoint(bundle)
  if (endpoint) {
    const d = endpoint.details
    const confirmed = d.access_status === "CONFIRMED" && d.contact_status === "CONFIRMED"
    const bySite = d.last_confirmed_source === "MANAGED_SITE_PROFILE"
    facts.push({
      id: "f-endpoint",
      statement: confirmed
        ? `Pickup contact ${str(d.contact_name) ?? "on file"} confirmed${bySite ? " from the pickup place profile, not for this order" : ""}.`
        : `Pickup instruction: "${trim(str(d.access_instruction) ?? "none on file", 160)}" Not checked for this order yet.`,
      source: { kind: "record", name: "Pickup details", channel: "record", recordRef: `order_endpoint_details:${endpoint.id}`, at: str(d.last_confirmed_at) ?? str(d.stated_at) ?? created },
      strength: confirmed && !bySite ? "confirmed" : "stated",
    })
  }
  for (const note of s.customerNotes) {
    const newerSite = s.siteMessages.some((message) => message.authoredAt > String(note.details.authored_at))
    facts.push({
      id: `f-note-${note.id}`, statement: `The customer's note: "${trim(str(note.details.body) ?? "", 160)}"`,
      source: { kind: "customer", name: world.customers.get(str(note.details.author_id) ?? "")?.name ?? order.customer.name, channel: "record", recordRef: `order_notes:${note.id}`, at: str(note.details.authored_at) ?? created },
      strength: newerSite ? "stale" : "stated",
    })
  }
  // The latest few messages about the pickup, newest last, pickup place first in weight.
  const recent = s.readinessMessages.slice(-4)
  for (const message of recent) {
    const name = message.authorType === "site_contact" ? place.name
      : message.authorType === "customer" ? order.customer.name
        : message.authorType === "driver" ? bundle.dir.driverName(message.details.author_id) ?? "Driver"
          : bundle.dir.title(message.details.author_id) ?? "Bahn"
    const language = str(message.details.language)
    facts.push({
      id: `f-msg-${message.id}`,
      statement: `${trim(message.body)}${language && language !== "en" ? ` (in ${language.toUpperCase()}, not translated yet)` : ""}`,
      source: { kind: sourceKind(message.authorType), name, channel: channelOf(str(message.details.channel)), recordRef: `messages:${message.id}`, at: message.authoredAt },
      strength: message.authorType === "operator" ? "confirmed" : "stated",
    })
  }
  if (s.releaseMissing) {
    facts.push({
      id: "f-release", statement: `Release document: ${label(str(s.releaseMissing.details.status)).toLowerCase()}.`,
      source: { kind: "record", name: "Documents", channel: "record", recordRef: `documents:${s.releaseMissing.id}`, at: str(s.releaseMissing.details.updated_at) ?? created },
      strength: "confirmed",
    })
  } else if (s.releaseRequired) {
    facts.push({
      id: "f-release-rule", statement: `${place.name} hands a car over only against a signed release document.${s.releaseVerified ? " One is on file and checked." : " None is on file for this order."}`,
      source: { kind: "pickup_place", name: place.name, channel: "record", recordRef: `sites:${place.id}`, at: created },
      strength: "stated",
    })
  }
  for (const alert of [s.accessAlert, s.releaseAlert].filter((value): value is NonNullable<typeof value> => !!value)) {
    facts.push({
      id: `f-alert-${alert.id}`, statement: `${alert.summary} (an alert is a reason to look, not a diagnosis)`,
      source: { kind: "record", name: "Alert", channel: "record", recordRef: `alerts:${alert.id}`, at: alert.triggeredAt },
      strength: "inferred",
    })
  }
  if (s.emptyVisit) {
    facts.push({
      id: "f-visit", statement: "The driver arrived and the pickup place could not find the car.",
      source: { kind: "driver_app", name: "Driver app", channel: "app", recordRef: `site_visits:${s.emptyVisit.id}`, at: str(s.emptyVisit.details.arrived_at) ?? created },
      strength: "confirmed",
    })
  }
  if (s.publishedOffer) {
    const fee = (num(s.publishedOffer.details.fee_cents) ?? 0) / 100
    facts.push({
      id: "f-gig", statement: `The gig is published at EUR ${fee.toFixed(0)} and no driver has taken it.`,
      source: { kind: "record", name: "Driver marketplace", channel: "record", recordRef: `market_offers:${s.publishedOffer.id}`, at: str(s.publishedOffer.details.published_at) ?? created },
      strength: "confirmed",
    })
  }
  const live = rows(bundle, "work_assignments").find((row) => row.details.status === "ASSIGNED" || row.details.status === "IN_PROGRESS")
  if (live) {
    facts.push({
      id: "f-driver", statement: `Driver booked: ${bundle.dir.driverName(live.details.driver_id) ?? "a driver"}.`,
      source: { kind: "record", name: "Driver marketplace", channel: "record", recordRef: `work_assignments:${live.id}`, at: str(live.details.accepted_at) ?? created },
      strength: "confirmed",
    })
  }
  if (s.preparing) {
    facts.push({
      id: "f-preparing", statement: "The order is still being prepared; readiness is not confirmed.",
      source: { kind: "record", name: "Order", channel: "record", recordRef: `orders:${order.id}`, at: bundle.order.updatedAt },
      strength: "confirmed",
    })
  }
  void now
  return facts
}

function nextWorkingDay(iso: string, zone: string | null) {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + 1)
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: zone ?? "Europe/Helsinki" }).format(date)
  if (weekday === "Sat") date.setUTCDate(date.getUTCDate() + 2)
  if (weekday === "Sun") date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

const keep = (detail = "Nothing changes on the order"): Change => ({ kind: "none", detail })

function buildOptions(type: CaseType, s: Signals): { suggestion: Option; alternatives: Option[]; reasons: CaseReason[]; headline: string } {
  const place = s.order.pickup.name
  const zone = s.pickupZone
  const slot = s.pickupStart ? dayTime(s.pickupStart, zone ?? undefined) : null
  const later = s.pickupStart ? nextWorkingDay(s.pickupStart, zone) : null
  const laterText = later ? dayTime(later, zone ?? undefined) : "the next working day"
  const fee = s.publishedOffer ? Math.round((num(s.publishedOffer.details.fee_cents) ?? 0) / 100) : null
  const movePickup: Option = {
    id: "move_pickup_next_day", label: `Move pickup to ${laterText.split(" ").slice(0, 3).join(" ")}`,
    effect: "The agent drafts the date change for the customer; you send it, then the agent rebooks the driver.",
    changes: [
      { kind: "date", detail: `Pickup moves from ${slot ?? "the current slot"} to ${laterText}` },
      { kind: "customer_message", detail: "Message to the customer about the new pickup date" },
    ],
  }
  const pauseGig: Option = {
    id: "pause_gig", label: "Pause the gig until the pickup place confirms",
    effect: "No driver can take the gig; the agent calls the pickup place again and brings the answer back to you.",
    changes: [{ kind: "booking", detail: `The published gig${fee ? ` (EUR ${fee})` : ""} is paused` }],
  }
  const askCustomer: Option = {
    id: "ask_customer", label: "Ask the customer",
    effect: "The agent drafts a short message to the customer; you read it and send it.",
    changes: [{ kind: "customer_message", detail: "Question to the customer about the pickup" }],
  }
  const callAgain: Option = {
    id: "keep_slot_call_again", label: "Keep the slot and call again in an hour",
    effect: "The agent calls the pickup place again and comes back to you only if the answer changes the plan.",
    changes: [keep("The pickup slot stays as booked")],
  }

  switch (type) {
    case "readiness.facts_disagree": {
      const suggestion = s.publishedOffer ? pauseGig : {
        id: "follow_pickup_place", label: `Go with what ${place} said`,
        effect: "The driver gets the pickup place's instruction; the older note is marked outdated on the order.",
        changes: [{ kind: "driver_message" as const, detail: "The driver's pickup instruction is updated" }],
      }
      return {
        headline: `${place} and the order disagree on where to collect the car.`,
        reasons: ["facts_disagree"],
        suggestion,
        alternatives: [s.publishedOffer ? {
          id: "follow_pickup_place", label: `Go with what ${place} said`,
          effect: "The driver gets the pickup place's instruction; the older note is marked outdated on the order.",
          changes: [{ kind: "driver_message", detail: "The driver's pickup instruction is updated" }],
        } : callAgain, askCustomer],
      }
    }
    case "readiness.release_document_missing":
      return {
        headline: `${place} will not hand the car over: the release document is missing.`,
        reasons: ["papers_missing", "needs_the_customer"],
        suggestion: {
          id: "ask_customer_for_release", label: "Ask the customer for the signed release",
          effect: "The agent drafts the request; you send it. The driver is held until the release is on file.",
          changes: [
            { kind: "customer_message", detail: "Request to the customer for the signed release document" },
            ...(s.publishedOffer ? [{ kind: "booking" as const, detail: "The gig is paused until the release is on file" }] : []),
          ],
        },
        alternatives: [movePickup, callAgain],
      }
    case "readiness.car_not_ready":
      if (s.emptyVisit) {
        const live = rows(s.order.bundle, "work_assignments").find((row) => row.details.status === "ASSIGNED" || row.details.status === "IN_PROGRESS")
        const driverFee = live ? Math.round((num(live.details.fee_cents) ?? 0) / 100) : null
        return {
          headline: `The driver is at ${place} and the car was not found.`,
          reasons: ["car_not_ready", "costs_extra_money", "needs_the_customer"],
          suggestion: {
            id: "release_driver", label: "Release the driver",
            effect: "The driver leaves and is paid for the empty pickup; the agent drafts a question to the customer about where the car is.",
            changes: [
              { kind: "cost", detail: `Empty pickup paid to the driver${driverFee ? ` (gig fee EUR ${driverFee})` : ""}`, amountEur: driverFee ?? undefined },
              { kind: "customer_message", detail: "Question to the customer about where the car is held" },
            ],
          },
          alternatives: [
            { id: "driver_waits", label: "Ask the driver to wait 30 minutes more", effect: "The agent asks the driver to wait while it calls the pickup place again.", changes: [{ kind: "driver_message", detail: "The driver is asked to wait 30 minutes" }] },
            movePickup,
          ],
        }
      }
      return {
        headline: s.emptyVisit ? `The driver is at ${place} and the car was not found.` : `The car may not be ready at ${place} for ${slot ?? "the pickup"}.`,
        reasons: s.emptyVisit ? ["car_not_ready", "costs_extra_money"] : ["car_not_ready", "moves_delivery_date"],
        suggestion: movePickup,
        alternatives: [callAgain, askCustomer],
      }
    case "readiness.keys_or_access":
      return {
        headline: `Nobody at ${place} has confirmed who hands over the keys.`,
        reasons: ["facts_disagree"],
        suggestion: {
          id: "hold_driver_until_key_holder", label: "Hold the driver until the key holder is named",
          effect: "The driver is told not to travel yet; the agent calls the pickup place for a named person and brings it back.",
          changes: [{ kind: "driver_message", detail: "The driver is asked to wait before travelling" }],
        },
        alternatives: [callAgain, askCustomer],
      }
    case "readiness.no_answer":
      return {
        headline: `${place} has not answered about the pickup.`,
        reasons: ["pickup_place_not_answering"],
        suggestion: callAgain,
        alternatives: [askCustomer, movePickup],
      }
    default:
      return { headline: `Pickup at ${place} needs a look.`, reasons: [], suggestion: callAgain, alternatives: [askCustomer] }
  }
}

function buildSteps(s: Signals, facts: Fact[], suggestion: Option, now: string): AgentStep[] {
  const at = (minutesAgo: number) => new Date(new Date(now).getTime() - minutesAgo * 60_000).toISOString()
  const steps: AgentStep[] = [
    { at: at(6), kind: "read", summary: `Read the order and the profile of ${s.order.pickup.name}.`, factIds: facts.filter((fact) => fact.source.kind === "record").map((fact) => fact.id) },
  ]
  if (s.readinessMessages.length) {
    steps.push({ at: at(5), kind: "read", summary: `Read ${s.readinessMessages.length} message${s.readinessMessages.length === 1 ? "" : "s"} about the pickup.`, factIds: facts.filter((fact) => fact.id.startsWith("f-msg")).map((fact) => fact.id) })
  }
  if (s.releaseRequired || s.releaseMissing) steps.push({ at: at(4), kind: "lookup", summary: "Looked up the release document.", factIds: facts.filter((fact) => fact.id.startsWith("f-release")).map((fact) => fact.id) })
  if (s.publishedOffer) steps.push({ at: at(3), kind: "lookup", summary: "Checked the gig: published, nobody has taken it.", factIds: ["f-gig"] })
  steps.push({ at: at(1), kind: "propose", summary: `Stopped here and suggested: ${suggestion.label.toLowerCase()}.` })
  return steps
}

function decideBy(s: Signals, now: string): string | undefined {
  const candidates: string[] = []
  for (const row of s.readinessWork) { const due = str(row.details.due_at); if (due) candidates.push(due) }
  if (s.pickupStart) candidates.push(new Date(new Date(s.pickupStart).getTime() - 3 * 3_600_000).toISOString())
  const expires = str(s.publishedOffer?.details.expires_at)
  if (expires) candidates.push(expires)
  const future = candidates.filter((value) => value > now).sort()
  if (future[0] || !candidates.length) return future[0]
  // Every planned moment has passed and the case is still open (e.g. the driver is at the
  // pickup place now): it needs a person within half an hour, not "was due" hours ago.
  return new Date(Math.ceil((Date.parse(now) + 30 * 60_000) / 300_000) * 300_000).toISOString()
}

export function caseIdFor(orderId: string, type: CaseType) {
  return `case-${orderId}-${type.split(".").pop()}`
}

/** Derive one readiness case per order that shows readiness signals, before pickup. */
export function deriveReadinessCases(world: World, checks: OrderCheckResult[]): Case[] {
  const now = worldNow(world)
  const checkByOrder = new Map(checks.map((check) => [check.orderId, check]))
  const out: Case[] = []
  for (const order of world.orders) {
    if (!PRE_PICKUP.has(order.bundle.order.status) || order.bundle.order.lane === "cancelled") continue
    const signals = readSignals(order, now)
    const type = classify(signals)
    if (!type) continue
    const facts = buildFacts(signals, world, now)
    const { suggestion, alternatives, reasons, headline } = buildOptions(type, signals)
    const check = checkByOrder.get(order.id)
    out.push({
      id: caseIdFor(order.id, type),
      orderId: order.id,
      desk: "ops-readiness",
      type,
      headline,
      decideBy: decideBy(signals, now),
      reasons,
      facts,
      agentSteps: buildSteps(signals, facts, suggestion, now),
      suggestion,
      alternatives,
      status: check?.state === "needs_person" ? "waiting_for_person" : "agent_working",
      placeId: order.pickup.id,
      customerId: order.customer.id,
      createdAt: now,
    })
  }
  return out
}
