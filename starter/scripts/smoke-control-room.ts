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
import { buildState, decide, getDesk, getLead, refreshTrustRules, setTrustRule } from "../lib/control-room/service"
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
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.includes(".test.") && name !== "types.ts")) {
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
  const target = waiting[0]
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
      if (state.derivedIds.has(target.id)) await crDb.delete(crCases).where(eq(crCases.id, target.id))
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

  // 9. HTTP, when a server is running
  const base = process.env.APP_URL
  if (base) {
    const person = state.people[0]!.id
    const anyCase = state.cases[0]!.id
    for (const path of ["/api/cr/people", `/api/cr/desk?person=${person}`, `/api/cr/cases/${anyCase}`, "/api/cr/lead", "/api/cr/orders/checks"]) {
      const response: Response = await fetch(`${base}${path}`)
      assert.equal(response.status, 200, `${path} -> ${response.status}`)
      await response.json()
    }
    const bad: Response = await fetch(`${base}/api/cr/decisions`, { method: "POST", body: "{}" })
    assert.equal(bad.status, 400)
    ok(`http: every GET route answers 200 at ${base}; bad POST answers 400`)
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
