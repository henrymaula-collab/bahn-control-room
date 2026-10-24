// Fixtures for the v3 shapes (types-v3.ts): the Overview map, the Work lists and
// the key facts and situation of a case, built from the same fixture cases and
// orders the other screens use, with the same rules as the engine (../v3.ts).
// The map adds made-up quiet cars around the fixture cases, the way CR_SCALE does
// for the engine, plus a few made-up orders that need a person but have no desk
// case yet (the engine has those too: Bentley, ferries, a sick driver).

import { along, carAt, cityEntry, placePosition } from "../geo"
import type { Case, OpsPerson, TrackRecord } from "../types"
import type { CarState, CaseV3Extras, KeyFact, LatLng, MapCar, Overview, PositionSource, Situation, Stop, WorkLists, WorkRow } from "../types-v3"
import { TYPE_FACT, brand, firstName, keyFacts, nextLine, shortPlace, waitingText, yoursText } from "../v3"
import type { Endpoint, OrderSummary } from "../views"
import { dayTime } from "../vocab"

const byDecideBy = (a: Case, b: Case) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999") || a.id.localeCompare(b.id)
const lastTouch = (c: Case) => c.agentSteps[c.agentSteps.length - 1]?.at ?? c.createdAt

function endpointPosition(e: Endpoint): LatLng {
  return placePosition({ id: e.placeId ?? e.placeName, city: e.city, country: e.country }) ?? { lat: 54, lng: 15 }
}

function caseState(c: Case): CarState {
  if (c.status === "waiting_for_person") return "needs_person"
  if (c.status === "agent_working" || c.status === "decided") return "agent_working"
  return "on_plan"
}

function row(c: Case, orders: Record<string, OrderSummary>): WorkRow {
  const order = orders[c.orderId]
  return {
    caseId: c.id,
    orderId: c.orderId,
    vehicle: order?.vehicle ?? "Car",
    place: order ? shortPlace(order.pickup.placeName, order.pickup.city) : "Pickup place",
    decideBy: c.decideBy,
    status: c.status,
  }
}

export function fixtureWorkLists(cases: Case[], orders: Record<string, OrderSummary>, person: OpsPerson): WorkLists {
  // Fixture desks: the shift lead sees the Readiness desk too, as in the lead view.
  const onMyDesks = (c: Case) => person.desks.includes(c.desk) || person.role === "shift_lead"
  return {
    needYou: cases.filter((c) => c.status === "waiting_for_person" && c.routedTo?.personId === person.id).sort(byDecideBy).map((c) => row(c, orders)),
    agentWorking: cases.filter((c) => (c.status === "agent_working" || c.status === "decided") && onMyDesks(c)).sort(byDecideBy).map((c) => row(c, orders)),
    doneToday: cases.filter((c) => (c.status === "done" || c.status === "handled_by_agent") && onMyDesks(c))
      .sort((a, b) => lastTouch(b).localeCompare(lastTouch(a)) || a.id.localeCompare(b.id)).map((c) => row(c, orders)),
  }
}

// ---- Made-up cars around the fixture cases ----

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

