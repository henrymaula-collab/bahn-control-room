// The v3 views over the engine state: the Overview map, the Work lists and the
// key facts and situation for one case (contract: ./types-v3.ts). Pure functions
// over one EngineState, so every number on a page comes from the same read.
//
// What is estimated (positionSource):
//   tracking     in transit with a driver-app fix: placed at the fix's progress
//                along the route (the packet has progress, not coordinates)
//   estimated    in transit without a usable fix (time progress between pickup
//                and the delivery promise), a schedule inference, or a made-up order
//   at_pickup    not picked up yet: at the pickup place
//   at_delivery  delivered: at the delivery place
// A route is pickup -> ferry terminals (when a ferry is booked) -> delivery, in
// straight legs. Places sit at a fixed offset from their city centre (geo.ts).

import { chosenWindows, latestTracking, milestones } from "../present/attention"
import { type Bundle, num, rows, str } from "../present/bundle"
import type { OrderCheckResult } from "./checks"
import { along, carAt, cityEntry, placePosition, seaLane } from "./geo"
import type { EngineState } from "./service"
import type { Case, CaseReason, OpsPerson } from "./types"
import type { CarState, CaseV3Extras, KeyFact, LatLng, MapCar, Overview, PositionSource, Situation, Stop, WorkLists, WorkRow } from "./types-v3"
import { COUNTRY_NAMES, dayTime } from "./vocab"
import type { OrderWorld, Place } from "./world"

const byUrgency = (a: Case, b: Case) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999") || a.id.localeCompare(b.id)

/** The room's calendar day in Helsinki, "2026-10-21". */
export function roomDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
}

/** "Calverona Hamburg" -> "Calverona": the name without its city, when the name ends with it. */
export function shortPlace(name: string, city: string): string {
  if (city && name.endsWith(` ${city}`) && name.length > city.length + 1) return name.slice(0, -(city.length + 1))
  return name
}

/** The brand a person says out loud: "Calverona Hamburg" -> "Calverona", "Vandellora Odense Vest" -> "Vandellora". */
export function brand(name: string, city: string): string {
  return shortPlace(name, city).split(/\s+/)[0] ?? name
}

export function vehicleName(order: OrderWorld | undefined): string {
  const v = order?.bundle.items[0]?.vehicle
  return v ? `${v.make} ${v.model}`.trim() : "Car"
}

/** Find a person by engine id ("p-aino") or bare id ("aino"). */
export function findPerson(people: OpsPerson[], id: string | null | undefined): OpsPerson | null {
  if (!id) return null
  const bare = id.replace(/^p-/, "")
  return people.find((p) => p.id === id) ?? people.find((p) => p.id.replace(/^p-/, "") === bare) ?? null
}

// ---- Positions ----

type Phase = "pickup" | "road" | "delivered"

type Terminal = { id: string; name: string; city: string; country: string }

/** Terminal to terminal: both terminals and the sea lane between them. */
function ferryLeg(a: Terminal | undefined, b: Terminal | undefined): LatLng[] {
  const ends = [a, b].map((terminal) => (terminal ? placePosition(terminal) : null))
  if (!a || !b || !ends[0] || !ends[1]) return ends.filter((p): p is LatLng => !!p)
  return [ends[0], ...seaLane(a, b), ends[1]]
}

function ferryStops(state: EngineState, bundle: Bundle): LatLng[] {
  const reservation = rows(bundle, "travel_reservations")
    .filter((row) => str(row.details.origin_terminal_id) && str(row.details.destination_terminal_id) && !/CANCEL/.test(str(row.details.status) ?? ""))
    .sort((a, b) => String(b.details.booked_at ?? "").localeCompare(String(a.details.booked_at ?? "")))[0]
  if (!reservation) return []
  const terminal = (key: string) => state.world.ferryTerminals.get(str(reservation.details[key]) ?? "")
  return ferryLeg(terminal("origin_terminal_id"), terminal("destination_terminal_id"))
}

/** The ferry terminal in a country. */
function terminalIn(state: EngineState, country: string): Terminal | undefined {
  return [...state.world.ferryTerminals.values()].sort((a, b) => a.id.localeCompare(b.id)).find((t) => t.country === country)
}

/** Stops a road trip needs so a straight leg does not cross open sea: Finland is reached by
 * ferry (from Stockholm for the Nordic side, from Hamburg for the rest), and Copenhagen to
 * Aarhus goes over the bridges through Odense. Used when the order has no ferry booking. */
