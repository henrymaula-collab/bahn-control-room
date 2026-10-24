// Tests for the case chat. Run: npm run test:chat.
// Pure tests (kinds, knowledge, openers, the tool fence) need nothing. The
// route tests run in fixture mode (CR_DATA=fixtures, memory store, no keys,
// mock provider). The engine tests read the seeded database and skip, with a
// message, when it is not reachable; they never write to it.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { sql } from "drizzle-orm"
import type { Case, OpsPerson } from "@/lib/control-room/types"
import type { CaseKnowledge, ChatEvent, ChatThread } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { kindOf, kindOfType } from "./kind"
import { answerWeight, computeKnowledge, NEEDED_DEFAULT, type PastDecision } from "./knowledge"
import { buildOpener, openerShape } from "./opener"
import { memoryStore, setChatStore } from "./store"
import { CHAT_TOOLS, chatApiTools, chatRunContext, executeChatTool, PROPOSE_TOOL, proposeApiTool, proposeOption } from "./tools"
import { BANNED_WORDS } from "./words"

process.env.CR_CHAT_PROVIDER = "mock"
process.env.CR_CHAT_MOCK_DELAY_MS = "0"

// ---------- a small world to test the pure parts ----------

const PEOPLE: OpsPerson[] = [
  { id: "p-aino", name: "Aino", role: "ops", desks: ["ops-readiness"], languages: ["fi", "en"], onShift: true },
  { id: "p-jonas", name: "Jonas", role: "ops", desks: ["ops-readiness"], languages: ["de", "en"], onShift: true },
  { id: "p-emil", name: "Emil", role: "ops", desks: ["ops-readiness"], languages: ["da", "en"], onShift: true },
]

function sellerHoldCase(id: string, placeId: string, placeName: string): Case {
  return {
    id, orderId: "ord-00458", desk: "ops-readiness", type: "readiness.release_document_missing",
    headline: `${placeName} will not hand the car over: the release document is missing.`,
    reasons: ["papers_missing", "needs_the_customer"],
    facts: [
      { id: "f1", statement: "The car is at our branch, but the seller has put a hold on it while the invoice remains unsettled.", source: { kind: "pickup_place", name: placeName, channel: "call", at: "2026-10-21T08:38:00.000Z" }, strength: "stated" },
      { id: "f2", statement: "Release document: missing.", source: { kind: "record", channel: "record", at: "2026-10-21T07:00:00.000Z" }, strength: "confirmed" },
    ],
    agentSteps: [{ at: "2026-10-21T08:40:00.000Z", kind: "call", summary: "Called the pickup place." }],
    suggestion: { id: "ask_customer_for_release", label: "Ask the customer for the signed release", effect: "You send the message; the agent checks the next morning.", changes: [{ kind: "customer_message", detail: "Please ask the seller to lift the hold and send the signed release." }] },
    alternatives: [{ id: "move_pickup_next_day", label: "Move the pickup to the next working day", effect: "The agent asks the customer for a new date.", changes: [{ kind: "date", detail: "Pickup moves one day" }] }],
    status: "waiting_for_person", placeId, customerId: "cus-030", createdAt: "2026-10-21T08:41:00.000Z",
  }
}

function past(n: number, opts: Partial<PastDecision> & { personId: string }): PastDecision[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `d-${opts.personId}-${opts.kind?.key ?? "k"}-${i}`, caseId: `hist-${opts.personId}-${opts.kind?.key ?? "k"}-${i}`, reference: "", personName: PEOPLE.find((p) => p.id === opts.personId)?.name ?? "Lea",
    kind: { key: "seller_hold", label: "Seller hold on the car" }, caseType: "readiness.release_document_missing", placeId: "site-042", placeName: "Calverona Hamburg",
    optionId: "ask_customer_for_release", choice: "Ask the customer for the signed release", at: new Date(Date.parse("2026-10-20T10:00:00Z") - i * 86_400_000).toISOString(),
    laterChanged: false, onTime: true, synthetic: true, ...opts,
  }))
}

