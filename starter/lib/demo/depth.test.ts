// Checks that the demo depth (lib/demo/depth.ts) stays consistent with the
// cases it deepens and reaches the chat's read tools. No database needed.
// Run: node --import tsx --test lib/demo/*.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { findOrder, table } from "@/lib/agent/data"
import { RunClock } from "@/lib/agent/clock"
import { FactRegistry } from "@/lib/agent/facts"
import { executeTool, type RunContext } from "@/lib/agent/tools"
import { AGENT_READ_AT, DEMO_CALLS, DEMO_ORDERS, DEMO_ORIGIN, DEMO_PLACES, DEMO_ROWS, type DemoOrderId } from "./depth"
import { installDemoDepth } from "./overlay"

const allText = JSON.stringify({ DEMO_ROWS, DEMO_CALLS, DEMO_PLACES })

test("every demo row is marked made up and belongs to a demo order", () => {
  for (const [name, rows] of Object.entries(DEMO_ROWS)) {
    for (const row of rows) {
      assert.ok(row.id.startsWith("demo-"), `${name}:${row.id} id`)
      assert.equal(row.data_origin, DEMO_ORIGIN, `${name}:${row.id} origin`)
      assert.ok(String(row.order_id) in DEMO_ORDERS, `${name}:${row.id} order ${String(row.order_id)}`)
    }
  }
  const ids = Object.values(DEMO_ROWS).flat().map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length, "ids are unique")
})

test("no demo message is older than the agent's counted read of that order", () => {
  for (const m of DEMO_ROWS.messages ?? []) {
    const readAt = AGENT_READ_AT[m.order_id as DemoOrderId]
    if (readAt) assert.ok(String(m.authored_at) > readAt, `${m.id} at ${String(m.authored_at)} is before the agent's read at ${readAt}`)
    const conv = String(m.conversation_id)
    const known = table("conversations").some((c) => c.id === conv) || (DEMO_ROWS.conversations ?? []).some((c) => c.id === conv)
    assert.ok(known, `${m.id} names conversation ${conv}`)
  }
})

test("Bahn's words: no ticket, human, escalate, seniority or middle dot", () => {
  for (const word of [/\bticket/i, /\bhuman/i, /\bescalat/i, /\bseniority/i, /·/]) assert.ok(!word.test(allText), `found ${word}`)
})

test("phone numbers are in the fictional 555 range", () => {
  const phones = allText.match(/\+\d[\d ]{6,}\d/g) ?? []
  assert.ok(phones.length > 10)
  for (const p of phones) assert.match(p, / 555 01\d\d$/, p)
})

test("the CD-420442 call sits inside the case's own steps and backs its fact", () => {
  const call = DEMO_CALLS.find((c) => c.orderId === "ord-00442")
  assert.ok(call)
  assert.deepEqual(call.factIds, ["f-demo-hold"])
  for (const t of call.turns) assert.ok(t.at > "2026-10-21T08:44:00.000Z" && t.at < "2026-10-21T08:49:00.000Z", t.at)
})

test("place notes cite the made-up history references (CD-41xxxx)", () => {
  for (const p of Object.values(DEMO_PLACES)) {
    assert.ok(p.contacts.length >= 2, p.name)
    for (const e of p.earlier) assert.equal(e.reference, `CD-41${String(1000 + Number(e.caseId.slice(-4))).padStart(4, "0")}`, e.caseId)
  }
})

function run(reference: string): RunContext {
  const order = findOrder(reference)
  if (!order) throw new Error(reference)
  return {
    runId: `test-${reference}`, provider: "mock", callModel: "mock", order, clock: new RunClock(new Date("2026-10-21T09:00:00.000Z")),
    registry: new FactRegistry(`test-${reference.toLowerCase()}`), store: {} as RunContext["store"],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, usd: 0 },
    trace: { step: (type: string, content: string, at: string) => ({ at, type, content }) } as unknown as RunContext["trace"],
    steps: [], calls: [], lessonsUsed: [], snap: { lessons: [], decisions: [], trustRules: [], cases: [] },
  }
}

test("installed, the chat's read tools return the depth; installing twice changes nothing", async () => {
  const packetNote = table("sites").find((s) => s.id === "site-042")?.pickup_access_note
  assert.ok(installDemoDepth() > 0)
  assert.equal(installDemoDepth(), 0)
  const conv = await executeTool(run("CD-420442"), "get_conversations", { order: "CD-420442" })
  assert.match(conv.content, /utlämningsfullmakt/)
  assert.match(conv.content, /Huomenta Kasper/)
  const place = await executeTool(run("CD-420458"), "get_pickup_place", { order: "CD-420458" })
  assert.match(place.content, /Lukas Brandt/)
  assert.ok(place.content.includes(String(packetNote)), "the packet's own access note comes first")
  const docs = JSON.parse((await executeTool(run("CD-420458"), "get_documents", { order: "CD-420458" })).content) as { documents: unknown[] }
  assert.equal(docs.documents.length, 5)
  const order = await executeTool(run("CD-420516"), "get_order", { order: "CD-420516" })
  assert.match(order.content, /Oona Hietamäki/)
  const windows = await executeTool(run("CD-420442"), "get_time_windows", { order: "CD-420442" })
  assert.match(windows.content, /LATEST_PICKUP_THAT_KEEPS_THE_DELIVERY_PROMISE/)
})
