// Tests for the v3 views: the Overview map, the Work lists and the case extras.
// Run: npm run test:cr. The geo and fixture tests need nothing; the engine tests
// read the seeded database (docker compose up -d --wait, db:seed, db:seed:cr)
// and are skipped, with a message, when it is not reachable.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { sql } from "drizzle-orm"
import { CITY_COORDS, along, carAt, cityKey, inEurope, km, placePosition, seaLane } from "./geo"
import type { CaseV3Extras, KeyFact, Overview, WorkLists } from "./types-v3"

const RAW = /\b[A-Z]{2,}(?:_[A-Z]+)+\b|\b[a-z]+(?:_[a-z]+)+\b|\breadiness\.|\bundefined\b|\bnull\b|\bNaN\b/
const words = (text: string) => text.trim().split(/\s+/).length

function assertPlain(text: string | undefined, where: string) {
  if (text === undefined) return
  assert.ok(text.trim().length > 0, `${where} is empty`)
  assert.ok(!RAW.test(text), `${where} shows a raw enum or value: "${text}"`)
}

function assertFact(fact: KeyFact, where: string, maxWords = 6) {
  assertPlain(fact.label, `${where} label`)
  assertPlain(fact.value, `${where} value`)
  assert.ok(words(fact.value) <= maxWords, `${where} "${fact.value}" is longer than ${maxWords} words`)
  assert.ok(!/\.$/.test(fact.value), `${where} "${fact.value}" reads as a sentence`)
}

function assertOverview(o: Overview, where: string) {
  assert.equal(o.counts.carsToday, o.cars.length, `${where}: carsToday counts the cars`)
  assert.equal(o.counts.needsPerson, o.cars.filter((car) => car.state === "needs_person").length, `${where}: needsPerson counts the red cars`)
  assert.equal(o.counts.agentWorking, o.cars.filter((car) => car.state === "agent_working").length, `${where}: agentWorking counts the agent's cars`)
  assert.equal(o.counts.needYou, o.needYou.length, `${where}: needYou counts the rows`)
  assert.ok(o.counts.onTheRoad <= o.counts.carsToday)
  const ids = new Set<string>()
  for (const car of o.cars) {
    assert.ok(!ids.has(car.orderId), `${where}: ${car.orderId} is on the map once`)
    ids.add(car.orderId)
    assert.ok(inEurope(car.position), `${where}: ${car.reference} at ${JSON.stringify(car.position)} is inside Europe`)
    for (const [key, value] of Object.entries({ vehicle: car.vehicle, from: car.from, to: car.to, reference: car.reference })) assertPlain(value, `${where}: ${car.reference}.${key}`)
    assert.notEqual(car.vehicle, "Car", `${where}: ${car.reference} names its car`)
    if (car.nextAt) assert.ok(!Number.isNaN(Date.parse(car.nextAt)), `${where}: ${car.reference}.nextAt is a time`)
  }
  for (const row of o.needYou) {
    const car = o.cars.find((candidate) => candidate.caseId === row.caseId)
    assert.ok(car, `${where}: the car of ${row.caseId} is on the map`)
    assert.equal(car!.state, "needs_person", `${where}: ${row.caseId} is red`)
  }
}

function assertWork(w: WorkLists, where: string) {
  for (const [list, rows] of Object.entries(w)) {
    for (const row of rows as WorkLists["needYou"]) {
      assertPlain(row.vehicle, `${where}.${list} ${row.caseId} vehicle`)
      assertPlain(row.place, `${where}.${list} ${row.caseId} place`)
    }
  }
  for (const row of w.needYou) assert.equal(row.status, "waiting_for_person")
  const urgent = w.needYou.map((row) => row.decideBy ?? "9999")
  assert.deepEqual(urgent, [...urgent].sort(), `${where}: needYou is most urgent first`)
}

function assertExtras(x: CaseV3Extras, where: string) {
  assert.ok(x.why.length <= 3, `${where}: at most 3 key facts`)
  for (const fact of x.why) {
    assert.ok(["Stopped", "Needs", "Yours"].includes(fact.label), `${where}: why label ${fact.label}`)
    assertFact(fact, `${where} why`)
    if (fact.label === "Yours") assert.ok(/^\d+ |^First case/.test(fact.value), `${where}: Yours is a count, never a score: "${fact.value}"`)
  }
  const s = x.situation
  assert.ok(s.facts.length <= 5, `${where}: at most 5 situation facts`)
  for (const fact of s.facts) assertFact(fact, `${where} fact`)
  if (s.waitingOn) assertFact(s.waitingOn, `${where} waitingOn`)
  assertPlain(s.vehicle, `${where} vehicle`)
  assert.ok(s.vehicle.split(" ").length >= 2, `${where}: vehicle is make and model ("${s.vehicle}")`)
  for (const stop of [s.pickup, s.delivery]) {
    assert.ok(inEurope(stop.position), `${where}: ${stop.place} inside Europe`)
    assertPlain(stop.place, `${where} stop place`)
    assertPlain(stop.city, `${where} stop city`)
  }
  if (s.driver) assert.ok(!s.driver.includes(" "), `${where}: driver is a first name ("${s.driver}")`)
}

