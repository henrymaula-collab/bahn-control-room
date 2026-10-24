// Unit tests for routing. Run: npm run test:cr
import assert from "node:assert/strict"
import { test } from "node:test"
import { type HistoryRow, type RouteInput, bucket, nextShiftStart, routeCase } from "./routing"
import type { OpsPerson } from "./types"

const NOW = "2026-10-21T09:00:00.000Z" // Wed 12:00 Helsinki

const person = (id: string, name: string, languages: string[], onShift = true, role: OpsPerson["role"] = "ops", desks = ["ops-readiness"]): OpsPerson =>
  ({ id, name, role, desks, languages, onShift })

const aino = person("p-aino", "Aino", ["fi", "en"])
const jonas = person("p-jonas", "Jonas", ["de", "en"])
const emil = person("p-emil", "Emil", ["da", "de", "en"])
const lead = person("p-kaisa", "Kaisa", ["fi", "en"], true, "shift_lead", ["ops-shift", "ops-readiness"])

const rows = (personId: string, n: number, extra: Partial<HistoryRow> = {}): HistoryRow[] =>
  Array.from({ length: n }, (_, i) => ({ personId, caseType: "readiness.car_not_ready", placeId: "site-001", country: "FI", laterChanged: false, at: `2026-08-${String(10 + (i % 20)).padStart(2, "0")}T08:00:00.000Z`, ...extra }))

// A case id whose bucket is above the learning share, so tests of best_record are not sent to learn.
const steadyId = (() => { for (let i = 0; ; i++) if (bucket(`case-${i}`) >= 50) return `case-${i}` })()
const learnId = (() => { for (let i = 0; ; i++) if (bucket(`case-${i}`) < 15) return `case-${i}` })()

test("prefers the count at this pickup place and says it as a count", () => {
  const r = routeCase({
    caseId: steadyId, type: "readiness.car_not_ready", desk: "ops-readiness", placeId: "site-001", placeName: "Velantora Helsinki", country: "FI",
    people: [aino, jonas, emil], history: [...rows("p-aino", 6), ...rows("p-jonas", 9, { placeId: "site-099" })], now: NOW,
  })
  assert.equal(r.personId, "p-aino")
  assert.equal(r.mode, "best_record")
  assert.equal(r.why, "Sent to you because you have handled 6 cars that were not ready at Velantora Helsinki since August.")
})

test("later-changed decisions do not count", () => {
  const r = routeCase({
    caseId: steadyId, type: "readiness.car_not_ready", desk: "ops-readiness", placeId: "site-001", placeName: "Velantora Helsinki", country: "FI",
    people: [aino, jonas, emil], history: [...rows("p-aino", 4, { laterChanged: true }), ...rows("p-aino", 1), ...rows("p-jonas", 3)], now: NOW,
  })
  assert.equal(r.personId, "p-jonas")
  assert.match(r.why, /handled 3 cars/)
})

test("falls back to the country and names the language", () => {
  const r = routeCase({
    caseId: steadyId, type: "readiness.release_document_missing", desk: "ops-readiness", placeId: "site-042", placeName: "Calverona Hamburg", country: "DE",
    people: [aino, jonas, emil], history: rows("p-jonas", 5, { caseType: "readiness.release_document_missing", placeId: "site-030", country: "DE" }), now: NOW,
  })
  assert.equal(r.personId, "p-jonas")
  assert.equal(r.why, "Sent to you because you have handled 5 missing release documents in Germany since August, and you speak German.")
})

test("language decides when nobody has a record", () => {
  const r = routeCase({ caseId: steadyId, type: "readiness.no_answer", desk: "ops-readiness", placeId: "site-x", placeName: "Somewhere", country: "DK", people: [aino, jonas, emil], history: [], now: NOW })
  assert.equal(r.personId, "p-emil")
  assert.equal(r.why, "Sent to you because you speak Danish, the language of the pickup place.")
})

test("a share of cases goes to someone learning, and names who can help", () => {
  const r = routeCase({
    caseId: learnId, type: "readiness.car_not_ready", desk: "ops-readiness", placeId: "site-001", placeName: "Velantora Helsinki", country: "FI",
    people: [aino, jonas, emil], history: [...rows("p-aino", 12), ...rows("p-jonas", 4), ...rows("p-emil", 1)], now: NOW,
  })
  assert.equal(r.mode, "learning")
  assert.equal(r.personId, "p-emil")
  assert.equal(r.why, "Sent to you to learn: you have handled 1 car that was not ready so far. Aino has handled 12 and is on shift.")
})

test("only one on shift", () => {
  const r = routeCase({ caseId: steadyId, type: "readiness.no_answer", desk: "ops-readiness", people: [aino, { ...jonas, onShift: false }, lead], history: [], now: NOW })
  assert.equal(r.mode, "only_one_on_shift")
  assert.equal(r.personId, "p-aino")
  assert.equal(r.why, "Sent to you because you are the only one on the Readiness desk on shift.")
})

test("the shift lead takes it when no one else on the desk is on shift", () => {
  const r = routeCase({ caseId: steadyId, type: "readiness.no_answer", desk: "ops-readiness", people: [{ ...aino, onShift: false }, lead], history: [], now: NOW })
  assert.equal(r.personId, "p-kaisa")
})

test("nobody on shift with the desk: it waits for the next shift with a promise time", () => {
  const friday = "2026-10-23T16:00:00.000Z" // Fri 19:00 Helsinki
  const r = routeCase({
    caseId: steadyId, type: "readiness.car_not_ready", desk: "ops-readiness", people: [{ ...aino, onShift: false }, { ...jonas, onShift: false }],
    history: rows("p-jonas", 3), now: friday,
  })
  assert.equal(r.mode, "monday_queue")
  assert.equal(r.personId, "p-jonas")
  assert.equal(r.at, "2026-10-26T06:00:00.000Z") // Mon 08:00 Helsinki, after summer time ends on 25 Oct
  assert.equal(r.why, "Nobody on the Readiness desk is on shift. It waits for Monday 08:00, when Jonas is back.")
})

test("next shift start skips the weekend and respects summer time", () => {
  assert.deepEqual(nextShiftStart("2026-10-21T09:00:00.000Z"), { at: "2026-10-22T05:00:00.000Z", dayName: "Thursday" })
  assert.deepEqual(nextShiftStart("2026-10-24T09:00:00.000Z"), { at: "2026-10-26T06:00:00.000Z", dayName: "Monday" })
})

test("routing is deterministic", () => {
  const input: RouteInput = { caseId: "case-ord-00516-facts_disagree", type: "readiness.facts_disagree", desk: "ops-readiness", people: [aino, jonas, emil], history: rows("p-aino", 3), now: NOW }
  assert.deepEqual(routeCase(input), routeCase(input))
})
