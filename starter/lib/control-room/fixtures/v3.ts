// Fixtures for the v3 contract (types-v3.ts): the Overview map, the Work lists and
// the extras a case carries in Work (why, the situation). Built on the same store
// and cases as ./index.ts, so a decision made in Work moves the case here too.
//
// Coordinates: city centres from Wikipedia/GeoNames, rounded; the fixture pickup
// places are made-up names, placed inside their real city. Cars that are not one
// of the fixture cases are generated deterministically (a seeded random walk over
// Bahn's markets), so every screenshot shows the same map.

import type { Case, CaseStatus } from "../types"
import type { CaseV3Extras, KeyFact, LatLng, MapCar, Overview, Situation, Stop, WorkLists, WorkRow } from "../types-v3"
import type { Endpoint, OrderSummary } from "../views"
import { caseDetail } from "./index"
import { ROOM_NOW } from "./clock"
import { ORDERS } from "./orders"
import { PEOPLE } from "./people"

// ---------- Places ----------

/** Fixture pickup and delivery places, keyed by place name. Inside the real city, the street is made up. */
const PLACE_AT: Record<string, LatLng> = {
  "Calverona Hamburg": { lat: 53.5758, lng: 9.9466 },
  "Kovellin Hamburg": { lat: 53.4893, lng: 10.2185 },
  "Velantora Helsinki": { lat: 60.2081, lng: 24.9663 },
  "Arvelano Hamburg": { lat: 53.5552, lng: 10.0781 },
  "Tervellin Aarhus Centrum": { lat: 56.1559, lng: 10.2099 },
  "Mervikko Espoo": { lat: 60.1847, lng: 24.6573 },
  "Tervavio Tampere": { lat: 61.4917, lng: 23.7792 },
  "Independent vehicle storage": { lat: 62.7871, lng: 22.8461 },
  "Kervalin Frankfurt": { lat: 50.1103, lng: 8.6604 },
  "Norvarken Cologne": { lat: 50.9416, lng: 6.9575 },
  "Arvellumio Vehicle Hub Hamburg": { lat: 53.5341, lng: 10.0242 },
  "Rovellavio Hamburg": { lat: 53.6011, lng: 10.0367 },
}

/** Private delivery addresses: a made-up spot in the named city. */
const PRIVATE_AT: Record<string, LatLng> = {
  "ord-00516": { lat: 60.1597, lng: 24.8803 }, // Helsinki, Lauttasaari
  "ord-00593": { lat: 60.4478, lng: 22.2934 }, // Turku
  "ord-00015": { lat: 60.1872, lng: 24.9601 }, // Helsinki, Kallio
}

const placeAt = (orderId: string, e: Endpoint): LatLng =>
  PLACE_AT[e.placeName] ?? PRIVATE_AT[orderId] ?? CITY[e.city] ?? { lat: 60.17, lng: 24.94 }