export function viaStops(state: EngineState, from: { city: string; country: string }, to: { city: string; country: string }): LatLng[] {
  const gate = (country: string) => terminalIn(state, country === "SE" || country === "DK" ? "SE" : "DE")
  if (from.country === "FI" && to.country !== "FI") return ferryLeg(terminalIn(state, "FI"), gate(to.country))
  if (to.country === "FI" && from.country !== "FI") return ferryLeg(gate(from.country), terminalIn(state, "FI"))
  const pair = new Set([`${from.country}:${from.city}`, `${to.country}:${to.city}`])
  const odense = cityEntry("Odense", "DK")
  if (pair.has("DK:Copenhagen") && pair.has("DK:Aarhus") && odense) return [{ lat: odense.lat, lng: odense.lng }]
  return []
}

/** Share of the way from pickup to delivery by the clock, when no fix says more. */
function timeProgress(bundle: Bundle, now: string): number {
  const windows = chosenWindows(bundle)
  const start = milestones(bundle).pickedUpAt ?? windows.pickupSlot?.start ?? null
  const end = latestTracking(bundle).direct?.eta ?? windows.promise?.end ?? windows.promise?.start ?? null
  if (!start || !end) return 0.5
  const t0 = Date.parse(start)
  const t1 = Date.parse(end)
  if (!(t1 > t0)) return 0.5
  return Math.min(0.98, Math.max(0.02, (Date.parse(now) - t0) / (t1 - t0)))
}

/** The latest observation of any source, newest observed_at first. */
function lastObservation(bundle: Bundle) {
  return rows(bundle, "tracking_observations")
    .map((row) => row.details)
    .sort((a, b) => String(b.observed_at ?? "").localeCompare(String(a.observed_at ?? "")))[0] ?? null
}

function realPosition(state: EngineState, order: OrderWorld, phase: Phase): { position: LatLng; source: PositionSource } | null {
  const pickup = placePosition(order.pickup)
  const delivery = placePosition(order.delivery)
  if (!pickup || !delivery) return null
  if (phase === "pickup") return { position: carAt(pickup, order.id), source: "at_pickup" }
  if (phase === "delivered") return { position: carAt(delivery, order.id), source: "at_delivery" }
  const ferry = ferryStops(state, order.bundle)
  const route = [pickup, ...(ferry.length ? ferry : viaStops(state, order.pickup, order.delivery)), delivery]
  const fix = lastObservation(order.bundle)
  const progress = fix ? num(fix.progress_fraction) : null
  if (fix && progress !== null) {
    const direct = str(fix.source) === "driver_app" && str(fix.location_quality) !== "INFERRED"
    return { position: carAt(along(route, progress), order.id), source: direct ? "tracking" : "estimated" }
  }
  return { position: carAt(along(route, timeProgress(order.bundle, state.now)), order.id), source: "estimated" }
}

/** Which orders are on the map today, and where in their trip they are. */
function phaseOf(order: OrderWorld, check: OrderCheckResult | undefined, day: string): Phase | null {
  const status = order.bundle.order.status
  if (status === "CANCELLED") return null
  if (status === "IN_TRANSIT") return "road"
  if (status === "DELIVERED") {
    const at = milestones(order.bundle).deliveredAt
    const today = at ? roomDay(at) === day : false
    // Delivered earlier but still open (a claim, an expense, evidence): it has work today.
    const open = check?.state === "needs_person" || check?.state === "agent_working"
    return today || open ? "delivered" : null
  }
  return "pickup"
}

function estimatedDelivery(bundle: Bundle): string | undefined {
  const windows = chosenWindows(bundle)
  return latestTracking(bundle).direct?.eta ?? windows.promise?.end ?? windows.promise?.start ?? undefined
}

/** Car colour comes from the order check, the same numbers as /api/cr/lead `today` and the desk's quiet line. */
function carState(check: OrderCheckResult | undefined): CarState {
  if (check?.state === "needs_person") return "needs_person"
  if (check?.state === "agent_working") return "agent_working"
  return "on_plan"
}

// ---- Why a car is red ----

