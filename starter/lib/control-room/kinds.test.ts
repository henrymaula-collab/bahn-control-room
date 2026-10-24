// One kind detector, one gate (track K): the chat, the card's "Talk it through"
// row, Know-how and History name the same kind and the same "n of 16" for
// every case. Pure tests for the line; with a database, a walk through the two
// demo rounds that compares every surface. Run: npm run test:cr. The database
// test resets the demo state and leaves it reset; it skips on the shared
// "controlroom" database unless CR_TEST_RESET=1, and never runs on cr_v4.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { sql } from "drizzle-orm"
import { knowledgeWords } from "./chat-words"
import { kindOf } from "./kinds"
import { type Answer, evaluateKind, kindLine } from "./trust-gate"
import type { Case } from "./types"

let seq = 0
const answer = (personId: string, optionId: string): Answer => {
  seq++
  return { caseId: `k-${seq}`, personId, optionId, at: new Date(Date.UTC(2026, 8, 1) + seq * 3_600_000).toISOString(), laterChanged: false, onTime: true }
}
const many = (n: number, personId: string, optionId = "pause_gig") => Array.from({ length: n }, () => answer(personId, optionId))

test("kind line: the same words for every stage of the gate", () => {
  assert.equal(kindLine(evaluateKind([]), []), "New kind of case")
  assert.equal(kindLine(evaluateKind(many(1, "p-aino")), ["Aino"]), "Decided once, by Aino")
  assert.equal(kindLine(evaluateKind([...many(1, "p-aino"), ...many(1, "p-sofie")]), ["Aino", "Sofie"]), "2 of 16, 2 people")
  assert.equal(kindLine(evaluateKind(many(3, "p-mikko")), ["Mikko"]), "3 of 16, 1 person", "a count never names a colleague")
  assert.equal(kindLine(evaluateKind([...many(26, "p-jonas"), ...many(3, "p-lea"), ...many(1, "p-emil", "ask_customer")]), ["Jonas", "Lea", "Emil"]), "29 of 30 agree, 3 people")
  assert.equal(kindLine(evaluateKind([...many(6, "p-jonas"), ...many(6, "p-lea", "ask_customer")]), ["Jonas", "Lea"]), "People answer this differently")
})

test("the chat's kind is the loop's kind", async () => {
  const chat = await import("../chat/kind")
  const at = "2026-10-21T07:00:00.000Z"
  const base = {
    id: "c", orderId: "o", desk: "ops-readiness", reasons: [], agentSteps: [], alternatives: [], status: "waiting_for_person", createdAt: at,
    suggestion: { id: "pause_gig", label: "Pause the gig until the pickup place confirms", effect: "", changes: [] },
  } as unknown as Case
  const cases: Case[] = [
    { ...base, type: "readiness.keys_or_access", headline: "Nobody named who hands over the keys.", facts: [] },
    { ...base, type: "readiness.facts_disagree", headline: "The place gives another address.", facts: [{ id: "f", statement: "The gig is posted to drivers.", source: { kind: "record", channel: "record", at }, strength: "confirmed" }] },
    { ...base, type: "readiness.release_document_missing", headline: "The seller has put a hold on the car.", facts: [] },
    // The agent's own summary of another order's hold is not a seller hold here.
    { ...base, type: "readiness.release_document_missing", headline: "Release document missing.", facts: [{ id: "a", statement: "Last week the seller put a hold on another car.", source: { kind: "agent", channel: "record", at }, strength: "stated" }] },
  ]
  assert.deepEqual(cases.map((c) => chat.kindOf(c).key), cases.map((c) => kindOf(c)))
  assert.deepEqual(cases.map((c) => chat.kindOf(c).key), ["keys_or_access", "facts_disagree_open_gig", "seller_hold", "release_document_missing"])
})

// ---- With a database: the two demo rounds, every surface ----------------------

let db: typeof import("./db") | undefined
let canReset = false
let why = ""