function ctxFor(c: Case, history: PastDecision[], personId: string): ChatCaseContext {
  return {
    source: "fixtures", now: "2026-10-21T09:00:00.000Z", case: c,
    order: { id: c.orderId, reference: "CD-420458", customer: "Kovellin Automobilhandel", vehicle: "Ferrari Roma", pickup: { id: c.placeId, name: "Calverona Hamburg", city: "Hamburg", country: "DE", timezone: "Europe/Berlin" }, delivery: { name: "Kovellin", city: "Helsinki", country: "FI", timezone: "Europe/Helsinki" } },
    person: PEOPLE.find((p) => p.id === personId)!, people: PEOPLE, kind: kindOf(c), history, lessons: [], calls: [], placeCases: [],
    snap: { lessons: [], decisions: [], trustRules: [], cases: [c] },
  }
}

function opener(c: Case, history: PastDecision[], personId: string) {
  const ctx = ctxFor(c, history, personId)
  const k = computeKnowledge({ case: c, kind: ctx.kind, history })
  return { k, shape: openerShape(ctx, k), message: buildOpener(ctx, k) }
}

function assertPlainWords(text: string, where: string) {
  assert.ok(!BANNED_WORDS.test(text), `${where} uses a banned word: ${text}`)
  assert.ok(!text.includes("·"), `${where} uses a middle dot`)
  assert.ok(!/\b[A-Z]{3,}\b/.test(text.replace(/\bCMR\b|\bEUR\b/g, "")), `${where} shouts in capitals`)
  assert.ok(!/\b[a-z]+_[a-z_]+\b|readiness\.|undefined|null|NaN/.test(text), `${where} shows a raw value: ${text}`)
}

const endsWithTheirCall = (text: string) => /(your call|the decision is yours|up to you)\.?$/i.test(text.trim())

// ---------- kinds ----------

test("kind is a property of the case, not one pickup place", () => {
  const a = kindOf(sellerHoldCase("case-a", "site-042", "Calverona Hamburg"))
  const b = kindOf(sellerHoldCase("case-b", "site-077", "Pellavaro Aarhus"))
  assert.deepEqual(a, { key: "seller_hold", label: "Seller hold on the car" })
  assert.deepEqual(a, b, "the same problem at two places is one kind")
  const plain = sellerHoldCase("case-c", "site-042", "Calverona Hamburg")
  plain.facts = plain.facts.slice(1)
  assert.equal(kindOf(plain).key, "release_document_missing", "without the hold it is the case type's kind")
  assert.equal(kindOfType("readiness.keys_or_access").label, "Key holder not named")
  assert.equal(kindOf({ ...plain, kind: { key: "fee_requested", label: "Pickup place asks a fee" } } as Case).key, "fee_requested", "a kind another track stored wins")
})

// ---------- knowledge ----------

test("knowledge: new, once and known; counts, people, needed, precedents", () => {
  const c = sellerHoldCase("case-now", "site-077", "Pellavaro Aarhus")
  const none = computeKnowledge({ case: c, kind: kindOf(c), history: [] })
  assert.equal(none.novelty, "new")
  assert.equal(none.decided, 0)
  assert.equal(none.needed, NEEDED_DEFAULT)
  assert.equal(NEEDED_DEFAULT, 16)
  assert.deepEqual(none.precedents, [])

  const once = computeKnowledge({ case: c, kind: kindOf(c), history: past(1, { personId: "p-aino", why: "Seller holds take more than a day to clear." }) })
  assert.equal(once.novelty, "rare")
  assert.equal(once.decided, 1)
  assert.equal(once.precedents[0].decidedBy, "Aino")
  assert.equal(once.precedents[0].why, "Seller holds take more than a day to clear.")
  assert.equal(once.precedents[0].weight, 0.5, "a first answer counts half")

  const history = [...past(9, { personId: "p-jonas" }), ...past(3, { personId: "p-aino", optionId: "move_pickup_next_day", choice: "Move the pickup to the next working day" }), ...past(1, { personId: "p-emil", caseId: "case-now" })]
  const known = computeKnowledge({ case: c, kind: kindOf(c), history, needed: 20 })
  assert.equal(known.novelty, "known")
  assert.equal(known.decided, 12, "a decision on this same case is not an earlier case")
  assert.equal(known.sameAsSuggestion, 9)
  assert.equal(known.peopleCount, 2)
  assert.equal(known.needed, 20)
  assert.equal(known.precedents.length, 5, "at most five precedents")
  const times = known.precedents.map((p) => p.at)
  assert.deepEqual(times, [...times].sort().reverse(), "newest first")
  for (const p of known.precedents) assert.ok(p.weight >= 0 && p.weight <= 1)
})