/** What a check found, in a few of Bahn's words. Alerts, incidents and tasks bring their own name. */
const FLAG_WORDS: Record<string, string> = {
  EMPTY_PICKUP: "Car not found at pickup",
  H12_CANCELLED_COST_OPEN: "Cancelled, money still open",
  H2_FERRY_CUTOFF_AT_RISK: "Ferry check-in at risk",
  H4b_IMPORT_NO_TRAVEL_BOOKED: "No travel booked for the driver",
  H3_PICKUP_SOON_NO_DRIVER: "No driver for the pickup",
  H3b_DRAFT_SLOT_SOON: "Order still being prepared",
  H4_POSITIONING_NOT_EVIDENCED: "Driver may not reach the pickup",
  H9_POSITIONING_IGNORES_INTERVENING_DUTY: "Driver has a gig in between",
  H6_DELIVERY_SOON_NO_RECEIVER: "No receiver on file",
  H1_STALE_TRACKING_NO_ALERT: "No recent position",
  PROPOSAL_FAILED: "Agent action failed",
  CUSTOMER_WAITING: "Customer waiting for an answer",
  WAITING_ON_CUSTOMER: "Waiting for the customer",
  PROPOSAL_PENDING: "Agent suggestion waiting",
  H13_OPEN_INBOX_THREAD: "Message with no owner",
}
/** Most telling first: a named alert or incident, then what the checks found, then open tasks and messages. */
const REASON_ORDER = [
  "ALERT_OPEN", "ALERT_OWNED", "INCIDENT", "EMPTY_PICKUP", "H12_CANCELLED_COST_OPEN", "H2_FERRY_CUTOFF_AT_RISK",
  "H4b_IMPORT_NO_TRAVEL_BOOKED", "H3_PICKUP_SOON_NO_DRIVER", "H3b_DRAFT_SLOT_SOON", "H4_POSITIONING_NOT_EVIDENCED",
  "H9_POSITIONING_IGNORES_INTERVENING_DUTY", "H6_DELIVERY_SOON_NO_RECEIVER", "H1_STALE_TRACKING_NO_ALERT", "PROPOSAL_FAILED",
  "CUSTOMER_WAITING", "WAITING_ON_CUSTOMER", "WORK_OVERDUE", "WORK_OPEN", "PROPOSAL_PENDING", "H13_OPEN_INBOX_THREAD",
]

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Why a red car is red, short ("Ferry sold out"): the case's own stop when it has one,
 * else the most telling of the order check's person-tier findings. Undefined for other cars.
 */
export function redReason(check: OrderCheckResult | undefined, linked: Case | undefined): string | undefined {
  if (check?.state !== "needs_person") return undefined
  if (linked) {
    const stopped = keyFacts(linked, null).find((f) => f.label === "Stopped")?.value
    if (stopped) return stopped
  }
  const flags = check.flags.filter((f) => f.tier === "person")
  for (const code of REASON_ORDER) {
    const flag = flags.find((f) => f.code === code)
    if (!flag) continue
    if (flag.short) return sentence(code === "WORK_OVERDUE" ? `${flag.short} overdue` : flag.short)
    if (FLAG_WORDS[code]) return FLAG_WORDS[code]
  }
  return flags[0]?.short ? sentence(flags[0].short) : "Needs a person"
}

function placeTo(place: Place): string {
  return place.site ? place.name : place.city || place.name
}

export function mapCars(state: EngineState): (MapCar & { phase: Phase })[] {
  const day = roomDay(state.now)
  const checks = new Map(state.checks.map((check) => [check.orderId, check]))
  const cases = new Map(state.cases.map((c) => [c.id, c]))
  const cars: (MapCar & { phase: Phase })[] = []
  for (const order of state.world.orders) {
    const check = checks.get(order.id)
    const phase = phaseOf(order, check, day)
    if (!phase) continue
    const placed = realPosition(state, order, phase)
    if (!placed) continue
    const linked = check?.caseId ? cases.get(check.caseId) : undefined
    const carStateValue = carState(check)
    const waiting = linked?.status === "waiting_for_person"
    cars.push({
      orderId: order.id,
      reference: order.reference,
      vehicle: vehicleName(order),
      state: carStateValue,
      position: placed.position,
      positionSource: placed.source,
      from: order.pickup.name,
      to: placeTo(order.delivery),
      caseId: linked?.id,
      nextAt: waiting && linked?.decideBy ? linked.decideBy : phase === "delivered" ? undefined : estimatedDelivery(order.bundle),
      reason: redReason(check, linked),
      phase,
    })
  }
  // Made-up orders (CR_SCALE): quiet and checked, placed by their made-up stage.
  for (const check of state.checks) {
    if (!check.synthetic) continue
    const from = state.world.places.get(check.syntheticFromId ?? "")
    const to = state.world.places.get(check.syntheticToId ?? "")
    const a = from ? placePosition(from) : null
    const b = to ? placePosition(to) : null
    if (!from || !to || !a || !b) continue
    const status = check.syntheticStatus ?? "WAITING_FOR_PICKUP"
    const phase: Phase = status === "IN_TRANSIT" ? "road" : status === "DELIVERED" ? "delivered" : "pickup"
    const position = phase === "road" ? carAt(along([a, ...viaStops(state, from, to), b], check.syntheticProgress ?? 0.5), check.orderId)
      : carAt(phase === "delivered" ? b : a, check.orderId)
    cars.push({
      orderId: check.orderId,
      reference: check.reference,
      vehicle: check.syntheticVehicle ?? "Car",
      state: carState(check),
      position,
      positionSource: phase === "road" ? "estimated" : phase === "delivered" ? "at_delivery" : "at_pickup",
      from: from.name,
      to: placeTo(to),
      phase,
    })
  }
  return cars
}

