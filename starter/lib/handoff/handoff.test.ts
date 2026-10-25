import assert from "node:assert/strict"
import { test } from "node:test"
import type { OpsPerson } from "@/lib/control-room/types"
import { nextCase, previousCase } from "./order"
import { colleaguesFor } from "./pick"

const rows = [
  { caseId: "a", decideBy: "2026-10-21T09:30:00Z" },
  { caseId: "b", decideBy: "2026-10-21T10:00:00Z" },
  { caseId: "c", decideBy: "2026-10-21T10:00:00Z" },
  { caseId: "d" },
]

test("next case: the row after the open one, in Your tasks' order", () => {
  assert.equal(nextCase(rows, "a")?.caseId, "b")
  assert.equal(nextCase(rows, "b")?.caseId, "c")
  assert.equal(nextCase(rows, "c")?.caseId, "d")
})

test("next case: after the last one it wraps to the first left", () => {
  assert.equal(nextCase(rows, "d")?.caseId, "a")
})

test("next case: a case that just left the list still opens the one that followed it", () => {
  const left = rows.filter((r) => r.caseId !== "b")
  assert.equal(nextCase(left, { caseId: "b", decideBy: "2026-10-21T10:00:00Z" })?.caseId, "c")
  // Unknown decide-by (only the id): the first row left.
  assert.equal(nextCase(left, "b")?.caseId, "a")
})

test("next case: nothing left, no next case", () => {
  assert.equal(nextCase([rows[0]!], "a"), undefined)
  assert.equal(nextCase([], "a"), undefined)
})

test("previous case: the row before, no wrap", () => {
  assert.equal(previousCase(rows, "c")?.caseId, "b")
  assert.equal(previousCase(rows, "a"), undefined)
})

const person = (id: string, languages: string[], extra: Partial<OpsPerson> = {}): OpsPerson => ({
  id, name: id.replace(/^p-/, "").replace(/^./, (ch) => ch.toUpperCase()), role: "ops", desks: ["ops-readiness"], languages, onShift: true, ...extra,
})
const people = [
  person("p-aino", ["fi", "sv", "en"]),
  person("p-jonas", ["de", "en"]),
  person("p-emil", ["da", "de", "en"]),
  person("p-sofie", ["da", "en", "sv"]),
  person("p-lea", ["de", "en"], { onShift: false }),
  person("p-kaisa", ["fi", "de"], { role: "shift_lead" }),
]
const c = { id: "case-x", type: "readiness.release_document_missing" as const, desk: "ops-readiness", placeId: "pl-1", status: "waiting_for_person" as const, routedTo: { personId: "p-aino", why: "", mode: "best_record" as const, at: "" } }
const decision = (personId: string, extra: { placeId?: string; country?: string } = {}) => ({ personId, caseType: c.type, laterChanged: false, ...extra })

test("colleague pick: reads the place's language when the sender does not, and the line says so", () => {
  const place = { name: "Calverona Hamburg", country: "DE" }
  const list = colleaguesFor({ c, from: people[0]!, people, cases: [], decisions: [], place })
  assert.deepEqual(list.map((x) => x.personId), ["p-emil", "p-jonas", "p-sofie"]) // no Lea (off shift), no Kaisa (lead), not Aino
  assert.equal(list[0]!.short, "Emil reads German")
  assert.equal(list[0]!.reason, "Reads German, the language at Calverona Hamburg.")
  // Emil and Jonas both read German: when Emil has fewer open tasks, the line names that.
  const busy = { status: "waiting_for_person" as const, routedTo: { personId: "p-emil", why: "", mode: "best_record" as const, at: "" } }
  const again = colleaguesFor({ c, from: people[0]!, people, cases: [busy], decisions: [], place })
  assert.equal(again[0]!.personId, "p-jonas")
  assert.equal(again[0]!.reason, "Reads German and has no open tasks.")
})

test("colleague pick: a tie on language is broken by the count, and the line names the count", () => {
  const decisions = [decision("p-jonas", { country: "DE" }), decision("p-jonas", { country: "DE" })]
  const list = colleaguesFor({ c, from: people[0]!, people, cases: [], decisions, place: { name: "Calverona Hamburg", country: "DE" } })
  assert.equal(list[0]!.personId, "p-jonas")
  assert.equal(list[0]!.reason, "Reads German and has handled 2 missing release documents in Germany.")
})

test("colleague pick: someone who already passed the case on goes last", () => {
  const list = colleaguesFor({ c, from: people[1]!, people, cases: [], decisions: [], place: { name: "Calverona Hamburg", country: "DE" }, passedOn: ["p-emil"] })
  assert.equal(list.at(-1)!.personId, "p-emil")
})

test("colleague pick: without language or counts, the fewest open tasks", () => {
  const open = (personId: string) => ({ status: "waiting_for_person" as const, routedTo: { personId, why: "", mode: "best_record" as const, at: "" } })
  const list = colleaguesFor({ c, from: people[0]!, people, cases: [open("p-jonas"), open("p-emil"), open("p-emil")], decisions: [], place: { name: "Velantora Helsinki", country: "FI" } })
  assert.equal(list[0]!.personId, "p-sofie")
  assert.equal(list[0]!.reason, "No open tasks, the fewest on the desk.")
})