// City centres (Wikipedia/GeoNames). Weight = a rough share of Bahn's cars per day, made up.
const CITIES: { name: string; country: "FI" | "DE" | "DK" | "SE"; at: LatLng; w: number }[] = [
  { name: "Helsinki", country: "FI", at: { lat: 60.1699, lng: 24.9384 }, w: 30 },
  { name: "Espoo", country: "FI", at: { lat: 60.2055, lng: 24.6559 }, w: 10 },
  { name: "Vantaa", country: "FI", at: { lat: 60.2934, lng: 25.0378 }, w: 10 },
  { name: "Tampere", country: "FI", at: { lat: 61.4978, lng: 23.761 }, w: 12 },
  { name: "Turku", country: "FI", at: { lat: 60.4518, lng: 22.2666 }, w: 10 },
  { name: "Oulu", country: "FI", at: { lat: 65.0121, lng: 25.4651 }, w: 6 },
  { name: "Jyväskylä", country: "FI", at: { lat: 62.2426, lng: 25.7473 }, w: 5 },
  { name: "Lahti", country: "FI", at: { lat: 60.9827, lng: 25.6612 }, w: 6 },
  { name: "Kuopio", country: "FI", at: { lat: 62.8924, lng: 27.677 }, w: 4 },
  { name: "Pori", country: "FI", at: { lat: 61.4851, lng: 21.7974 }, w: 3 },
  { name: "Seinäjoki", country: "FI", at: { lat: 62.7903, lng: 22.8403 }, w: 3 },
  { name: "Vaasa", country: "FI", at: { lat: 63.0951, lng: 21.6165 }, w: 3 },
  { name: "Hämeenlinna", country: "FI", at: { lat: 60.9959, lng: 24.4643 }, w: 4 },
  { name: "Lappeenranta", country: "FI", at: { lat: 61.0587, lng: 28.1887 }, w: 2 },
  { name: "Hamburg", country: "DE", at: { lat: 53.5511, lng: 9.9937 }, w: 14 },
  { name: "Berlin", country: "DE", at: { lat: 52.52, lng: 13.405 }, w: 10 },
  { name: "Munich", country: "DE", at: { lat: 48.1351, lng: 11.582 }, w: 8 },
  { name: "Frankfurt", country: "DE", at: { lat: 50.1109, lng: 8.6821 }, w: 7 },
  { name: "Cologne", country: "DE", at: { lat: 50.9375, lng: 6.9603 }, w: 6 },
  { name: "Düsseldorf", country: "DE", at: { lat: 51.2277, lng: 6.7735 }, w: 5 },
  { name: "Stuttgart", country: "DE", at: { lat: 48.7758, lng: 9.1829 }, w: 5 },
  { name: "Bremen", country: "DE", at: { lat: 53.0793, lng: 8.8017 }, w: 4 },
  { name: "Hannover", country: "DE", at: { lat: 52.3759, lng: 9.732 }, w: 4 },
  { name: "Leipzig", country: "DE", at: { lat: 51.3397, lng: 12.3731 }, w: 3 },
  { name: "Lübeck", country: "DE", at: { lat: 53.8655, lng: 10.6866 }, w: 3 },
  { name: "Dortmund", country: "DE", at: { lat: 51.5136, lng: 7.4653 }, w: 3 },
  { name: "Copenhagen", country: "DK", at: { lat: 55.6761, lng: 12.5683 }, w: 9 },
  { name: "Aarhus", country: "DK", at: { lat: 56.1629, lng: 10.2039 }, w: 5 },
  { name: "Odense", country: "DK", at: { lat: 55.4038, lng: 10.4024 }, w: 3 },
  { name: "Aalborg", country: "DK", at: { lat: 57.0488, lng: 9.9217 }, w: 2 },
  { name: "Stockholm", country: "SE", at: { lat: 59.3293, lng: 18.0686 }, w: 4 },
  { name: "Gothenburg", country: "SE", at: { lat: 57.7089, lng: 11.9746 }, w: 2 },
  { name: "Malmö", country: "SE", at: { lat: 55.605, lng: 13.0038 }, w: 2 },
]
const CITY: Record<string, LatLng> = Object.fromEntries(CITIES.map((c) => [c.name, c.at]))

// ---------- The cars on the road today ----------

/** Cars today in the fixture world. Agrees with the 286 orders the lead view says were checked. */
const CARS_TODAY = 286
/** Orders the agent is on right now that have not become a case (calls, waiting for a reply). */
const AGENT_ON_ORDERS = 12
/** Red without a case: the order check needs a person but no case exists yet (as on the engine,
 *  e.g. a sold-out ferry or a warning light). Their pins open the order, not Work. */
const RED_WITHOUT_CASE = new Set([17, 88, 151, 230])

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VEHICLES = [
  "Toyota RAV4", "Volvo XC60", "Volvo V60", "Tesla Model Y", "Skoda Octavia", "Volkswagen ID.4", "BMW 3 Series", "BMW X1",
  "Audi A4", "Audi Q4 e-tron", "Kia EV6", "Kia Sportage", "Hyundai Ioniq 5", "Mercedes-Benz GLC", "Polestar 2", "Ford Kuga",
  "Peugeot 3008", "Nissan Leaf", "Volkswagen Golf", "Toyota Corolla", "Mazda CX-5", "Skoda Enyaq", "Cupra Born", "MG4",
]