// Cities weighted roughly like the packet (Finland and Germany first).
const CITIES: [string, string, number][] = [
  ["Helsinki", "FI", 9], ["Espoo", "FI", 6], ["Vantaa", "FI", 4], ["Turku", "FI", 5], ["Tampere", "FI", 4], ["Lahti", "FI", 4],
  ["Oulu", "FI", 3], ["Seinäjoki", "FI", 1], ["Hamburg", "DE", 7], ["Frankfurt", "DE", 3], ["Munich", "DE", 3], ["Cologne", "DE", 3],
  ["Berlin", "DE", 2], ["Leipzig", "DE", 2], ["Düsseldorf", "DE", 1], ["Stuttgart", "DE", 1], ["Copenhagen", "DK", 4], ["Odense", "DK", 2],
  ["Aarhus", "DK", 2], ["Stockholm", "SE", 2], ["Gothenburg", "SE", 1], ["Malmö", "SE", 1], ["Lyon", "FR", 2], ["Paris", "FR", 1],
  ["Marseille", "FR", 1], ["Lille", "FR", 1], ["Vienna", "AT", 1], ["Graz", "AT", 1], ["Antwerp", "BE", 1], ["Rotterdam", "NL", 1],
]
const BRANDS = ["Velantora", "Calverona", "Arvelano", "Kervalin", "Tervavio", "Mervikko", "Vandellora", "Pellavaro", "Norvarken", "Orveldan"]
const VEHICLES = ["Volvo V60", "Toyota RAV4", "BMW i4", "Audi Q8 e-tron", "Mercedes-Benz GLC", "Skoda Enyaq", "Volkswagen ID.4", "Tesla Model Y", "Porsche Taycan", "Kia EV6", "Ford Kuga", "Peugeot 3008"]
const QUIET = 380
const UNCASED_RED = 6
/** Why the made-up red cars without a case are red, in the engine's words (../v3.ts redReason). */
const UNCASED_REASONS = ["Safety stop", "Vehicle warning", "No driver for the pickup", "Customer waiting for an answer", "Driver may not reach the pickup", "Cancelled, money still open"]

function pickCity(random: () => number): [string, string] {
  const total = CITIES.reduce((sum, [, , w]) => sum + w, 0)
  let left = random() * total
  for (const [city, country, w] of CITIES) {
    left -= w
    if (left <= 0) return [city, country]
  }
  return ["Helsinki", "FI"]
}

type FixtureCar = MapCar & { onRoad: boolean }

function madeUpCars(): FixtureCar[] {
  const random = rng(20261021)
  const out: FixtureCar[] = []
  for (let i = 0; i < QUIET + UNCASED_RED; i++) {
    const [fromCity, fromCountry] = pickCity(random)
    const [toCity, toCountry] = pickCity(random)
    const fromBrand = BRANDS[Math.floor(random() * BRANDS.length)]!
    const toBrand = BRANDS[Math.floor(random() * BRANDS.length)]!
    const vehicle = VEHICLES[Math.floor(random() * VEHICLES.length)]!
    const stage = random()
    const progress = 0.08 + random() * 0.84
    const orderId = `fx-${String(i + 1).padStart(4, "0")}`
    const a = placePosition({ id: `${fromBrand}-${fromCity}`, city: fromCity, country: fromCountry }) ?? cityEntry(fromCity, fromCountry)!
    const b = placePosition({ id: `${toBrand}-${toCity}`, city: toCity, country: toCountry }) ?? cityEntry(toCity, toCountry)!
    // About half wait at the pickup place, a quarter are on the road, a quarter were delivered today.
    const where: PositionSource = stage < 0.5 ? "at_pickup" : stage < 0.62 ? "tracking" : stage < 0.75 ? "estimated" : "at_delivery"
    const position = where === "at_pickup" ? carAt(a, orderId) : where === "at_delivery" ? carAt(b, orderId) : carAt(along([a, b], progress), orderId)
    const red = i >= QUIET
    out.push({
      orderId,
      reference: `CD-43${String(1000 + i).padStart(4, "0")}`,
      vehicle,
      state: red ? "needs_person" : i % 29 === 0 ? "agent_working" : "on_plan",
      position,
      positionSource: red ? "at_pickup" : where,
      from: `${fromBrand} ${fromCity}`,
      to: toCity,
      ...(red ? { reason: UNCASED_REASONS[(i - QUIET) % UNCASED_REASONS.length] } : {}),
      onRoad: !red && (where === "tracking" || where === "estimated"),
    })
  }
  return out
}

let MADE_UP: FixtureCar[] | null = null