// ---- Geo: no database ----

test("geo: every city in the dataset has coordinates inside Europe", () => {
  const dir = join(process.cwd(), "..", "dataset", "data")
  const cities = new Set<string>()
  for (const file of ["addresses.jsonl", "sites.jsonl", "ferry_terminals.jsonl"]) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim()) continue
      const row = JSON.parse(line) as { city?: string; country?: string }
      if (row.city && row.country) cities.add(cityKey(row.city, row.country))
    }
  }
  assert.ok(cities.size >= 20, `found ${cities.size} cities`)
  for (const key of cities) {
    assert.ok(CITY_COORDS[key], `${key} is in the geocode table`)
    assert.ok(inEurope(CITY_COORDS[key]!), `${key} is inside Europe`)
  }
})

test("geo: places and cars are deterministic and stay near their city", () => {
  const hamburg = CITY_COORDS["DE:Hamburg"]!
  const a = placePosition({ id: "site-042", city: "Hamburg", country: "DE" })!
  assert.deepEqual(a, placePosition({ id: "site-042", city: "Hamburg", country: "DE" }), "same place, same spot")
  assert.notDeepEqual(a, placePosition({ id: "site-047", city: "Hamburg", country: "DE" }), "two places in one city do not share a spot")
  assert.ok(km(a, hamburg) <= 2.6)
  const car1 = carAt(a, "ord-1")
  const car2 = carAt(a, "ord-2")
  assert.notDeepEqual(car1, car2, "two cars at one place do not stack")
  assert.ok(km(car1, a) <= 0.36 && km(car2, a) <= 0.36)
  const helsinki = CITY_COORDS["FI:Helsinki"]!
  for (let i = 0; i < 50; i++) {
    const p = placePosition({ id: `site-${i}`, city: "Helsinki", country: "FI" })!
    assert.ok(p.lat >= helsinki.lat - 0.002, `Helsinki places stay on the land side (${p.lat})`)
  }
  const ll = (p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })
  const route = [CITY_COORDS["DE:Frankfurt"]!, CITY_COORDS["DE:Hamburg"]!, CITY_COORDS["FI:Helsinki"]!].map(ll)
  assert.deepEqual(ll(along(route, 0)), route[0])
  assert.deepEqual(ll(along(route, 1)), route[2])
  const early = along(route, 0.1)
  assert.ok(early.lat > route[0]!.lat && early.lat < route[1]!.lat, "10% of Frankfurt to Helsinki via Hamburg is still on the road to Hamburg")
})

test("geo: ferry legs follow the sea lane both ways", () => {
  const out = seaLane({ city: "Hamburg", country: "DE" }, { city: "Helsinki", country: "FI" })
  const back = seaLane({ city: "Helsinki", country: "FI" }, { city: "Hamburg", country: "DE" })
  assert.ok(out.length >= 3, "Hamburg to Helsinki has a lane")
  assert.deepEqual(back, [...out].reverse())
  assert.deepEqual(seaLane({ city: "Lyon", country: "FR" }, { city: "Paris", country: "FR" }), [], "no lane on land")
  for (const p of out) assert.ok(inEurope(p))
})

// ---- Fixtures: no database ----

test("fixtures: overview, work lists and case extras follow the contract", async () => {
  const fixtures = await import("./fixtures")
  fixtures.resetFixtures()
  const { PEOPLE } = await import("./fixtures/people")
  const { CASES } = await import("./fixtures/cases")
  for (const person of PEOPLE) {
    const o = fixtures.overview(person.id)
    assertOverview(o, `fixtures overview ${person.id}`)
    const w = fixtures.workLists(person.id)
    assertWork(w, `fixtures work ${person.id}`)
    assert.deepEqual(o.needYou, w.needYou, "the panel and Work show the same Needs you")
    assert.equal(w.needYou.length, fixtures.deskView(person.id).decision ? fixtures.deskView(person.id).queue.length + 1 : 0, `fixtures ${person.id}: Needs you matches the desk`)
  }
  for (const c of CASES) {
    const x = fixtures.caseExtras(c.id)
    assert.ok(x, `extras for ${c.id}`)
    assertExtras(x!, `fixtures ${c.id}`)
  }
  const hero = fixtures.caseExtras("case-420458")!
  assert.deepEqual(hero.why.map((fact) => fact.label), ["Stopped", "Needs", "Yours"])
  assert.equal(hero.situation.waitingOn?.value, "Kovellin, the customer")
})