function generatedCars(): MapCar[] {
  const rnd = seeded(420458)
  const total = CITIES.reduce((s, c) => s + c.w, 0)
  const pick = (pool = CITIES) => {
    const sum = pool.reduce((s, c) => s + c.w, 0)
    let r = rnd() * (pool === CITIES ? total : sum)
    for (const c of pool) if ((r -= c.w) <= 0) return c
    return pool[pool.length - 1]
  }
  const jitter = (p: LatLng, km: number): LatLng => ({
    lat: p.lat + (rnd() - 0.5) * (km / 111) * 2,
    lng: p.lng + ((rnd() - 0.5) * (km / 111) * 2) / Math.cos((p.lat * Math.PI) / 180),
  })

  const n = CARS_TODAY - FIXTURE_ORDER_IDS.length
  const cars: MapCar[] = []
  for (let i = 0; i < n; i++) {
    const from = pick()
    const sameCountry = CITIES.filter((c) => c.country === from.country)
    const cross = rnd() < 0.08
    const to = rnd() < 0.3 ? from : cross ? pick(CITIES.filter((c) => c.country !== from.country && c.country !== "SE")) : pick(sameCountry)
    const stage = rnd()
    let position: LatLng
    let positionSource: MapCar["positionSource"]
    if (stage < 0.38) {
      position = jitter(from.at, 7)
      positionSource = "at_pickup"
    } else if (stage < 0.8 && to !== from) {
      const t = 0.15 + rnd() * 0.7
      position = jitter({ lat: from.at.lat + (to.at.lat - from.at.lat) * t, lng: from.at.lng + (to.at.lng - from.at.lng) * t }, 3)
      positionSource = rnd() < 0.3 ? "tracking" : "estimated"
    } else {
      position = jitter(to.at, 7)
      positionSource = "at_delivery"
    }
    const ref = 421100 + i * 7
    const eta = Date.parse(ROOM_NOW) + Math.round((1 + rnd() * 8) * 60) * 60_000
    cars.push({
      orderId: `ord-g${ref}`,
      reference: `CD-${ref}`,
      vehicle: VEHICLES[Math.floor(rnd() * VEHICLES.length)],
      state: RED_WITHOUT_CASE.has(i)
        ? "needs_person"
        : i % Math.floor(n / AGENT_ON_ORDERS) === 3 && cars.filter((c) => c.state === "agent_working").length < AGENT_ON_ORDERS
          ? "agent_working"
          : "on_plan",
      position,
      positionSource,
      from: from.name,
      to: to.name,
      nextAt: new Date(eta).toISOString(),
    })
  }
  return cars
}

const FIXTURE_ORDER_IDS = Object.keys(ORDERS)

const carState = (status: CaseStatus): MapCar["state"] =>
  status === "waiting_for_person" ? "needs_person" : status === "agent_working" ? "agent_working" : "on_plan"

/** The fixture cases' own cars, at their pickup place (none of them has left yet). */
function caseCars(cases: Case[]): MapCar[] {
  return FIXTURE_ORDER_IDS.map((orderId) => {
    const o = ORDERS[orderId]
    const c = cases.find((x) => x.orderId === orderId)
    const state = c ? carState(c.status) : "on_plan"
    return {
      orderId,
      reference: o.reference,
      vehicle: o.vehicle,
      state,
      position: placeAt(orderId, o.pickup),
      positionSource: "at_pickup" as const,
      from: o.pickup.placeName,
      to: o.delivery.placeName === "Private address" ? o.delivery.city : o.delivery.placeName,
      caseId: state === "needs_person" ? c?.id : undefined,
      nextAt: state === "needs_person" ? c?.decideBy : o.delivery.window?.start,
    }
  })
}