export function fixtureOverview(now: string, cases: Case[], orders: Record<string, OrderSummary>, person: OpsPerson): Overview {
  MADE_UP ??= madeUpCars()
  const caseCars: FixtureCar[] = cases.flatMap((c) => {
    const order = orders[c.orderId]
    if (!order) return []
    return [{
      orderId: order.orderId,
      reference: order.reference,
      vehicle: order.vehicle,
      state: caseState(c),
      position: carAt(endpointPosition(order.pickup), order.orderId),
      positionSource: "at_pickup" as const,
      from: order.pickup.placeName,
      to: order.delivery.placeName === "Private address" ? order.delivery.city : order.delivery.placeName,
      caseId: c.id,
      nextAt: c.status === "waiting_for_person" ? c.decideBy : order.delivery.window?.end,
      ...(c.status === "waiting_for_person" ? { reason: keyFacts(c, null).find((f) => f.label === "Stopped")?.value ?? "Needs a person" } : {}),
      onRoad: false,
    }]
  })
  const cars = [...caseCars, ...MADE_UP]
  const needYou = fixtureWorkLists(cases, orders, person).needYou
  return {
    now,
    counts: {
      carsToday: cars.length,
      onTheRoad: cars.filter((car) => car.onRoad).length,
      needsPerson: cars.filter((car) => car.state === "needs_person").length,
      needYou: needYou.length,
      agentWorking: cars.filter((car) => car.state === "agent_working").length,
      handledByAgentToday: cases.filter((c) => c.status === "handled_by_agent").length,
    },
    cars: cars.map(({ onRoad: _onRoad, ...car }) => car),
    needYou,
  }
}

// ---- Key facts and the situation ----

function stop(e: Endpoint): Stop {
  const booked = !!e.window && !/not booked|not agreed/i.test(e.window.label)
  return {
    place: e.placeName,
    city: e.city,
    country: e.country,
    position: endpointPosition(e),
    window: e.window ? { from: e.window.start, to: e.window.end } : undefined,
    booked,
  }
}

export function fixtureCaseExtras(c: Case, order: OrderSummary | undefined, people: OpsPerson[], records: TrackRecord[]): CaseV3Extras | null {
  if (!order) return null
  const personId = c.routedTo?.personId
  const mine = records.filter((r) => r.personId === personId)
  const net = (list: TrackRecord[]) => list.reduce((sum, r) => sum + r.decided - r.laterChanged, 0)
  const yours = personId ? yoursText({
    atPlace: net(mine.filter((r) => r.placeId && r.placeId === c.placeId)),
    placeBrand: brand(order.pickup.placeName, order.pickup.city),
    inCountry: net(mine.filter((r) => r.country === order.pickup.country && (!r.caseType || r.caseType === c.type))),
    country: order.pickup.country,
    ofType: net(mine.filter((r) => r.caseType === c.type)),
  }) : null

  const facts: KeyFact[] = []
  const release = order.documents?.find((d) => /release/i.test(d.label))?.state
  if (c.type === "readiness.release_document_missing" && release) facts.push({ label: "Release", value: release })
  const typeFact = TYPE_FACT[c.type]
  if (typeFact) facts.push(typeFact)
  if (c.type !== "readiness.release_document_missing" && release) facts.push({ label: "Release", value: release })
  const pickup = stop(order.pickup)
  const delivery = stop(order.delivery)
  facts.push({ label: "Pickup", value: pickup.booked && order.pickup.window ? dayTime(order.pickup.window.start, order.pickup.timezone) : "Not booked" })
  const driverName = firstName(order.driver?.name)
  facts.push({
    label: "Driver",
    value: driverName ? `Booked, ${driverName}` : order.gig?.state === "Gig posted" ? `Gig posted at EUR ${order.gig.feeEur}` : "Not booked",
  })
  facts.push({ label: "Delivery", value: order.delivery.window ? dayTime(order.delivery.window.start, order.delivery.timezone) : "No promise yet" })

  const situation: Situation = {
    orderId: order.orderId,
    reference: order.reference,
    vehicle: order.vehicle,
    pickup,
    delivery: { ...delivery, estimatedDelivery: order.delivery.window?.end },
    driver: driverName,
    waitingOn: waitingText(c, {
      customer: firstName(order.customer.name) ?? "The customer",
      pickupPlace: order.pickup.placeId ? `${brand(order.pickup.placeName, order.pickup.city)}, the pickup place` : "The pickup place",
      person: people.find((p) => p.id === personId)?.name,
    }),
    facts: facts.slice(0, 5),
  }
  const next = nextLine(c)
  return { why: keyFacts(c, yours), situation, ...(next ? { next } : {}) }
}
