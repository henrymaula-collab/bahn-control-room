// Tests for the v4 learning loop: the gate maths, disagreement, weights, kinds
// read from properties, kind-level rules, and (with a database) one case record
// per decision with its weight, the two-round demo and an idempotent demo:reset.
// Run: npm run test:cr. The database tests reset the demo state and leave it
// reset; they skip on the shared "controlroom" database unless CR_TEST_RESET=1.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { sql } from "drizzle-orm"
import { kindOf } from "./kinds"
import { ruleFor } from "./learning"
import { kindRules, knowledgeFor, type LoopInput } from "./loop"
import type { DecisionRecord } from "./store"
import { type Answer, GATE_FLOOR, GATE_N, evaluateKind, moreNeeded, onePerCase, personWeight, wilsonLower } from "./trust-gate"
import type { Case, Fact, Option } from "./types"

const close = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps

// ---- Gate maths --------------------------------------------------------------

test("gate: Wilson lower bounds match research/angle/C-lever.md", () => {
  assert.ok(close(wilsonLower(5, 5), 0.566), `5/5 -> ${wilsonLower(5, 5)}`)
  assert.ok(close(wilsonLower(13, 14), 0.685), `13/14 -> ${wilsonLower(13, 14)}`)
  assert.ok(close(wilsonLower(16, 16), 0.806), `16/16 -> ${wilsonLower(16, 16)}`)
  assert.ok(close(wilsonLower(35, 35), 0.901), `35/35 -> ${wilsonLower(35, 35)}`)
  assert.equal(GATE_N, 16)
  assert.ok(GATE_FLOOR > 0.8 && GATE_FLOOR < 0.81, "N = 16 is about a 0.8 lower bound")
  assert.equal(wilsonLower(0, 0), 0)
})

let seq = 0
const answer = (personId: string, optionId: string, extra: Partial<Answer> = {}): Answer => {
  seq++
  return { caseId: `c-${seq}`, personId, optionId, at: new Date(Date.UTC(2026, 7, 1) + seq * 3_600_000).toISOString(), laterChanged: false, onTime: true, ...extra }
}
const many = (count: number, personId: string, optionId: string, extra: Partial<Answer> = {}) => Array.from({ length: count }, () => answer(personId, optionId, extra))

test("gate: a new kind needs 16; each clean agreeing answer is one step", () => {
  const none = evaluateKind([])
  assert.equal(none.status, "new")
  assert.equal(none.needed, 16)
  const one = evaluateKind([answer("p-a", "pause")])
  assert.equal(one.status, "learning")
  assert.equal(`${one.agreeing} of ${one.needed}`, "1 of 16")
  const two = evaluateKind([answer("p-a", "pause"), answer("p-b", "pause")])
  assert.equal(`${two.agreeing} of ${two.needed}`, "2 of 16")
  assert.equal(two.people, 2)
})

test("gate: 16 agreeing answers from more than one person pass; 15 do not; one person never does", () => {
  const sixteen = evaluateKind([...many(8, "p-a", "pause"), ...many(8, "p-b", "pause")])
  assert.equal(sixteen.status, "ready")
  assert.ok(sixteen.lowerBound >= GATE_FLOOR - 1e-9)
  assert.equal(sixteen.needed, 16)
  const fifteen = evaluateKind([...many(8, "p-a", "pause"), ...many(7, "p-b", "pause")])
  assert.equal(fifteen.status, "learning")
  assert.equal(fifteen.needed, 16)
  const alone = evaluateKind(many(20, "p-a", "pause"))
  assert.equal(alone.status, "learning", "a lone expert never earns a rule alone")
  assert.equal(alone.needed, 21, "one more answer, from someone else")
})

test("gate: the old 5-at-90% gate is gone (5 of 5 passes nothing)", () => {
  const five = evaluateKind([...many(3, "p-a", "pause"), ...many(2, "p-b", "pause")])
  assert.equal(five.status, "learning")
  assert.equal(five.needed, 16)
})

test("gate: one dissent needs about 28 of 30 instead of 16 in a row", () => {
  const g = evaluateKind([...many(14, "p-a", "pause"), ...many(14, "p-b", "pause"), answer("p-c", "follow")])
  assert.equal(g.status, "ready", `28 of 29: bound ${g.lowerBound}`)
  const short = evaluateKind([...many(10, "p-a", "pause"), ...many(10, "p-b", "pause"), answer("p-c", "follow")])
  assert.equal(short.status, "learning", "20 of 21 is not enough")
  assert.ok(short.needed > 21, `needed ${short.needed}`)
})