let generated: MapCar[] | null = null

// ---------- Rows ----------

function row(c: Case): WorkRow {
  const o: OrderSummary | undefined = ORDERS[c.orderId]
  return { caseId: c.id, orderId: c.orderId, vehicle: o?.vehicle ?? c.orderId, place: o?.pickup.placeName ?? "", decideBy: c.decideBy, status: c.status }
}

const byDecideBy = (a: Case, b: Case) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999")
const personOf = (id?: string) => PEOPLE.find((p) => p.id === (id ?? "").replace(/^p-/, "")) ?? PEOPLE[0]

/** The store the decisions write to (see ./index.ts). */
function cases(): Case[] {
  const g = globalThis as unknown as { __crFixtureStore?: { cases: Case[] } }
  if (!g.__crFixtureStore) caseDetail("case-420458") // creates the store
  return g.__crFixtureStore!.cases
}

export function workLists(personId?: string, opts: { extraRows?: number } = {}): WorkLists {
  const me = personOf(personId)
  const all = cases()
  const onMyDesks = (c: Case) => me.desks.includes(c.desk)
  const needYou = all.filter((c) => c.status === "waiting_for_person" && c.routedTo?.personId === me.id).sort(byDecideBy).map(row)
  if (opts.extraRows) {
    // Copies of real cases to check that a long list stays calm. Fixture mode only.
    const pool = all.filter((c) => c.status === "waiting_for_person")
    for (let i = 0; i < opts.extraRows; i++) {
      const src = pool[i % pool.length]
      const decideBy = new Date(Date.parse(ROOM_NOW) + (65 + i * 47) * 60_000).toISOString()
      needYou.push({ ...row(src), caseId: `${src.id}-copy-${i + 1}`, decideBy })
    }
    needYou.sort((a, b) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999"))
  }
  return {
    needYou,
    agentWorking: all.filter((c) => c.status === "agent_working" && onMyDesks(c)).map(row),
    doneToday: all
      .filter((c) => ((c.status === "decided" || c.status === "done") && c.routedTo?.personId === me.id) || (c.status === "handled_by_agent" && onMyDesks(c)))
      .map(row),
  }
}

export function overview(personId?: string): Overview {
  const all = cases()
  generated ??= generatedCars()
  const cars = [...generated, ...caseCars(all)]
  const needsPerson = cars.filter((c) => c.state === "needs_person").length
  const agentWorking = cars.filter((c) => c.state === "agent_working").length
  const needYou = workLists(personId).needYou
  return {
    now: ROOM_NOW,
    counts: {
      carsToday: cars.length,
      onTheRoad: cars.filter((c) => c.positionSource === "tracking" || c.positionSource === "estimated").length,
      needsPerson,
      needYou: needYou.length,
      agentWorking,
      handledByAgentToday: 2 + all.filter((c) => c.status === "handled_by_agent").length,
    },
    cars,
    needYou,
  }
}

// ---------- Why it came to you, and the situation ----------

/** Key facts per case: label and value, never a sentence. "Yours" counts from the track record (learning.ts). */
const WHY: Record<string, KeyFact[]> = {
  "case-420458": [
    { label: "Stopped", value: "Seller's hold on the car" },
    { label: "Needs", value: "The customer" },
    { label: "Yours", value: "8 German release cases decided" },
  ],
  "case-420516": [
    { label: "Stopped", value: "Nobody can name the key holder" },
    { label: "Needs", value: "The customer" },
    { label: "Yours", value: "9 key cases decided" },
  ],
  "case-420347": [
    { label: "Stopped", value: "Place cannot find the car" },
    { label: "Needs", value: "A change to a posted gig" },
    { label: "Yours", value: "6 cases like it decided" },
  ],
  "case-420593": [
    { label: "Stopped", value: "Car not at the pickup place" },
    { label: "Needs", value: "Pay an empty pickup" },
    { label: "Yours", value: "7 empty pickups decided" },
  ],
  "case-420015": [
    { label: "Stopped", value: "Pickup place not answering" },
    { label: "Needs", value: "The customer" },
    { label: "Yours", value: "5 Finnish release cases decided" },
  ],
}

/** Who or what each case is waiting on, and the few facts that decide it. At most 5. */
const SITUATION_FACTS: Record<string, { waitingOn?: KeyFact; facts: KeyFact[] }> = {
  "case-420458": {
    waitingOn: { label: "Waiting on", value: "The seller's signed release" },
    facts: [
      { label: "Release document", value: "Missing" },
      { label: "Pickup slot", value: "Not booked" },
      { label: "Customer", value: "Kovellin Automobilhandel" },
    ],
  },
  "case-420516": {
    waitingOn: { label: "Waiting on", value: "Auvelloria to name the key holder" },
    facts: [
      { label: "Keys", value: "Not at reception" },
      { label: "Pickup slot", value: "Booked" },
      { label: "Customer", value: "Auvelloria Motor Collection" },
    ],
  },
  "case-420347": {
    waitingOn: { label: "Waiting on", value: "Arvelano's stock control" },
    facts: [
      { label: "Gig", value: "Posted, €456" },
      { label: "Pickup slot", value: "Booked" },
      { label: "Customer", value: "Tervellin Biler" },
    ],
  },
  "case-420593": {
    waitingOn: { label: "Waiting", value: "Yara, at the pickup place since 10:00" },
    facts: [
      { label: "Car", value: "Not found at the place" },
      { label: "Gig", value: "Driver booked, €134" },
      { label: "Customer", value: "Pellavaro Auto" },
    ],
  },
  "case-420015": {
    waitingOn: { label: "Waiting on", value: "Mervikko Espoo to answer" },
    facts: [
      { label: "Who releases the car", value: "Not confirmed" },
      { label: "Pickup slot", value: "Booked" },
      { label: "Customer", value: "Suvellio Motors" },
    ],
  },
}

/** One short line under the primary button: what the agent does next. Only where it is true and adds something. */
const NEXT: Record<string, string> = {
  "o458-email": "The agent checks the release with Calverona before any driver is booked.",
  "o516-ask": "The driver stays on hold until the agent confirms the name with Velantora.",
  "o347-withdraw": "The agent calls Arvelano after 15:00 and brings the gig back to you.",
  "o593-release": "Before a new pickup is planned, the agent finds out where the car is.",
  "o015-reply": "If nobody answers by 14:00, this comes back to you.",
}

function stop(orderId: string, e: Endpoint, booked: boolean): Stop {
  return {
    place: e.placeName,
    city: e.city,
    country: e.country,
    position: placeAt(orderId, e),
    window: e.window ? { from: e.window.start, to: e.window.end } : undefined,
    booked,
  }
}

/** The copies in a 40-row list open their original case. */
export const baseCaseId = (id: string) => id.replace(/-copy-\d+$/, "")

export function caseExtras(id: string): (CaseV3Extras & { next?: string }) | null {
  const c = cases().find((x) => x.id === baseCaseId(id))
  if (!c) return null
  const o = ORDERS[c.orderId]
  if (!o) return null
  const extra = SITUATION_FACTS[c.id]
  const pickupBooked = !/not booked/i.test(o.pickup.window?.label ?? "") && !!o.pickup.window
  const situation: Situation = {
    orderId: o.orderId,
    reference: o.reference,
    vehicle: o.vehicle,
    pickup: stop(o.orderId, o.pickup, pickupBooked),
    delivery: { ...stop(o.orderId, o.delivery, !/not agreed/i.test(o.delivery.window?.label ?? "")), estimatedDelivery: o.delivery.window?.start },
    driver: o.driver?.name.split(" ")[0],
    waitingOn: extra?.waitingOn,
    facts: (extra?.facts ?? [{ label: "Customer", value: o.customer.name }]).slice(0, 5),
  }
  return { why: (WHY[c.id] ?? []).slice(0, 3), situation, next: NEXT[c.suggestion.id] }
}