// ---- Work lists ----

function workRow(state: EngineState, c: Case): WorkRow {
  const order = state.world.byId.get(c.orderId)
  const place = c.placeId ? state.world.places.get(c.placeId) : order?.pickup
  return {
    caseId: c.id,
    orderId: c.orderId,
    vehicle: vehicleName(order),
    place: place ? shortPlace(place.name, place.city) : "Pickup place",
    decideBy: c.decideBy,
    status: c.status,
  }
}

const lastTouch = (c: Case) => c.agentSteps[c.agentSteps.length - 1]?.at ?? c.createdAt

export function workLists(state: EngineState, person: OpsPerson): WorkLists {
  const onMyDesks = (c: Case) => person.desks.includes(c.desk)
  const needYou = state.cases.filter((c) => c.status === "waiting_for_person" && c.routedTo?.personId === person.id).sort(byUrgency)
  // The agent is on it: still doing legwork, or carrying out a person's decision.
  const agentWorking = state.cases.filter((c) => (c.status === "agent_working" || c.status === "decided") && onMyDesks(c)).sort(byUrgency)
  // Every stored case is from the current room day (db:seed:cr clears the rest), so "today" is all of them.
  const doneToday = state.cases.filter((c) => (c.status === "done" || c.status === "handled_by_agent") && onMyDesks(c))
    .sort((a, b) => lastTouch(b).localeCompare(lastTouch(a)) || a.id.localeCompare(b.id))
  return {
    needYou: needYou.map((c) => workRow(state, c)),
    agentWorking: agentWorking.map((c) => workRow(state, c)),
    doneToday: doneToday.map((c) => workRow(state, c)),
  }
}

export function overview(state: EngineState, person: OpsPerson): Overview {
  const cars = mapCars(state)
  const needYou = workLists(state, person).needYou
  return {
    now: state.now,
    counts: {
      carsToday: cars.length,
      onTheRoad: cars.filter((car) => car.phase === "road").length,
      needsPerson: cars.filter((car) => car.state === "needs_person").length,
      needYou: needYou.length,
      agentWorking: cars.filter((car) => car.state === "agent_working").length,
      handledByAgentToday: state.cases.filter((c) => c.status === "handled_by_agent").length,
    },
    cars: cars.map(({ phase: _phase, ...car }) => car),
    needYou,
  }
}

// ---- Key facts for one case ----

/** Why the agent stopped, by case type, in Bahn's words. */
const STOPPED: Record<string, string> = {
  "readiness.release_document_missing": "Release document missing",
  "readiness.car_not_ready": "Car not ready",
  "readiness.facts_disagree": "Order and pickup place disagree",
  "readiness.no_answer": "Pickup place not answering",
  "readiness.fee_requested": "Pickup place asks a fee",
  "readiness.keys_or_access": "Key holder not named",
}

const STOPPED_BY_REASON: Partial<Record<CaseReason, string>> = {
  papers_missing: "Release document missing",
  car_not_ready: "Car not ready",
  facts_disagree: "Order and pickup place disagree",
  pickup_place_not_answering: "Pickup place not answering",
  costs_extra_money: "It costs extra money",
  moves_delivery_date: "Delivery date would move",
  driver_safety: "Driver safety",
}

/** What the decision needs that the agent may not do alone (Bahn's three gates, plus safety). */
const NEEDS: [CaseReason, string][] = [
  ["needs_the_customer", "The customer"],
  ["driver_safety", "A safety call"],
  ["moves_delivery_date", "A new delivery date"],
  ["costs_extra_money", "A yes on extra cost"],
]