// ---- Engine: the seeded database ----

let db: typeof import("./db") | null = null
let reachable = false

before(async () => {
  process.env.CR_SCALE = "300"
  db = await import("./db")
  try {
    await Promise.race([db.crDb.execute(sql`select 1 from cr_ops_people limit 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))])
    reachable = true
  } catch {
    reachable = false
  }
})

after(async () => {
  if (db) await db.closeCrDb()
})

test("engine: overview, desk and lead agree on every count (CR_SCALE=300)", async (t) => {
  if (!reachable) return t.skip("database not reachable: docker compose up -d --wait, then db:seed and db:seed:cr")
  const { buildState, getDesk, getLead, getOverview, getWork } = await import("./service")
  const state = await buildState()
  const lead = await getLead(state)
  const realOrders = state.world.orders.length
  assert.equal(state.checks.filter((check) => check.synthetic).length, 300, "CR_SCALE=300 is on")
  for (const person of state.people) {
    const o = (await getOverview(person.id, state))!
    const w = (await getWork(person.id, state))!
    const desk = (await getDesk(person.id, state))!
    assertOverview(o, `overview ${person.id}`)
    assertWork(w, `work ${person.id}`)
    const deskIds = [desk.focus, ...desk.queue].filter((c) => !!c).map((c) => c!.id)
    assert.deepEqual(w.needYou.map((row) => row.caseId), deskIds, `${person.id}: Work Needs you is the desk, in the same order`)
    assert.deepEqual(o.needYou, w.needYou, `${person.id}: the Overview panel and Work agree`)
    assert.equal(o.counts.needsPerson, lead.today.needsPerson, "red cars = lead today.needsPerson")
    assert.equal(o.counts.needsPerson, desk.quiet.needsPerson, "red cars = the desk's quiet line")
    assert.equal(o.counts.agentWorking, lead.today.agentWorking, "agent cars = lead today.agentWorking")
    assert.equal(o.counts.agentWorking, desk.quiet.agentWorking, "agent cars = the desk's quiet line")
    assert.equal(o.counts.handledByAgentToday, lead.today.handledByAgent)
    assert.ok(o.counts.carsToday > 300 && o.counts.carsToday <= realOrders + 300, `cars today: ${o.counts.carsToday}`)
  }
  // Every order with a case waiting for a person is a red dot that opens that case.
  const o = (await getOverview(state.people[0]!.id, state))!
  for (const c of state.cases.filter((candidate) => candidate.status === "waiting_for_person")) {
    const car = o.cars.find((candidate) => candidate.orderId === c.orderId)
    assert.ok(car, `${c.id} is on the map`)
    assert.equal(car!.state, "needs_person")
    assert.equal(car!.caseId, c.id)
    assert.equal(car!.nextAt, c.decideBy)
  }
  // Positions are honest: tracking only where the driver app sent a progress fix.
  for (const car of o.cars.filter((candidate) => candidate.positionSource === "tracking")) {
    const order = state.world.byId.get(car.orderId)!
    assert.equal(order.bundle.order.status, "IN_TRANSIT", `${car.reference} with a tracking position is in transit`)
    assert.ok((order.bundle.related.tracking_observations ?? []).some((row) => row.details.source === "driver_app"), `${car.reference} has a driver-app fix`)
  }
  for (const car of o.cars.filter((candidate) => candidate.positionSource === "at_delivery" && !candidate.orderId.startsWith("scale-"))) {
    assert.equal(state.world.byId.get(car.orderId)!.bundle.order.status, "DELIVERED")
  }
})

test("engine: every case has at most 3 key facts and 5 situation facts, in plain words", async (t) => {
  if (!reachable) return t.skip("database not reachable")
  const { buildState, getCaseDetail } = await import("./service")
  const state = await buildState()
  assert.ok(state.cases.length > 0)
  for (const c of state.cases) {
    const detail = (await getCaseDetail(c.id, state))!
    assert.ok(detail.situation, `${c.id} has a situation`)
    assertExtras({ why: detail.why, situation: detail.situation! }, c.id)
    if (c.status === "waiting_for_person") {
      assert.deepEqual(detail.why.map((fact) => fact.label), ["Stopped", "Needs", "Yours"], `${c.id}: a waiting case says why it came to you`)
    }
  }
})
