// Tests for v4 live wiring: why a red car is red (MapCar.reason), the line under the
// primary button (CaseV3Extras.next), the decision on a decided case, the one v3 client's
// fixture side, and the rename of Work to Your tasks.
// Run: npm run test:cr. The engine tests read the seeded database and skip, with a
// message, when it is not reachable (as in v3.test.ts).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { sql } from "drizzle-orm"
import type { Case } from "./types"
import { nextLine } from "./v3"

const RAW = /\b[A-Z]{2,}(?:_[A-Z]+)+\b|\b[a-z]+(?:_[a-z]+)+\b|\breadiness\.|\bundefined\b|\bnull\b|\bNaN\b/
const words = (text: string) => text.trim().split(/\s+/).length

function assertReason(reason: string | undefined, where: string) {
  assert.ok(reason && reason.trim(), `${where}: a red car says why`)
  assert.ok(!RAW.test(reason!), `${where}: "${reason}" shows a raw enum`)
  assert.ok(words(reason!) <= 6, `${where}: "${reason}" is longer than 6 words`)
  assert.ok(!/[.:·]$/.test(reason!) && !reason!.includes("·"), `${where}: "${reason}" reads as a sentence or uses a dot`)
  assert.equal(reason![0], reason![0]!.toUpperCase(), `${where}: "${reason}" starts with a capital`)
}

function assertNext(line: string, where: string) {
  assert.ok(/\bthe agent\b/i.test(line), `${where}: "${line}" says what the agent does`)
  assert.ok(!/^(A person|You)\b/.test(line), `${where}: "${line}" repeats the person's own step`)
  assert.ok(/[.!?]$/.test(line), `${where}: "${line}" ends as a sentence`)
  assert.ok(!RAW.test(line), `${where}: "${line}" shows a raw enum`)
}

// ---- The line under the button: pure ----

const option = (effect: string) => ({ id: "o", label: "Send the email", effect, changes: [] })
const waiting = (effect: string) => ({ status: "waiting_for_person" as const, suggestion: option(effect) })

test("next line: only the agent's part of the effect, never the person's own step", () => {
  assert.equal(
    nextLine(waiting("A person sends the message to the customer. The agent then calls the pickup place back on Thursday to confirm the release arrived, and no driver is booked until it has.")),
    "The agent then calls the pickup place back on Thursday to confirm the release arrived, and no driver is booked until it has.",
  )
  assert.equal(
    nextLine(waiting("The driver leaves and is paid for the empty pickup; the agent drafts a question to the customer about where the car is.")),
    "The agent drafts a question to the customer about where the car is.",
  )
  assert.equal(
    nextLine(waiting("The agent sends the email and keeps the pickup unbooked. When the release arrives, it checks it with Calverona before any driver is booked.")),
    "When the release arrives, the agent checks it with Calverona before any driver is booked.",
    "after the button's own action, with it read as the agent",
  )
  assert.equal(
    nextLine(waiting("The agent sends the reply and calls Mervikko again at 13:00. If nobody answers by 14:00, this comes back to you.")),
    "The agent sends the reply and calls Mervikko again at 13:00.",
    "the opening sentence when it is the only agent step",
  )
  assert.equal(nextLine(waiting("You call them and note what they say.")), undefined, "no agent step, no line")
  assert.equal(nextLine({ ...waiting("A person sends it. The agent checks again at 10:00."), status: "done" }), undefined, "nobody is asked any more")
})

// ---- Fixtures: the one v3 client's fixture side ----

test("fixtures: red cars say why, waiting cases carry the line, long lists open the original case", async () => {
  const fixtures = await import("./fixtures")
  fixtures.resetFixtures()
  const o = fixtures.overview("aino")
  const red = o.cars.filter((car) => car.state === "needs_person")
  assert.ok(red.length > 0)
  for (const car of red) assertReason(car.reason, `fixture ${car.reference}`)
  for (const car of o.cars.filter((candidate) => candidate.state !== "needs_person")) assert.equal(car.reason, undefined, `${car.reference} is not red`)
  const { CASES } = await import("./fixtures/cases")
  for (const c of CASES.filter((candidate) => candidate.status === "waiting_for_person")) {
    const next = fixtures.caseExtras(c.id)?.next
    if (next) assertNext(next, `fixture ${c.id}`)
  }
  assert.ok(fixtures.caseExtras("case-420458")?.next, "the hero case has its line under the button")
  const long = fixtures.workLists("aino", { extraRows: 40 })
  assert.equal(long.needYou.length, fixtures.workLists("aino").needYou.length + 40)
  for (const row of long.needYou) assert.ok(fixtures.caseExtras(fixtures.baseCaseId(row.caseId)), `${row.caseId} opens its original case`)
})