test("gate: disagreement blocks the proposal and says people answer this differently", () => {
  const split = evaluateKind([...many(30, "p-a", "pause"), ...many(20, "p-b", "follow")])
  assert.equal(split.status, "differ")
  assert.equal(split.line, "People answer this differently")
  const pair = evaluateKind([answer("p-a", "pause"), answer("p-b", "follow")])
  assert.equal(pair.status, "differ")
  // However many answers come in, a 70/30 split never becomes a proposal.
  const big = evaluateKind([...many(140, "p-a", "pause"), ...many(60, "p-b", "follow")])
  assert.equal(big.status, "differ")
  const input = loopFrom([...many(140, "p-a", "pause_gig"), ...many(60, "p-b", "follow_pickup_place")], "facts_disagree_open_gig")
  assert.equal(kindRules(input, []).rules.length, 0, "no proposal while people disagree")
})

test("gate: weight is the person's record on this kind, never tenure", () => {
  assert.equal(personWeight({ decided: 0, held: 0 }), 1)
  assert.ok(close(personWeight({ decided: 10, held: 9 }), 0.909))
  assert.ok(close(personWeight({ decided: 6, held: 3 }), 0.571))
  // 16 agreeing answers whose people had decisions changed later count for less: more are needed.
  const shaky = evaluateKind([...many(4, "p-a", "pause", { laterChanged: true }), ...many(12, "p-b", "pause")])
  assert.ok(shaky.weights["p-a"]! < 0.3, `p-a weight ${shaky.weights["p-a"]}`)
  assert.equal(shaky.weights["p-b"], 1)
  assert.equal(shaky.status, "learning")
  assert.ok(shaky.needed > 16, `needed ${shaky.needed}`)
  // A missed promise after the decision counts against the record too.
  assert.ok(evaluateKind(many(3, "p-a", "pause", { onTime: false })).weights["p-a"]! < 1)
  assert.equal(moreNeeded(0, 0), 16)
})

test("gate: a case decided twice (the choice, then the why) is one answer", () => {
  const first = answer("p-a", "pause")
  const again = { ...first, at: new Date(Date.parse(first.at) + 60_000).toISOString() }
  assert.equal(onePerCase([first, again]).length, 1)
  assert.equal(evaluateKind([first, again]).decided, 1)
})

// ---- Kinds are properties --------------------------------------------------------

const fact = (statement: string, kind: Fact["source"]["kind"] = "pickup_place"): Fact => ({
  id: `f-${statement.length}`, statement, source: { kind, at: "2026-10-21T08:00:00Z" }, strength: "stated",
})
const option = (id: string, changes: Option["changes"] = [{ kind: "none", detail: "Nothing changes" }]): Option => ({ id, label: id, effect: "", changes })
const caseOf = (over: Partial<Case>): Case => ({
  id: "case-x", orderId: "o-x", desk: "ops-readiness", type: "readiness.release_document_missing", headline: "Something is wrong.",
  reasons: [], facts: [], agentSteps: [], suggestion: option("pause_gig"), alternatives: [], status: "waiting_for_person", createdAt: "2026-10-21T09:00:00Z",
  ...over,
})

test("kinds: a seller hold is the same kind at any pickup place and under any case type", () => {
  const hamburg = caseOf({ placeId: "site-hh", facts: [fact("The seller has put a hold on the Ferrari because of an open invoice.")] })
  const stockholm = caseOf({ placeId: "site-st", type: "readiness.keys_or_access", facts: [fact("The Bentley is ready, but as the seller we have put a hold on it.")] })
  const branch = caseOf({ placeId: "site-x", facts: [fact("The seller has withdrawn permission to hand it over while the invoice remains unsettled.")] })
  assert.equal(kindOf(hamburg), "seller_hold")
  assert.equal(kindOf(stockholm), "seller_hold")
  assert.equal(kindOf(branch), "seller_hold")
  // A lesson or the agent's own summary that mentions a hold elsewhere does not make a case a seller hold.
  const lessonOnly = caseOf({ facts: [fact("Learned from Aino's decision: the branch won't hand over a car under a seller hold.", "person")] })
  assert.equal(kindOf(lessonOnly), "release_document_missing")
  // Private sellers and key holders are not holds.
  assert.equal(kindOf(caseOf({ facts: [fact("Arrange a named seller handover at the door; ask the key holder.")] })), "release_document_missing")
})