before(async () => {
  const name = (process.env.DATABASE_URL ?? "postgres://controlroom:controlroom@localhost:5438/controlroom").split("/").pop()?.split("?")[0]
  if (name === "cr_v4") { why = "cr_v4 is the live demo database: never reset it in a test"; return }
  if (name === "controlroom" && process.env.CR_TEST_RESET !== "1") { why = "the shared controlroom database: set CR_TEST_RESET=1 to reset it"; return }
  db = await import("./db")
  try {
    await Promise.race([db.crDb.execute(sql`select 1 from cr_case_records limit 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))])
    canReset = true
  } catch {
    why = "database not reachable or not pushed (npm run db:push && npm run db:seed && npm run demo:reset)"
  }
})

after(async () => {
  if (db) await db.closeCrDb()
})

/** The openable cases of the demo (person, order). */
const OPENABLE: [string, string][] = [
  ["p-aino", "CD-420593"], ["p-aino", "CD-420458"], ["p-aino", "CD-420516"],
  ["p-sofie", "CD-420531"], ["p-sofie", "CD-420442"], ["p-mikko", "CD-420347"], ["p-jonas", "CD-421056"],
]

/** What every surface says about one case's kind; asserts they agree and returns the one line. */
async function surfaces(person: string, reference: string) {
  const service = await import("./service")
  const { historyRows } = await import("./history")
  const { getThread } = await import("../chat/service")
  const thread = await getThread(reference, person)
  if (!thread.ok) return null
  const state = await service.buildState()
  const caseId = thread.thread.caseId
  const detail = (await service.getCaseDetail(caseId, state))!
  const chat = thread.thread.knowledge
  const knowHow = service.kindsOf(state).find((kind) => kind.kindKey === detail.kind.key)!
  const history = historyRows(state).find((row) => row.caseId === caseId)
  const where = `${reference} for ${person}`
  assert.equal(chat.kindKey, detail.kind.key, `${where}: chat and loop name the same kind`)
  assert.equal(chat.kindLabel, detail.kind.label, where)
  assert.equal(knowHow.label, detail.kind.label, where)
  assert.equal(knowledgeWords(chat), knowledgeWords(detail.knowledge), `${where}: card row and case detail`)
  assert.equal(knowledgeWords(chat), knowHow.line, `${where}: card row and Know-how`)
  if (history) {
    assert.equal(history.kindLabel, detail.kind.label, `${where}: History names the kind`)
    assert.equal(history.countedNow ?? history.counted, knowHow.line.replace(/^Decided once, by \w+$/, "1 of 16"), `${where}: History counts the same`)
  }
  return { line: knowledgeWords(chat), opener: thread.thread.opener.text, history: history?.counted, decided: chat.decided }
}

test("one detector: chat, card row, Know-how and History agree through both demo rounds", async (t) => {
  if (!canReset) return t.skip(why)
  const { demoReset } = await import("../../scripts/lib/demo-reset")
  const { DEMO } = await import("../demo/scenario")
  const { memoryStore, setChatStore } = await import("../chat/store")
  const service = await import("./service")
  setChatStore(memoryStore)
  try {
    await demoReset()
    const at = async () => Object.fromEntries(await Promise.all(OPENABLE.map(async ([p, ref]) => [ref, await surfaces(p, ref)] as const)))

    const reset = await at()
    assert.equal(reset["CD-420458"]?.line, "New kind of case")
    assert.match(reset["CD-420458"]!.opener, /has not happened before/)
    assert.equal(reset["CD-420442"], null, "round 2 is not shown before round 1")
    assert.equal(reset["CD-420347"]?.line, "29 of 30 agree, 4 people")
    assert.match(reset["CD-420347"]!.opener, /29 of 30 earlier cases/)

    // Round 1: Aino keeps the gig unpublished and waits.
    const r1 = await service.decide({ caseId: DEMO.round1.caseId, personId: DEMO.round1.personId, optionId: "pause_gig", why: "The customer already knows and is chasing the seller." })
    assert.ok(!("error" in r1))
    const one = await at()
    assert.equal(one["CD-420442"]?.line, "Decided once, by Aino")
    assert.match(one["CD-420442"]!.opener, /happened once before\. Aino decided it/)
    assert.equal(one["CD-420458"]?.history, "1 of 16")

    // Round 2: Sofie decides the same way: 2 of 16, 2 people, everywhere.
    const r2 = await service.decide({ caseId: DEMO.round2.caseId, personId: DEMO.round2.personId, optionId: "pause_gig", why: "Same as Aino on the Ferrari." })
    assert.ok(!("error" in r2))
    const two = await at()
    assert.equal(two["CD-420442"]?.line, "2 of 16, 2 people")
    assert.equal(two["CD-420442"]?.history, "2 of 16, 2 people")
    assert.equal(two["CD-420458"]?.line, "2 of 16, 2 people")
    assert.equal(two["CD-420442"]?.decided, 1, "the case does not count toward itself in the earlier cases")
  } finally {
    setChatStore(undefined)
    await demoReset()
  }
})