/** Counts from a person's track record, most specific first. A count, never a score. */
export type YoursCounts = { atPlace: number; placeBrand?: string; inCountry: number; country?: string; ofType: number }

export function yoursText(n: YoursCounts): string {
  const cases = (count: number) => (count === 1 ? "case" : "cases")
  if (n.atPlace > 0) return `${n.atPlace} ${n.placeBrand ?? "pickup place"} ${cases(n.atPlace)} decided`
  if (n.inCountry > 0 && n.country) return `${n.inCountry} ${cases(n.inCountry)} in ${COUNTRY_NAMES[n.country] ?? n.country} decided`
  if (n.ofType > 0) return `${n.ofType} such ${cases(n.ofType)} decided`
  return "First case of this kind"
}

function yoursValue(state: EngineState, c: Case): string | null {
  const personId = c.routedTo?.personId
  if (!personId) return null
  const place = c.placeId ? state.world.places.get(c.placeId) : undefined
  const mine = state.decisions.filter((row) => row.personId === personId && !row.laterChanged)
  return yoursText({
    atPlace: place ? mine.filter((row) => row.placeId === place.id).length : 0,
    placeBrand: place?.site ? brand(place.name, place.city) : undefined,
    inCountry: place?.country ? mine.filter((row) => row.country === place.country).length : 0,
    country: place?.country,
    ofType: mine.filter((row) => row.caseType === c.type).length,
  })
}

/** Stopped, Needs, Yours: at most three label-value rows, never a sentence. */
export function keyFacts(c: Pick<Case, "type" | "reasons" | "status">, yours: string | null): KeyFact[] {
  const out: KeyFact[] = []
  const stopped = STOPPED[c.type] ?? c.reasons.map((reason) => STOPPED_BY_REASON[reason]).find(Boolean)
  if (stopped) out.push({ label: "Stopped", value: stopped })
  if (c.status !== "handled_by_agent") {
    const needs = NEEDS.find(([reason]) => c.reasons.includes(reason))?.[1] ?? (c.status === "waiting_for_person" ? "Your decision" : null)
    if (needs) out.push({ label: "Needs", value: needs })
  }
  if (yours) out.push({ label: "Yours", value: yours })
  return out.slice(0, 3)
}

export function whyFacts(state: EngineState, c: Case): KeyFact[] {
  return keyFacts(c, yoursValue(state, c))
}

// ---- The situation panel ----

const RELEASE_WORDS: Record<string, string> = {
  MISSING: "Missing",
  REQUESTED: "Requested, not received",
  RECEIVED: "Received, not checked",
  VERIFIED: "On file, checked",
  REJECTED: "Rejected",
}

