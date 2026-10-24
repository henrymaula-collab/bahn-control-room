// The authority gate, tested without a model:
//   node --import tsx --test lib/agent/*.test.ts

import assert from "node:assert/strict"
import { test } from "node:test"
import { checkChanges, contactCheck, messageCommits, type TrustRule } from "./gate"
import { findOrder, site } from "./data"

const ctx = { caseType: "readiness.facts_disagree", placeId: "site-047", customerId: "cus-035", country: "DE" }
const rule = (over: Partial<TrustRule> = {}): TrustRule => ({
  id: "rule-test",
  caseType: "readiness.facts_disagree",
  scope: { placeId: "site-047" },
  when: "At Arvelano Hamburg, the pickup place and the order disagree on where to collect the car",
  then: "Pause the gig until the pickup place confirms",
  evidence: { matched: 13, total: 14, caseIds: [] },
  status: "on",
  optionId: "pause_gig",
  ...over,
})
const pause = [{ kind: "booking" as const, detail: "Pause the gig" }]

test("nothing changes: no yes needed", () => {
  assert.equal(checkChanges([], ctx, []).allowed, true)
  assert.equal(checkChanges([{ kind: "none", detail: "" }], ctx, []).allowed, true)
})

test("a change without a rule needs a person", () => {
  const r = checkChanges(pause, ctx, [], undefined, "pause_gig")
  assert.equal(r.allowed, false)
  assert.match(r.allowed ? "" : r.reason, /Needs a person/)
})

test("an ON rule for the same option, type and place lets the agent act", () => {
  const r = checkChanges(pause, ctx, [rule()], "rule-test", "pause_gig")
  assert.equal(r.allowed, true)
})

test("a suggested rule is not ON", () => {
  assert.equal(checkChanges(pause, ctx, [rule({ status: "suggested" })], "rule-test", "pause_gig").allowed, false)
})

test("the rule must name the option the agent takes", () => {
  assert.equal(checkChanges(pause, ctx, [rule()], "rule-test", "accept_fee").allowed, false)
})

test("another pickup place is out of scope", () => {
  assert.equal(checkChanges(pause, { ...ctx, placeId: "site-042" }, [rule()], "rule-test", "pause_gig").allowed, false)
})

test("a fee rule covers only fees up to its limit", () => {
  const fee = rule({ caseType: "readiness.fee_requested", when: "The pickup place asks for a storage fee up to EUR 50", then: "Accept the fee and confirm the pickup", optionId: "accept_fee" })
  const c = { ...ctx, caseType: "readiness.fee_requested" }
  assert.equal(checkChanges([{ kind: "cost", detail: "fee", amountEur: 40 }], c, [fee], undefined, "accept_fee").allowed, true)
  assert.equal(checkChanges([{ kind: "cost", detail: "fee", amountEur: 60 }], c, [fee], undefined, "accept_fee").allowed, false)
})

test("a message to the customer always needs a person, even with an ON rule", () => {
  const r = checkChanges([{ kind: "customer_message", detail: "Hello" }], ctx, [rule()], "rule-test", "pause_gig")
  assert.equal(r.allowed, false)
})

test("asking is fine, agreeing to a cost or a date in a message is not", () => {
  assert.equal(messageCommits("Can you tell us the fee for releasing the car?"), undefined)
  assert.ok(messageCommits("Okay, we will pay 35 EUR for the yard."))
  assert.ok(messageCommits("Wir zahlen die 35 Euro Umsetzgebühr."))
  assert.ok(messageCommits("We will move the pickup to Tuesday."))
})

test("a pickup place run by the paying customer is not contacted by the agent", () => {
  const own = findOrder("CD-420719")!
  assert.equal(contactCheck(own, site(own.pickup_site_id)).allowed, false)
  const other = findOrder("CD-420458")!
  assert.equal(contactCheck(other, site(other.pickup_site_id)).allowed, true)
})