test("kinds: details that disagree split on whether the gig is posted, not on the place", () => {
  const posted = caseOf({ type: "readiness.facts_disagree", placeId: "site-a", facts: [fact("The gig is published at EUR 456 and no driver has taken it.", "record")] })
  const postedElsewhere = { ...posted, placeId: "site-b" }
  const byOption = caseOf({ type: "readiness.facts_disagree", suggestion: option("pause_gig", [{ kind: "booking", detail: "The published gig (EUR 456) is paused" }]) })
  const quiet = caseOf({ type: "readiness.facts_disagree", facts: [fact("Keep the gig unpublished until the branch confirms.", "agent")] })
  assert.equal(kindOf(posted), "facts_disagree_open_gig")
  assert.equal(kindOf(postedElsewhere), kindOf(posted))
  assert.equal(kindOf(byOption), "facts_disagree_open_gig")
  assert.equal(kindOf(quiet), "facts_disagree")
  assert.equal(kindOf(caseOf({ type: "readiness.no_answer" })), "no_answer")
})

// ---- Kind-level rules ----------------------------------------------------------

function loopFrom(answers: Answer[], kindKey: string, cases: Case[] = []): LoopInput {
  const decisions: DecisionRecord[] = answers.map((a) => ({
    id: `d-${a.caseId}`, caseId: a.caseId, personId: a.personId, optionId: a.optionId, caseType: "readiness.facts_disagree", placeId: `site-${a.caseId}`,
    customerId: null, country: null, tookSuggestion: true, laterChanged: a.laterChanged, onTime: a.onTime, synthetic: true, at: a.at,
    data: { id: `d-${a.caseId}`, caseId: a.caseId, personId: a.personId, optionId: a.optionId, at: a.at },
  }))
  const records = answers.map((a) => ({
    id: `rec-${a.caseId}`, caseId: a.caseId, decisionId: `d-${a.caseId}`, kindKey, kindLabel: kindKey,
    situation: { headline: "", facts: [], suggestion: { id: a.optionId, label: a.optionId }, alternatives: [] },
    choice: { optionId: a.optionId, label: a.optionId, tookSuggestion: true },
    decidedBy: { personId: a.personId, name: a.personId }, weight: { value: 1, decided: 0, held: 0 }, at: a.at, synthetic: true,
  }))
  return { decisions, records, cases, people: [] }
}

test("rules: a kind that passes gets one place-free proposal; it fires at a place nobody decided", () => {
  const input = loopFrom([...many(9, "p-a", "pause_gig"), ...many(8, "p-b", "pause_gig")], "facts_disagree_open_gig")
  const { rules } = kindRules(input, [])
  assert.equal(rules.length, 1)
  const rule = rules[0]!
  assert.equal(rule.status, "suggested")
  assert.deepEqual(rule.scope, {}, "no pickup place in the rule")
  assert.equal(rule.kindKey, "facts_disagree_open_gig")
  assert.equal(rule.evidence.matched, 17)
  const newPlace = caseOf({
    type: "readiness.facts_disagree", placeId: "site-never-seen", facts: [fact("The gig is published at EUR 300.", "record")],
    suggestion: option("pause_gig", [{ kind: "booking", detail: "The published gig is paused" }]),
  })
  assert.equal(ruleFor(newPlace, rules), null, "a suggestion is not a rule until a shift lead turns it on")
  assert.equal(ruleFor(newPlace, [{ ...rule, status: "on" }])?.id, rule.id)
  assert.equal(ruleFor({ ...newPlace, facts: [] , suggestion: option("pause_gig") }, [{ ...rule, status: "on" }]), null, "another kind does not match")
})

test("rules: an answer that messages the customer never becomes a rule", () => {
  const input = loopFrom([...many(10, "p-a", "ask_customer"), ...many(10, "p-b", "ask_customer")], "facts_disagree")
  assert.equal(kindRules(input, []).rules.length, 0)
  const withMessage = caseOf({ type: "readiness.facts_disagree", suggestion: option("ask_customer", [{ kind: "customer_message", detail: "Question to the customer" }]) })
  assert.equal(ruleFor(withMessage, [{ id: "r", caseType: "readiness.facts_disagree", scope: {}, when: "", then: "", evidence: { matched: 0, total: 0, caseIds: [] }, status: "on", optionId: "ask_customer", kindKey: "facts_disagree" }]), null)
})