function releaseState(order: OrderWorld): string | null {
  const doc = rows(order.bundle, "documents").filter((row) => row.details.kind === "RELEASE_AUTHORITY")
    .sort((a, b) => String(b.details.updated_at ?? b.details.created_at ?? "").localeCompare(String(a.details.updated_at ?? a.details.created_at ?? "")))[0]
  if (doc) return RELEASE_WORDS[str(doc.details.status) ?? ""] ?? "On the order"
  return order.pickup.site?.details.requires_signed_release === true ? "Missing" : null
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || undefined

function driverOf(order: OrderWorld): { name?: string; fact: string } {
  const live = rows(order.bundle, "work_assignments").find((row) => ["ASSIGNED", "IN_PROGRESS"].includes(str(row.details.status) ?? ""))
  if (live) {
    const name = firstName(order.bundle.dir.driverName(live.details.driver_id))
    return { name, fact: name ? `Booked, ${name}` : "Booked" }
  }
  const offer = rows(order.bundle, "market_offers").find((row) => str(row.details.status) === "PUBLISHED")
  if (offer) {
    const fee = Math.round((Number(offer.details.fee_cents) || 0) / 100)
    return { fact: fee ? `Gig posted at EUR ${fee}` : "Gig posted, no driver" }
  }
  return { fact: "Not booked" }
}

function stop(place: Place, window: { start: string; end: string | null } | null): Stop {
  return {
    place: place.name,
    city: place.city,
    country: place.country,
    position: placePosition(place) ?? { lat: 0, lng: 0 },
    window: window ? { from: window.start, to: window.end ?? window.start } : undefined,
    booked: !!window,
  }
}

export const TYPE_FACT: Record<string, KeyFact> = {
  "readiness.car_not_ready": { label: "Car", value: "Not ready" },
  "readiness.no_answer": { label: "Pickup place", value: "Not answering" },
  "readiness.facts_disagree": { label: "Handover point", value: "Not agreed" },
  "readiness.keys_or_access": { label: "Keys", value: "Holder not named" },
  "readiness.fee_requested": { label: "Fee", value: "Asked by pickup place" },
}

/** Who the case waits for, as one label-value row. */
export function waitingText(c: Pick<Case, "status" | "reasons">, words: { customer: string; pickupPlace: string; person?: string }): KeyFact | undefined {
  const pickupSide: CaseReason[] = ["pickup_place_not_answering", "car_not_ready", "facts_disagree", "papers_missing"]
  if (c.status === "done" || c.status === "handled_by_agent") return undefined
  if (c.status === "decided") return { label: "Waiting", value: "The agent, carrying it out" }
  if (c.reasons.includes("needs_the_customer")) return { label: "Waiting", value: `${words.customer}, the customer` }
  if (c.reasons.includes("driver_safety")) return { label: "Waiting", value: "The driver" }
  if (c.status === "agent_working" || c.reasons.some((reason) => pickupSide.includes(reason))) return { label: "Waiting", value: words.pickupPlace }
  return words.person ? { label: "Waiting", value: words.person } : undefined
}

function waitingOn(state: EngineState, c: Case, order: OrderWorld): KeyFact | undefined {
  // A managed site has a name people say; a private or customer-given address does not.
  const pickupPlace = order.pickup.site ? `${brand(order.pickup.name, order.pickup.city)}, the pickup place` : "The pickup place"
  const customer = firstName(order.customer.name) ?? "The customer"
  const person = state.people.find((p) => p.id === c.routedTo?.personId)?.name
  return waitingText(c, { customer, pickupPlace, person })
}

export function situation(state: EngineState, c: Case): Situation | null {
  const order = state.world.byId.get(c.orderId)
  if (!order) return null
  const windows = chosenWindows(order.bundle)
  const facts: KeyFact[] = []
  const typeFact = TYPE_FACT[c.type]
  const release = releaseState(order)
  if (c.type === "readiness.release_document_missing" && release) facts.push({ label: "Release", value: release })
  if (typeFact) facts.push(typeFact)
  if (c.type !== "readiness.release_document_missing" && release) facts.push({ label: "Release", value: release })
  const pickupZone = windows.pickupSlot?.zone ?? order.pickup.timezone ?? "Europe/Helsinki"
  facts.push({ label: "Pickup", value: windows.pickupSlot ? dayTime(windows.pickupSlot.start, pickupZone) : "Not booked" })
  const driver = driverOf(order)
  facts.push({ label: "Driver", value: driver.fact })
  const deliveryZone = windows.promise?.zone ?? order.delivery.timezone ?? "Europe/Helsinki"
  facts.push({ label: "Delivery", value: windows.promise ? dayTime(windows.promise.start, deliveryZone) : "No promise yet" })
  return {
    orderId: order.id,
    reference: order.reference,
    vehicle: vehicleName(order),
    pickup: stop(order.pickup, windows.pickupSlot),
    delivery: { ...stop(order.delivery, windows.promise), estimatedDelivery: estimatedDelivery(order.bundle) },
    driver: driver.name,
    waitingOn: waitingOn(state, c, order),
    facts: facts.slice(0, 5),
  }
}

/**
 * The one line under the primary button: what the agent does after a yes. Taken from the
 * suggestion's effect, only the part where the agent acts ("The agent then calls the pickup
 * place back on Thursday ..."); the person's own step is already on the button. None when
 * the effect has no agent step, or when nobody is asked any more.
 */
export function nextLine(c: Pick<Case, "status" | "suggestion">): string | undefined {
  if (c.status !== "waiting_for_person") return undefined
  const parts = c.suggestion.effect.split(/(?<=[.;])\s+/).map((p) => p.replace(/;$/, ".").trim()).filter(Boolean)
  const agent = parts.find((p) => /\bthe agent\b/i.test(p) && !/^(a person|you)\b/i.test(p))
  if (!agent) return undefined
  const line = sentence(agent)
  return /[.!?]$/.test(line) ? line : `${line}.`
}

export function caseExtras(state: EngineState, c: Case): CaseV3Extras | null {
  const s = situation(state, c)
  if (!s) return null
  const next = nextLine(c)
  return { why: whyFacts(state, c), situation: s, ...(next ? { next } : {}) }
}