test("an answer's weight comes from the record on this kind, never a title", () => {
  assert.equal(answerWeight({ decided: 0, laterChanged: 0, onTime: 0 }), 0.5)
  assert.ok(answerWeight({ decided: 16, laterChanged: 0, onTime: 16 }) > 0.8)
  assert.ok(answerWeight({ decided: 10, laterChanged: 6, onTime: 3 }) < 0.5)
  assert.ok(answerWeight({ decided: 4, laterChanged: 0, onTime: 4 }) < answerWeight({ decided: 12, laterChanged: 0, onTime: 12 }), "more clean decisions count more")
})

// ---------- openers ----------

test("opener, new kind: says plainly it has not happened before; newer people also get the options", () => {
  const c = sellerHoldCase("case-new", "site-042", "Calverona Hamburg")
  const newer = opener(c, [], "p-emil")
  assert.equal(newer.shape.variant, "new")
  assert.match(newer.message.text, /has not happened before/)
  assert.match(newer.message.text, /You can ask the customer/)
  assert.match(newer.message.text, /what Calverona Hamburg said on the call/)
  assert.ok(endsWithTheirCall(newer.message.text))
  // Jonas knows release documents well (same case type, another kind): he gets the short form.
  const jonas = opener(c, past(8, { personId: "p-jonas", kind: { key: "release_document_missing", label: "Release document missing" } }), "p-jonas")
  assert.equal(jonas.shape.variant, "new")
  assert.ok(jonas.shape.experienced)
  assert.doesNotMatch(jonas.message.text, /You can /)
  assert.ok(jonas.message.text.split("\n").length < newer.message.text.split("\n").length)
  for (const o of [newer, jonas]) assertPlainWords(o.message.text, "new-kind opener")
})

test("opener, kind decided once: who decided, what, why, and that it is the person's call", () => {
  const c = sellerHoldCase("case-round2", "site-077", "Pellavaro Aarhus")
  const history = past(1, { personId: "p-aino", placeName: "Calverona Hamburg", at: "2026-10-24T15:10:00.000Z", why: "Seller holds take more than a day to clear." })
  const o = opener(c, history, "p-emil")
  assert.equal(o.shape.variant, "once")
  assert.match(o.message.text, /happened once before/)
  assert.match(o.message.text, /Aino decided it on Sat 24 Oct at Calverona Hamburg and chose to ask the customer for the signed release/)
  assert.match(o.message.text, /Seller holds take more than a day to clear/)
  assert.match(o.message.text, /With one case behind it, it is your call\.$/)
  assert.equal(o.k.decided, 1)
  assertPlainWords(o.message.text, "once opener")
})

test("opener, known kind: two lines for a strong record, an explanation for someone new", () => {
  const c = sellerHoldCase("case-known", "site-042", "Calverona Hamburg")
  const history = [...past(14, { personId: "p-jonas" }), ...past(3, { personId: "p-aino" })]
  const strong = opener(c, history, "p-jonas")
  assert.equal(strong.shape.variant, "known_experienced")
  const lines = strong.message.text.split("\n")
  assert.equal(lines.length, 2, "two lines")
  assert.match(lines[0], /^My suggestion: ask the customer/)
  assert.match(lines[1], /^It rests on .*17 of 17 earlier cases/)
  const newer = opener(c, history, "p-emil")
  assert.equal(newer.shape.variant, "known_newer")
  assert.match(newer.message.text, /Here is the problem/)
  assert.match(newer.message.text, /You can ask the customer for the signed release \(my suggestion\), or move the pickup/)
  assert.match(newer.message.text, /decided this kind of case 17 times/)
  assert.ok(newer.message.text.length > strong.message.text.length)
  for (const o of [strong, newer]) {
    assert.ok(endsWithTheirCall(o.message.text))
    assertPlainWords(o.message.text, "known opener")
    assert.equal(o.message.role, "agent")
    assert.ok(o.message.toolSteps?.every((s) => s.status === "done"))
  }
  const split = opener(c, [...past(6, { personId: "p-jonas" }), ...past(6, { personId: "p-aino", optionId: "move_pickup_next_day", choice: "Move the pickup to the next working day" })], "p-jonas")
  assert.match(split.message.text, /people answer this differently/)
})