test("rules: a proposal whose kind starts to disagree is withdrawn; a rule a person turned on stays, marked blocked", () => {
  const agreeing = [...many(9, "p-a", "pause_gig"), ...many(8, "p-b", "pause_gig")]
  const proposed = kindRules(loopFrom(agreeing, "facts_disagree_open_gig"), []).rules
  const split = loopFrom([...agreeing, ...many(10, "p-c", "follow_pickup_place")], "facts_disagree_open_gig")
  const after1 = kindRules(split, proposed)
  assert.deepEqual(after1.drop, [proposed[0]!.id])
  assert.equal(after1.rules.length, 0)
  const after2 = kindRules(split, [{ ...proposed[0]!, status: "on", changedBy: "p-kaisa" }])
  assert.equal(after2.rules[0]?.status, "on")
  assert.equal(after2.rules[0]?.gate?.blocked, true)
  // Place-level proposals from the old gate are withdrawn.
  const legacy = { id: "rule-old", caseType: "readiness.facts_disagree", scope: { placeId: "site-1" }, when: "", then: "", evidence: { matched: 13, total: 14, caseIds: [] }, status: "suggested" as const, optionId: "pause_gig" }
  assert.ok(kindRules(loopFrom([], "x"), [legacy]).drop.includes("rule-old"))
})

test("knowledge: a case never counts toward itself", () => {
  const c = caseOf({ id: "c-self", facts: [fact("The seller has put a hold on the car.")] })
  const input = loopFrom([{ caseId: "c-self", personId: "p-a", optionId: "pause_gig", at: "2026-10-21T09:00:00Z", laterChanged: false, onTime: true }], "seller_hold", [c])
  const k = knowledgeFor(input, c)
  assert.equal(k.novelty, "new")
  assert.equal(k.decided, 0)
  assert.equal(k.needed, 16)
})

// ---- With the database: the demo, records, weights, reset ------------------------

let db: typeof import("./db") | null = null
let canReset = false
let why = ""