// ---- The rename: Work is Your tasks ----

test("rename: the menu says Your tasks at /tasks, and /work still lands there", () => {
  const root = join(__dirname, "..", "..")
  const shell = readFileSync(join(root, "app/(control-room)/_ui/shell.tsx"), "utf8")
  assert.match(shell, /href: "\/tasks", label: "Your tasks"/)
  assert.doesNotMatch(shell, /label: "Work"/)
  const config = readFileSync(join(root, "next.config.ts"), "utf8")
  assert.match(config, /source: "\/work", destination: "\/tasks"/)
  assert.match(config, /source: "\/work\/:caseId", destination: "\/tasks\/:caseId"/)
  for (const file of ["_ui/overview-view.tsx", "_ui/question.tsx", "not-found.tsx", "tasks/page.tsx", "tasks/[caseId]/page.tsx"]) {
    const text = readFileSync(join(root, "app/(control-room)", file), "utf8")
    assert.doesNotMatch(text, /"\/work|`\/work|\bin Work\b|to Work\b|title: "Work"/, `${file} still says Work`)
  }
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

test("engine: every red car says why in a few plain words; other cars say nothing", async (t) => {
  if (!reachable) return t.skip("database not reachable: docker compose up -d --wait, then db:seed and db:seed:cr")
  const { buildState, getOverview } = await import("./service")
  const state = await buildState()
  const o = (await getOverview(state.people[0]!.id, state))!
  const red = o.cars.filter((car) => car.state === "needs_person")
  assert.ok(red.length > 0)
  for (const car of red) assertReason(car.reason, car.reference)
  for (const car of o.cars.filter((candidate) => candidate.state !== "needs_person")) assert.equal(car.reason, undefined, `${car.reference} is not red`)
  // A red car without a case is the one that needs it: its reason comes from the order check, not a fallback.
  const uncased = red.filter((car) => !car.caseId)
  assert.ok(uncased.length > 0)
  assert.ok(uncased.every((car) => car.reason !== "Needs a person"), `every uncased red car has a real reason: ${uncased.filter((car) => car.reason === "Needs a person").map((car) => car.reference).join(", ")}`)
})

test("engine: a waiting case's line under the button says what the agent does next", async (t) => {
  if (!reachable) return t.skip("database not reachable")
  const { buildState, getCaseDetail } = await import("./service")
  const state = await buildState()
  for (const c of state.cases) {
    const detail = (await getCaseDetail(c.id, state))!
    if (c.status !== "waiting_for_person") assert.equal(detail.next, undefined, `${c.id} is not waiting: no line`)
    else if (detail.next) assertNext(detail.next, c.id)
  }
})

test("engine: a decided case returns the person's decision; an open case returns none", async (t) => {
  if (!reachable) return t.skip("database not reachable")
  const { buildState, getCaseDetail } = await import("./service")
  const state = await buildState()
  const open = state.cases.find((c) => c.status === "waiting_for_person")!
  assert.equal((await getCaseDetail(open.id, state))!.decision, null)
  // In memory only: mark that case decided by Aino; nothing is written.
  const at = state.now
  const decided: Case = { ...open, status: "done" }
  const person = state.people.find((p) => p.id === "p-aino") ?? state.people[0]!
  const data = { id: "dec-test", caseId: open.id, personId: person.id, optionId: open.suggestion.id, at }
  const local = {
    ...state,
    cases: state.cases.map((c) => (c.id === open.id ? decided : c)),
    decisions: [...state.decisions, { ...data, caseType: open.type, placeId: null, customerId: null, country: null, tookSuggestion: true, laterChanged: false, onTime: true, synthetic: false, data }],
  }
  const detail = (await getCaseDetail(open.id, local))!
  assert.equal(detail.decision?.personId, person.id)
  assert.equal(detail.decision?.optionId, open.suggestion.id)
  assert.equal(detail.next, undefined, "a done case has no line under the button")
})

test("engine: no derived case waiting for a person was due before now", async (t) => {
  if (!reachable) return t.skip("database not reachable")
  const { buildState } = await import("./service")
  const state = await buildState()
  const waiting = state.cases.filter((c) => c.status === "waiting_for_person" && state.derivedIds.has(c.id) && c.decideBy)
  assert.ok(waiting.length > 0)
  for (const c of waiting) assert.ok(c.decideBy! > state.now, `${c.id} was due at ${c.decideBy}, before ${state.now}`)
})