// ---------- the tool fence ----------

test("propose_option offers only the case's own options, only while it waits, and never acts", async () => {
  const c = sellerHoldCase("case-offer", "site-042", "Calverona Hamburg")
  const ctx = ctxFor(c, [], "p-aino")
  const schema = proposeApiTool(ctx).input_schema.properties.option_id
  assert.deepEqual(schema.enum, ["ask_customer_for_release", "move_pickup_next_day"], "the model can name only the case's options")
  const ok = proposeOption(ctx, { option_id: "ask_customer_for_release", summary: "Aino asked the agent to send the email." }, "fallback")
  assert.equal(ok.isError, false)
  assert.equal(ok.action?.label, "Send the message", "the option's own button label")
  assert.equal(ok.action?.summary, "Aino asked the agent to send the email.")
  assert.ok(proposeOption(ctx, { option_id: "cancel_order" }, "x").isError, "an invented action is refused")
  assert.ok(proposeOption({ ...ctx, case: { ...c, status: "decided" } }, { option_id: "ask_customer_for_release" }, "x").isError, "a decided case gets no offer")

  // The mock agent, asked to do it, offers the option as an action event and does not decide.
  const { answer } = await import("./brain")
  const k = computeKnowledge({ case: c, kind: kindOf(c), history: [] })
  const shape = openerShape(ctx, k)
  const { variant: _v, ...opener } = buildOpener(ctx, k)
  for (const text of ["Can you send the email?", "Kan du skicka eposten?", "Voitko lähettää viestin?"]) {
    const events: ChatEvent[] = []
    const res = await answer({ ctx, knowledge: k, shape, opener, history: [], text, via: "text", emit: (e) => events.push(e) }, "mock")
    const acts = events.filter((e) => e.type === "action")
    assert.equal(acts.length, 1, `one offer for "${text}"`)
    assert.equal(res.action?.optionId, "ask_customer_for_release")
    assert.match(res.text, /Tap "Send the message"/)
    assert.ok(!/\b(sent|done)\b/i.test(res.text.replace(/before you tap/i, "")), "it never says it is done")
  }
  const events: ChatEvent[] = []
  await answer({ ctx, knowledge: k, shape, opener, history: [], text: "Has this happened before?", via: "text", emit: (e) => events.push(e) }, "mock")
  assert.ok(!events.some((e) => e.type === "action"), "a lookup stays a lookup")
})

test("no action tool is reachable from the chat", async () => {
  const actions = ["message_driver", "message_pickup_place", "call_pickup_place", "propose_case", "resolve_without_person", "schedule_callback"]
  for (const a of actions) assert.ok(!(CHAT_TOOLS as readonly string[]).includes(a), `${a} is not a chat tool`)
  assert.deepEqual(chatApiTools().map((t) => t.name), [...CHAT_TOOLS], "the model is offered exactly the chat tools")
  const { SDK_ALLOWED_TOOLS } = await import("./brain")
  assert.deepEqual(SDK_ALLOWED_TOOLS, [...CHAT_TOOLS, PROPOSE_TOOL].map((n) => `mcp__chat__${n}`), "Claude Code may use only the chat tools and propose_option")
  const c = sellerHoldCase("case-fence", "site-042", "Calverona Hamburg")
  const ctx = ctxFor(c, [], "p-emil")
  const run = chatRunContext(ctx)
  for (const a of actions) {
    const r = await executeChatTool(ctx, a, () => run)
    assert.ok(r.isError, `${a} is refused`)
    assert.match(r.content, /only looks things up/)
  }
  assert.equal(run.steps.length, 0, "nothing ran in lib/agent")
  await assert.rejects(run.store.saveCase(c), /cannot act/, "the chat's store refuses writes")
  const ok = await executeChatTool(ctx, "get_documents", () => run)
  assert.ok(!ok.isError, "a read tool runs")
  assert.match(ok.content, /Release document/)
})

// ---------- baseline depth (lib/depth) and the detail budget ----------