before(async () => {
  const url = process.env.DATABASE_URL ?? ""
  const name = (() => { try { return new URL(url).pathname.slice(1) } catch { return "" } })()
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

async function snapshot() {
  const { crDb } = await import("./db")
  const q = async (text: string) => JSON.stringify(await crDb.execute(sql.raw(text)))
  return {
    people: await q("select id, on_shift from cr_ops_people order by id"),
    decisions: await q("select id, case_id, person_id, option_id, later_changed, on_time, synthetic, at from cr_decisions order by id"),
    records: await q("select id, kind_key, person_id, option_id, data from cr_case_records order by id"),
    cases: await q("select id, status, routed_to, case_type, source, data from cr_cases order by id"),
    lessons: await q("select id, status, data from cr_lessons order by id"),
    rules: await q("select id, status, option_id, data from cr_trust_rules order by id"),
    calls: await q("select id, case_id from cr_calls order by id"),
    runs: await q("select id, case_id, step_count from cr_agent_runs order by id"),
  }
}

test("demo:reset is idempotent", async (t) => {
  if (!canReset) return t.skip(why)
  const { demoReset } = await import("../../scripts/lib/demo-reset")
  await demoReset()
  const first = await snapshot()
  await demoReset()
  const second = await snapshot()
  for (const key of Object.keys(first) as (keyof typeof first)[]) assert.equal(second[key], first[key], `${key} differs between two resets`)
})

test("demo: decision -> one case record with weight; round 2 appears; 1 then 2 of 16; the fast-forward", async (t) => {
  if (!canReset) return t.skip(why)
  const { demoReset } = await import("../../scripts/lib/demo-reset")
  const { DEMO } = await import("../demo/scenario")
  const service = await import("./service")
  const reset = await demoReset()
  assert.equal(reset.round1.status, "waiting_for_person")
  assert.equal(reset.round1.routedTo, DEMO.round1.personId)
  assert.equal(reset.round2.visible, false, "round 2 waits for round 1")
  assert.equal(reset.fastForward.ruleStatus, "suggested", "the proposal is not on yet")
  assert.equal(reset.fastForward.status, "waiting_for_person")

  let state = await service.buildState()
  assert.equal(state.decisions.filter((row) => !row.synthetic).length, 0, "no live decisions after reset")
  assert.ok(!state.lessons.some((lesson) => lesson.text.includes("seller hold")), "no lesson from round 1 before it is decided")
  const before1 = (await service.getCaseKnowledge(DEMO.round1.caseId, state))!
  assert.equal(before1.kindKey, DEMO.kind)
  assert.equal(before1.novelty, "new")
  assert.equal(before1.needed, 16)

  // Round 1: the choice, then the why, as the UI posts them.
  const opened = new Date(Date.now() - 9 * 60_000).toISOString()
  const first = await service.decide({ caseId: DEMO.round1.caseId, personId: DEMO.round1.personId, optionId: "pause_gig", openedAt: opened })
  assert.ok(!("error" in first))
  const second = await service.decide({ caseId: DEMO.round1.caseId, personId: DEMO.round1.personId, optionId: "pause_gig", why: "The customer already knows; keep the car off the market." })
  assert.ok(!("error" in second))
  if ("error" in first || "error" in second) return
  assert.equal(second.decision.id, first.decision.id, "the why updates the same decision")
  const record = second.record
  assert.equal(record.kindKey, DEMO.kind)
  assert.equal(record.decidedBy.personId, DEMO.round1.personId)
  assert.equal(record.reason, "The customer already knows; keep the car off the market.")
  assert.deepEqual(record.weight, { value: 1, decided: 0, held: 0 }, "a first answer on a new kind counts fully")
  assert.ok(record.minutes && record.minutes >= 8 && record.minutes <= 10, `minutes ${record.minutes}`)
  assert.ok(record.situation.facts.length > 0 && record.situation.suggestion.id)
  state = await service.buildState()
  assert.equal(state.decisions.filter((row) => !row.synthetic).length, 1)
  assert.equal(state.records.filter((row) => !row.synthetic).length, 1)

  // Round 2 shows, for Sofie, and the agent now suggests what Aino chose.
  const round2 = state.cases.find((c) => c.id === DEMO.round2.caseId)
  assert.ok(round2, "round 2 appears once round 1 is decided")
  assert.equal(round2!.routedTo?.personId, DEMO.round2.personId)
  assert.equal(round2!.suggestion.id, "pause_gig")
  assert.notEqual(round2!.placeId, state.cases.find((c) => c.id === DEMO.round1.caseId)!.placeId, "another pickup place")
  const k2 = (await service.getCaseKnowledge(DEMO.round2.caseId, state))!
  assert.equal(k2.kindKey, DEMO.kind)
  assert.equal(`${k2.decided} decided, ${k2.sameAsSuggestion} of ${k2.needed}`, "1 decided, 1 of 16")
  assert.equal(k2.precedents[0]?.decidedBy, "Aino")
  assert.equal(k2.precedents[0]?.why, "The customer already knows; keep the car off the market.")
  const work = (await service.getWork(DEMO.round2.personId, state))!
  assert.ok(work.needYou.some((row) => row.caseId === DEMO.round2.caseId), "in Sofie's tasks")

  // Round 2 decided the same way: 2 of 16, 2 people.
  const r2 = await service.decide({ caseId: DEMO.round2.caseId, personId: DEMO.round2.personId, optionId: "pause_gig" })
  assert.ok(!("error" in r2))
  state = await service.buildState()
  const seller = (await service.getKinds(state)).kinds.find((kind) => kind.kindKey === DEMO.kind)!
  assert.equal(`${seller.agreeing} of ${seller.needed}`, "2 of 16")
  assert.equal(seller.people, 2)
  assert.equal(seller.status, "learning")

  // Weight from the record: Sofie's one changed decision on the known kind counts against her there.
  const known = (await import("./loop")).weightOn(service.loopInput(state), DEMO.fastForward.kindKey, "p-sofie")
  assert.ok(known.value < 1 && known.decided === 6, `Sofie on the known kind: ${JSON.stringify(known)}`)

  // Fast-forward: the shift lead turns the proposal on; the agent handles the next case of that kind alone.
  const rule = await service.setTrustRule(DEMO.fastForward.ruleId, "on", DEMO.fastForward.shiftLeadId)
  assert.equal(rule?.status, "on")
  state = await service.buildState()
  assert.equal(state.cases.find((c) => c.id === DEMO.fastForward.caseId)?.status, "handled_by_agent")

  // And back.
  const again = await demoReset()
  assert.equal(again.round2.visible, false)
  assert.equal(again.fastForward.ruleStatus, "suggested")
})
