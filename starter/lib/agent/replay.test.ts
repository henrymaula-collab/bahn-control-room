// Replay without a model: today's wording on recorded text, the call-back for
// the option the person chose, and a recorded call-back put onto the live case.
// No database: the traces in traces/ and plain objects.

import assert from "node:assert/strict"
import test from "node:test"
import type { Case } from "@/lib/control-room/types"
import { DEMO } from "@/lib/demo/scenario"
import { ontoLiveCase } from "./loop"
import { listTraces, readTrace } from "./trace"
import { plainWords, plainWordsDeep } from "./wording"

const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []

test("a trust rule is on in lower case, in the recorded phrases", () => {
  assert.equal(plainWords("so the ON rule pauses the gig"), "so the trust rule pauses the gig")
  assert.equal(plainWords("I paused the gig under the ON trust rule for Arvelano Hamburg."), "I paused the gig under the trust rule for Arvelano Hamburg.")
  assert.equal(plainWords("trust rule r-1 (ON, turned on by Kaisa): x"), "trust rule r-1 (turned on by Kaisa): x")
  assert.equal(plainWords("Checked the trust rules: none is ON."), "Checked the trust rules: none is on.")
  assert.equal(plainWords("status ON_HOLD stays"), "status ON_HOLD stays")
})

test("no replayed trace says ON in capitals", () => {
  const traces = listTraces()
  assert.ok(traces.length >= 9)
  for (const t of traces) {
    const loud = strings(readTrace(t.file).map((line) => plainWordsDeep(line))).filter((s) => /\bON\b/.test(s))
    assert.deepEqual(loud, [], t.runId)
  }
})

test("every demo call-back is recorded, for its own order and option", () => {
  const traces = listTraces()
  for (const round of [DEMO.round1, DEMO.round2]) {
    for (const [optionId, runId] of Object.entries(round.callbacks)) {
      const t = traces.find((candidate) => candidate.runId === runId)
      assert.ok(t, runId)
      assert.equal(t.orderRef, round.reference)
      assert.equal(t.optionKey, optionId)
      assert.equal(t.provider, "api")
      assert.equal(t.outcome, "resolved")
    }
  }
})

const step = (at: string, kind: Case["agentSteps"][number]["kind"], summary: string) => ({ at, kind, summary })
const base = (over: Partial<Case>): Case => ({
  id: "case-x", orderId: "ord-x", desk: "ops-readiness", type: "readiness.release_document_missing", headline: "h", reasons: [], facts: [], agentSteps: [],
  suggestion: { id: "a", label: "A", effect: "", changes: [] }, alternatives: [{ id: "b", label: "B", effect: "", changes: [] }],
  status: "decided", createdAt: "2026-10-21T09:00:00.000Z", ...over,
})

test("a recorded call-back lands on the live case: its own steps, facts and status, nothing else", () => {
  const read = step("2026-10-21T08:44:00.000Z", "read", "Read the order.")
  const live = base({
    suggestion: { id: "b", label: "B", effect: "", changes: [] },
    alternatives: [{ id: "a", label: "A", effect: "", changes: [] }],
    routedTo: { personId: "p-sofie", why: "Sent to you", mode: "best_record", at: "2026-10-21T09:00:00.000Z" },
    facts: [{ id: "f1", statement: "s1", source: { kind: "record", at: "2026-10-21T08:00:00.000Z" }, strength: "confirmed" }],
    agentSteps: [read, step("2026-10-21T08:49:00.000Z", "propose", "Stopped here and suggested: b."), step("2026-10-25T10:00:00.000Z", "propose", "Sofie decided: b. The agent carries it out.")],
  })
  const recorded = base({
    status: "done",
    facts: [...live.facts, { id: "f-call", statement: "s2", source: { kind: "pickup_place", at: "2026-10-21T09:26:00.000Z" }, strength: "stated" }],
    agentSteps: [
      read, step("2026-10-21T08:49:00.000Z", "propose", "Stopped here and suggested: a."), step("2026-10-24T18:47:01.000Z", "propose", "Sofie decided: a. The agent carries it out."),
      step("2026-10-21T09:26:02.000Z", "call", "Called the pickup place."), step("2026-10-21T09:34:39.000Z", "message", "Carried out the decision: Sofie chose: B. Why: the recording's own reason."),
    ],
  })
  const merged = ontoLiveCase(live, recorded, "2026-10-21T09:25:00.000Z")
  assert.equal(merged.status, "done")
  assert.equal(merged.suggestion.id, "b")
  assert.equal(merged.routedTo?.personId, "p-sofie")
  assert.deepEqual(merged.facts.map((f) => f.id), ["f1", "f-call"])
  assert.deepEqual(merged.agentSteps.map((s) => s.summary), [
    "Read the order.", "Stopped here and suggested: b.", "Sofie decided: b. The agent carries it out.", "Called the pickup place.", "Carried out the decision: Sofie chose: B.",
  ])
  // Carrying it out twice changes nothing.
  assert.deepEqual(ontoLiveCase(merged, recorded, "2026-10-21T09:25:00.000Z"), merged)
})