test("baseline depth: deterministic, in the place's language with English, before the case, never for a demo order", async () => {
  const { generateDepth, DEMO_ORDER_REFS } = await import("@/lib/depth/generate")
  const { missingPhrases } = await import("@/lib/depth/phrases")
  assert.deepEqual(missingPhrases(), [], "every line exists in every language")
  const c = { id: "case-ord-00531-car_not_ready", type: "readiness.car_not_ready", createdAt: "2026-10-21T09:00:00.000Z", facts: [] }
  const a = generateDepth({ order: "CD-420531", case: c, now: c.createdAt })
  const b = generateDepth({ order: "ord-00531", case: c, now: c.createdAt })
  assert.ok(a)
  assert.deepEqual(a, b, "same input, same record")
  assert.ok(a.messages.length >= 3, "a short thread")
  assert.ok(a.messages.every((m) => m.language === "da" && m.english), "Danish pickup place and customer, with English")
  assert.ok(a.messages.some((m) => m.fromKind === "pickup_place" && /klargøring/.test(m.text)), "the pickup place says the car is still being prepared")
  assert.ok(a.messages.filter((m) => m.fromKind === "pickup_place").every((m) => /\b(cannot|not)\b/.test(m.english ?? "")), "the pickup place confirms nothing: the case stays open")
  assert.ok(a.calls.length >= 1 && a.notes.length >= 1 && a.documents.length >= 4 && a.earlierPickups.length === 3)
  assert.ok(a.place.contacts.some((p) => p.name === "Zara Alderfield"), "the dataset's own contact stays the contact")
  assert.match(a.place.phone, /555 01|55 55 01/, "clearly fictional numbers")
  const times = [...a.messages.map((m) => m.at), ...a.calls.map((x) => x.startedAt), ...a.notes.map((n) => n.at)]
  assert.ok(times.every((t) => t < c.createdAt), "everything on file happened before the case")
  assert.deepEqual([...times].sort(), times, "in order")
  for (const ref of DEMO_ORDER_REFS) assert.equal(generateDepth({ order: ref, case: c, now: c.createdAt }), null, `${ref} is left to lib/demo`)
  for (const text of [...a.messages.flatMap((m) => [m.text, m.english ?? ""]), ...a.notes.map((n) => n.text)]) assertPlainWords(text, "baseline")
})

test("detail: explicit asks get 140 words (70 by voice); everything else keeps 45/90/35", async () => {
  const { asksForDetail } = await import("./words")
  const { wordBudget } = await import("./brain")
  for (const q of ["What exactly did the seller write?", "Tell me everything", "Read me the email", "List the documents", "Who is the contact?", "Vad skrev de?", "Kuka on yhteyshenkilö?", "Was hat der Händler geschrieben?", "Hvem er kontaktpersonen?"])
    assert.ok(asksForDetail(q), `detail: ${q}`)
  for (const q of ["Has this happened before?", "Why do you suggest this?", "Can you send the email?", "What happens if we wait?"]) assert.ok(!asksForDetail(q), `not detail: ${q}`)
  const shape = (experienced: boolean) => ({ experienced }) as Parameters<typeof wordBudget>[0]["shape"]
  assert.equal(wordBudget({ via: "text", shape: shape(true), text: "Why?" }), 45)
  assert.equal(wordBudget({ via: "text", shape: shape(false), text: "Why?" }), 90)
  assert.equal(wordBudget({ via: "voice", shape: shape(false), text: "Why?" }), 35)
  assert.equal(wordBudget({ via: "text", shape: shape(true), text: "What exactly did they write?" }), 140)
  assert.equal(wordBudget({ via: "voice", shape: shape(true), text: "Tell me everything" }), 70)
})

test("the chat's tools carry the baseline in full", async () => {
  const { generateDepth } = await import("@/lib/depth/generate")
  const c = { ...sellerHoldCase("case-depth", "site-054", "Vandellora Odense Vest"), orderId: "ord-00531", type: "readiness.car_not_ready" as const }
  const base = ctxFor(c, [], "p-sofie")
  const ctx = { ...base, order: { ...base.order, id: "ord-00531", reference: "CD-420531" }, depth: generateDepth({ order: "ord-00531", case: c, now: c.createdAt }) }
  const run = chatRunContext(ctx)
  const read = async (name: string) => JSON.parse((await executeChatTool(ctx, name, () => run)).content) as Record<string, unknown>
  const conv = await read("get_conversations")
  const msgs = (conv.conversations as { messages: { text: string; english?: string }[] }[]).flatMap((x) => x.messages)
  for (const m of ctx.depth!.messages) assert.ok(msgs.some((x) => x.text === m.text && x.english === m.english), "every message, whole, with its English")
  assert.ok(((await read("get_calls")).desk_calls as unknown[]).length >= 1)
  assert.ok(((await read("get_documents")).other_documents as unknown[]).length >= 4)
  const place = await read("get_pickup_place")
  assert.ok(place.phone && (place.contacts as unknown[]).length >= 2 && place.opening_hours)
  assert.equal(((await read("get_place_history")).earlier_pickups_here as unknown[]).length, 3)
  assert.ok((await read("get_order")).customer_contact)
})

