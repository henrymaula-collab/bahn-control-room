// Smoke test for the control-room engine. Run: npm run smoke:cr
// Add APP_URL=http://localhost:3100 to also hit every /api/cr route.
// It leaves the database as it found it: rows it writes are removed again.

import "dotenv/config"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { eq, inArray } from "drizzle-orm"
import { countChecks } from "../lib/control-room/checks"
import { closeCrDb, crDb } from "../lib/control-room/db"
import { scaleChecks } from "../lib/control-room/scale"
import { crCases, crDecisions, crLessons } from "../lib/control-room/schema"
import { buildState, decide, getCaseDetail, getDesk, getLead, getOverview, getWork, refreshTrustRules, setTrustRule } from "../lib/control-room/service"
import { inEurope } from "../lib/control-room/geo"
import { listTrustRules, saveTrustRule } from "../lib/control-room/store"

const results: string[] = []
const ok = (line: string) => { results.push(`ok   ${line}`); console.log(`ok   ${line}`) }

async function main() {
  const t0 = Date.now()
  const state = await buildState()
  ok(`engine state built in ${Date.now() - t0} ms`)

  // 1. Order checks
  const real = state.checks.filter((check) => !check.synthetic)
  const counts = countChecks(real)
  assert.equal(counts.total, state.world.orders.length, "one check per order")
  assert.ok(counts.needs_person >= 15 && counts.needs_person <= 45, `needs_person should be a focused set, got ${counts.needs_person}`)
  for (const check of real) {
    assert.ok(check.checks.length > 0, `${check.reference} lists what was checked`)
    if (check.state === "needs_person") assert.ok(check.checks.some((row) => !row.ok), `${check.reference} says why it needs a person`)
  }
  ok(`checks: ${counts.total} orders; needs a person ${counts.needs_person}, agent working ${counts.agent_working}, not checked ${counts.not_checked}, checked and quiet ${counts.checked_quiet}`)

  // 2. Cases
  const waiting = state.cases.filter((c) => c.status === "waiting_for_person")
  assert.ok(state.cases.length > 0, "derived readiness cases exist")
  for (const c of state.cases) {
    assert.ok(c.facts.length > 0, `${c.id} has facts`)
    for (const fact of c.facts) {
      assert.ok(fact.source.at && !Number.isNaN(Date.parse(fact.source.at)), `${c.id}/${fact.id} has a time`)
      if (fact.source.kind === "record") assert.ok(fact.source.recordRef, `${c.id}/${fact.id} points at a record`)
    }
    assert.ok(!/^(approve|ok|yes|confirm)$/i.test(c.suggestion.label), `${c.id} names the action`)
    for (const option of [c.suggestion, ...c.alternatives]) assert.ok(option.changes.length > 0, `${c.id}/${option.id} says what changes`)
  }
  for (const c of waiting) {
    assert.ok(c.routedTo?.personId, `${c.id} is routed`)
    assert.ok(/\d|only one|speak|learn|fewest/.test(c.routedTo!.why), `${c.id} routing says why with a count: ${c.routedTo!.why}`)
  }
  ok(`cases: ${state.cases.length} readiness cases, ${waiting.length} waiting for a person, all routed with a reason`)

  // 3. No order ids in engine code (reseed-safe)
  const dir = join(process.cwd(), "lib", "control-room")
  // The shape files (contract and view types) name the hero order in example comments; engine code must not.
  const contract = new Set(["types.ts", "types-v3.ts", "views.ts"])
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.includes(".test.") && !contract.has(name))) {
    const text = readFileSync(join(dir, file), "utf8")
    assert.ok(!/\bord-\d{5}\b|\bCD-4\d{5}\b/.test(text), `${file} must not name an order`)
  }
  ok("no order ids in lib/control-room")

  // 4. Desk for every person
  for (const person of state.people) {
    const desk = await getDesk(person.id)
    assert.ok(desk, `desk for ${person.id}`)
    assert.ok(desk!.quiet.checked + desk!.quiet.notChecked === desk!.quiet.total, "quiet line adds up")
  }
  ok(`desks: ${state.people.length} people`)

  // 5. Decision round trip, then clean up
  // Prefer a derived case: an agent's stored case belongs to the live demo. If only agent cases
  // wait, the stored row is put back exactly as it was afterwards.
  const target = waiting.find((c) => state.derivedIds.has(c.id)) ?? waiting[0]
  const [storedBefore] = target ? await crDb.select().from(crCases).where(eq(crCases.id, target.id)) : []
  if (target) {
    const result = await decide({ caseId: target.id, personId: target.routedTo!.personId, optionId: target.alternatives[0]!.id, why: "Smoke test" })
    assert.ok(!("error" in result), "decision recorded")
    if (!("error" in result)) {
      assert.equal(result.case.status, "decided")
      assert.equal(result.lesson.status, "proposed")
      const after = await buildState()
      assert.equal(after.cases.find((c) => c.id === target.id)?.status, "decided")
      assert.notEqual(after.checks.find((check) => check.orderId === target.orderId)?.state, "needs_person")
      await crDb.delete(crDecisions).where(eq(crDecisions.id, result.decision.id))
      await crDb.delete(crLessons).where(eq(crLessons.id, result.lesson.id))
      if (storedBefore) await crDb.update(crCases).set({ status: storedBefore.status, routedTo: storedBefore.routedTo, updatedAt: storedBefore.updatedAt, data: storedBefore.data }).where(eq(crCases.id, target.id))
      else await crDb.delete(crCases).where(eq(crCases.id, target.id))
      await refreshTrustRules()
    }
    ok(`decision: ${target.id} decided, lesson proposed, order left the board; cleaned up`)
  }

  // 6. Trust rule on -> the agent handles the matching case; then restore
  const rules = await listTrustRules()
  const rule = rules.find((candidate) => candidate.status === "suggested")
  if (rule) {
    await setTrustRule(rule.id, "on", "p-kaisa")
    const on = await buildState()
    const handled = on.cases.filter((c) => c.status === "handled_by_agent")
    await saveTrustRule(rule) // back to exactly what it was
    ok(`trust rule "${rule.when} -> ${rule.then}" (${rule.evidence.matched} of ${rule.evidence.total}): on handles ${handled.length} case(s) alone; restored`)
  }

  // 7. Scale toggle
  const a = scaleChecks(state.world, state.now, 300)
  const b = scaleChecks(state.world, state.now, 300)
  assert.equal(a.length, 300)
  assert.ok(a.every((check) => check.state === "checked_quiet"))
  assert.deepEqual(a.map((check) => check.syntheticFrom), b.map((check) => check.syntheticFrom), "deterministic")
  ok("scale: CR_SCALE=300 adds 300 quiet checked made-up orders, deterministic")

  // 8. Lead view
  const lead = await getLead()
  assert.ok(lead.coverage.length > 0 && lead.money.line.startsWith("EUR"))
  ok(`lead: ${lead.trustRules.length} trust rule(s), ${lead.lessons.accepted.length} accepted / ${lead.lessons.proposed.length} proposed lessons, coverage gaps: ${lead.coverage.filter((c) => c.onlyOne).map((c) => c.label).join(", ") || "none"}`)

  // 8b. v3 views: the map, Work lists and case extras agree with the desk and the lead
  {
    const v3 = await buildState()
    const v3Lead = await getLead(v3)
    for (const person of v3.people) {
      const overview = (await getOverview(person.id, v3))!
      const work = (await getWork(person.id, v3))!
      const desk = (await getDesk(person.id, v3))!
      assert.equal(overview.counts.needsPerson, v3Lead.today.needsPerson, "red cars = lead today.needsPerson")
      assert.equal(overview.counts.agentWorking, v3Lead.today.agentWorking, "agent cars = lead today.agentWorking")
      assert.equal(work.needYou.length, (desk.focus ? 1 : 0) + desk.queue.length, `${person.id}: Needs you = the desk`)
      assert.ok(overview.cars.every((car) => inEurope(car.position)), "every car inside Europe")
    }
    for (const c of v3.cases) {
      const detail = (await getCaseDetail(c.id, v3))!
      assert.ok(detail.why.length <= 3 && detail.situation && detail.situation.facts.length <= 5, `${c.id}: why <= 3, facts <= 5`)
    }
    const overview = (await getOverview(v3.people[0]!.id, v3))!
    ok(`v3: ${overview.counts.carsToday} cars on the map (${overview.counts.needsPerson} need a person, ${overview.counts.agentWorking} agent working), counts agree with desk and lead`)
  }

  // 9. HTTP, when a server is running
  const base = process.env.APP_URL
  if (base) {
    const person = state.people[0]!.id
    const anyCase = state.cases[0]!.id
    const json: Record<string, unknown> = {}
    for (const path of ["/api/cr/people", `/api/cr/desk?person=${person}`, `/api/cr/cases/${anyCase}`, "/api/cr/lead", "/api/cr/orders/checks", `/api/cr/overview?person=${person}`, `/api/cr/work?person=${person}`]) {
      const response: Response = await fetch(`${base}${path}`)
      assert.equal(response.status, 200, `${path} -> ${response.status}`)
      json[path] = await response.json()
    }
    // The v3 routes agree with the lead and the desk over HTTP too.
    const httpOverview = json[`/api/cr/overview?person=${person}`] as { counts: { needsPerson: number; agentWorking: number; needYou: number }; cars: unknown[] }
    const httpLead = json["/api/cr/lead"] as { today: { needsPerson: number; agentWorking: number } }
    const httpDesk = json[`/api/cr/desk?person=${person}`] as { focus: unknown; queue: unknown[] }
    const httpWork = json[`/api/cr/work?person=${person}`] as { needYou: unknown[] }
    const httpCase = json[`/api/cr/cases/${anyCase}`] as { why?: unknown[]; situation?: { facts: unknown[] } }
    assert.equal(httpOverview.counts.needsPerson, httpLead.today.needsPerson)
    assert.equal(httpOverview.counts.agentWorking, httpLead.today.agentWorking)
    assert.equal(httpOverview.counts.needYou, (httpDesk.focus ? 1 : 0) + httpDesk.queue.length)
    assert.equal(httpWork.needYou.length, httpOverview.counts.needYou)
    assert.ok(Array.isArray(httpCase.why) && httpCase.why.length <= 3 && httpCase.situation && httpCase.situation.facts.length <= 5)
    for (const path of ["/api/cr/overview", "/api/cr/work"]) {
      const missing: Response = await fetch(`${base}${path}`)
      assert.equal(missing.status, 400, `${path} without ?person -> ${missing.status}`)
      const unknown: Response = await fetch(`${base}${path}?person=nobody`)
      assert.equal(unknown.status, 404, `${path}?person=nobody -> ${unknown.status}`)
    }
    const bad: Response = await fetch(`${base}/api/cr/decisions`, { method: "POST", body: "{}" })
    assert.equal(bad.status, 400)
    ok(`http: every GET route answers 200 at ${base} (overview ${httpOverview.cars.length} cars); v3 counts agree with lead and desk; bad POST and missing person answer 400/404`)
  }

  void inArray
  await closeCrDb()
  console.log(`\nsmoke:cr passed (${results.length} checks)`)
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