// ---------- the route, in fixture mode (no database, no keys) ----------

async function route() {
  return import("@/app/api/cr/cases/[id]/chat/route")
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function sse(res: Response): Promise<ChatEvent[]> {
  const text = await res.text()
  return text.split("\n\n").filter((f) => f.trim()).map((f) => {
    assert.ok(f.startsWith("data: "), `every frame is a data line: ${f.slice(0, 40)}`)
    return JSON.parse(f.slice(6)) as ChatEvent
  })
}

function assertOrder(events: ChatEvent[]) {
  assert.equal(events[0]?.type, "thinking", "thinking comes first")
  assert.equal(events.at(-1)?.type, "done", "done comes last")
  assert.equal(events.filter((e) => e.type === "done" || e.type === "error").length, 1, "one end")
  const seen = new Map<string, string>()
  let firstDelta = -1
  events.forEach((e, i) => {
    if (e.type === "tool") {
      const before = seen.get(e.step.id)
      if (e.step.status === "running") assert.equal(before, undefined, "a step starts once")
      else assert.equal(before, "running", `step ${e.step.id} ran before it finished`)
      seen.set(e.step.id, e.step.status)
      if (firstDelta >= 0) assert.fail("in the scripted agent, lookups come before the answer")
    }
    if (e.type === "delta" && firstDelta < 0) firstDelta = i
  })
  for (const [id, status] of seen) assert.notEqual(status, "running", `step ${id} finished`)
  assert.ok(firstDelta > 0, "the answer streams")
  const done = events.at(-1) as Extract<ChatEvent, { type: "done" }>
  const streamed = events.filter((e): e is Extract<ChatEvent, { type: "delta" }> => e.type === "delta").map((e) => e.text).join("")
  assert.equal(done.message.text, streamed.trim(), "done carries the streamed text")
  assert.equal(done.message.role, "agent")
  assert.deepEqual(done.message.toolSteps?.map((s) => s.id), [...seen.keys()])
  return done.message
}

test("route (fixtures): GET thread shape, POST streams events in order, messages persist", async () => {
  process.env.CR_DATA = "fixtures"
  setChatStore(memoryStore)
  try {
    const { GET, POST, DELETE } = await route()
    await DELETE(new Request("http://x/api/cr/cases/case-420458/chat"), params("case-420458"))
    const g = await GET(new Request("http://x/api/cr/cases/case-420458/chat?person=aino"), params("case-420458"))
    assert.equal(g.status, 200)
    const thread = (await g.json()) as ChatThread
    assert.deepEqual(Object.keys(thread).sort(), ["caseId", "knowledge", "messages", "opener"])
    assert.equal(thread.caseId, "case-420458")
    const k: CaseKnowledge = thread.knowledge
    assert.deepEqual(Object.keys(k).sort(), ["decided", "kindKey", "kindLabel", "needed", "novelty", "peopleCount", "precedents", "sameAsSuggestion"])
    assert.equal(k.kindLabel, "Seller hold on the car")
    assert.equal(k.novelty, "new")
    assert.equal(g.headers.get("x-cr-opener"), "new")
    assert.match(thread.opener.text, /has not happened before/)
    assert.deepEqual(thread.messages, [])

    const p = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ person: "aino", text: "Has this happened before?", via: "text" }) }), params("case-420458"))
    assert.equal(p.status, 200)
    assert.match(p.headers.get("content-type") ?? "", /^text\/event-stream/)
    const reply = assertOrder(await sse(p))
    assert.match(reply.text, /Nobody at Bahn has decided a case of this kind before/)
    assert.ok(endsWithTheirCall(reply.text))
    assertPlainWords(reply.text, "mock answer")

    const v = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ person: "p-aino", text: "What did the pickup place say?", via: "voice" }) }), params("CD-420458"))
    const voiced = assertOrder(await sse(v))
    assert.equal(voiced.via, "voice")

    const again = (await (await GET(new Request("http://x/api/cr/cases/case-420458/chat?person=p-aino"), params("case-420458"))).json()) as ChatThread
    assert.deepEqual(again.messages.map((m) => m.role), ["person", "agent", "person", "agent"], "both turns persist, oldest first")
    assert.equal(again.messages[0].personId, "aino")
    assert.equal(again.messages[2].via, "voice")

    // Someone who knows the kind well gets the two-line opener (fixture records: Sofie, keys).
    const sofie = (await (await GET(new Request("http://x/api/cr/cases/case-420516/chat?person=sofie"), params("case-420516"))).json()) as ChatThread
    assert.equal(sofie.knowledge.novelty, "known")
    assert.equal(sofie.opener.text.split("\n").length, 2)
    const emil = (await (await GET(new Request("http://x/api/cr/cases/case-420516/chat?person=emil"), params("case-420516"))).json()) as ChatThread
    assert.ok(emil.opener.text.split("\n").length > 2)

    assert.equal((await GET(new Request("http://x/api/cr/cases/case-420458/chat"), params("case-420458"))).status, 400, "person is required")
    assert.equal((await GET(new Request("http://x/api/cr/cases/nope/chat?person=aino"), params("nope"))).status, 404)
    assert.equal((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ person: "aino", text: " " }) }), params("case-420458"))).status, 400, "text is required")
    const cleared = (await (await DELETE(new Request("http://x/api/cr/cases/case-420458/chat?person=aino"), params("case-420458"))).json()) as { removed: number }
    assert.equal(cleared.removed, 4)
  } finally {
    delete process.env.CR_DATA
    setChatStore(undefined)
  }
})

// ---------- engine (seeded database, read only) ----------

let reachable = false
let closeDb: (() => Promise<void>) | undefined

before(async () => {
  try {
    const db = await import("@/lib/control-room/db")
    closeDb = db.closeCrDb
    await Promise.race([db.crDb.execute(sql`select 1 from cr_decisions limit 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))])
    reachable = true
  } catch {
    reachable = false
  }
})

after(async () => {
  if (closeDb) await closeDb()
})

test("engine: every waiting case has a thread whose opener fits its knowledge", async (t) => {
  if (!reachable) return t.skip("database not reachable: docker compose up -d --wait, then db:seed and db:seed:cr")
  setChatStore(memoryStore)
  try {
    const { buildState } = await import("@/lib/control-room/service")
    const { getThread } = await import("./service")
    const state = await buildState()
    const waiting = state.cases.filter((c) => c.status === "waiting_for_person")
    assert.ok(waiting.length > 0)
    for (const c of waiting) {
      for (const person of ["p-emil", "p-jonas"]) {
        const r = await getThread(c.id, person)
        assert.ok(r.ok, `${c.id}: thread`)
        if (!r.ok) continue
        const k = r.thread.knowledge
        assert.ok(!/\b(Hamburg|Helsinki|Odense|Vienna|Espoo)\b/.test(k.kindLabel), `${c.id}: the kind "${k.kindLabel}" is not a place`)
        assert.equal(k.novelty === "new", k.decided === 0)
        assert.ok(k.sameAsSuggestion <= k.decided && k.peopleCount <= k.decided)
        assert.equal(k.needed, NEEDED_DEFAULT)
        if (k.novelty === "new") assert.match(r.thread.opener.text, /has not happened before/)
        if (k.decided === 1) assert.match(r.thread.opener.text, /once before/)
        assert.ok(endsWithTheirCall(r.thread.opener.text), `${c.id}: the opener leaves the decision to ${person}`)
        assertPlainWords(r.thread.opener.text, `${c.id} opener for ${person}`)
      }
    }
    const one = await getThread(waiting[0].id, "p-emil")
    if (one.ok) {
      const { collectTurn } = await import("./service")
      const turn = await collectTurn(waiting[0].id, { person: "p-emil", text: "Why do you suggest this?" })
      assert.ok(turn.ok)
      if (turn.ok) assertOrder(turn.events)
    }
  } finally {
    setChatStore(undefined)
  }
})
