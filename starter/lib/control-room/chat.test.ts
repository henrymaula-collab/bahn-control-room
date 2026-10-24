// The chat UI's side of the contract (types-chat.ts): the SSE wire format, the
// fixture threads for the three demo states, the scripted replies and the words
// for what the agent knows about a kind of case. No database, no keys.

import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { chatEventStream, encodeChatEvent, readChatEvents } from "./chat-sse"
import { gateWords, knowledgeWords } from "./chat-words"
import { fixtureReply, fixtureThread, NEEDED, resetChatFixtures } from "./fixtures/chat"
import type { CaseKnowledge, ChatEvent } from "./types-chat"

beforeEach(() => resetChatFixtures())

const streamOf = (text: string, cut = 7) => {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += cut) c.enqueue(bytes.slice(i, i + cut))
      c.close()
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = []
  for await (const ev of readChatEvents(body)) out.push(ev)
  return out
}

async function* list<T>(items: T[]) {
  for (const i of items) yield i
}

test("SSE: events survive the wire, split at any byte", async () => {
  const events: ChatEvent[] = [
    { type: "thinking" },
    { type: "tool", step: { id: "s1", tool: "get_order", label: "Read the order", status: "running" } },
    { type: "delta", text: "Hamburg, Straße: “ok”\n\nnext" },
    { type: "error", message: "stopped" },
  ]
  const wire = events.map(encodeChatEvent).join("")
  for (const cut of [1, 3, 7, 64]) assert.deepEqual(await collect(streamOf(wire, cut)), events)
  assert.deepEqual(await collect(chatEventStream(list(events))), events)
})

test("SSE: also reads data-only blocks, CRLF and comments (another route's framing)", async () => {
  const wire = ': hello\r\n\r\ndata: {"type":"thinking"}\r\n\r\nevent: delta\ndata: {"text":"Hi"}\n\ndata: {"type":"nope"}\n\n'
  assert.deepEqual(await collect(streamOf(wire)), [{ type: "thinking" }, { type: "delta", text: "Hi" }])
})

test("threads: new kind, decided once, known kind", () => {
  const fresh = fixtureThread("case-420458", "aino")!
  assert.equal(fresh.knowledge.novelty, "new")
  assert.equal(fresh.knowledge.precedents.length, 0)
  assert.equal(fresh.knowledge.needed, NEEDED)
  assert.match(fresh.opener.text, /has not happened before/)
  assert.equal(knowledgeWords(fresh.knowledge), "New kind of case")

  const once = fixtureThread("case-420015", "aino")!
  assert.equal(once.knowledge.decided, 1)
  assert.match(once.opener.text, /Mikko/)
  assert.match(once.opener.text, /your call/)
  assert.equal(knowledgeWords(once.knowledge), "Decided once, by Mikko")

  const known = fixtureThread("case-420516", "sofie")!
  assert.equal(known.knowledge.novelty, "known")
  assert.ok(known.knowledge.peopleCount > 1)
  assert.ok(known.knowledge.precedents.length <= 5)
  assert.equal(knowledgeWords(known.knowledge), "14 of 16 agree, 3 people")
})

test("threads: the opener follows the person's record on the kind", () => {
  const paragraphs = (t: string) => t.split(/\n{2,}/).length
  const experienced = fixtureThread("case-420516", "sofie")!.opener.text
  const newer = fixtureThread("case-420516", "emil")!.opener.text
  assert.equal(paragraphs(experienced), 2)
  assert.ok(newer.length > experienced.length)
  assert.match(newer, /your call/i)
  // Engine ids and a 40-row copy get the same thread.
  assert.equal(fixtureThread("case-420516-copy-3", "p-sofie")!.opener.text, experienced)
  assert.equal(fixtureThread("case-unknown", "aino"), null)
})

test("reply: thinking, each step running then done, the text in deltas, done last", async () => {
  const events: ChatEvent[] = []
  for await (const ev of fixtureReply("case-420458", "aino", "What if we book the driver anyway?", "voice", 0)) events.push(ev)
  assert.equal(events[0].type, "thinking")
  assert.equal(events.at(-1)!.type, "done")
  const firstDelta = events.findIndex((e) => e.type === "delta")
  const lastTool = events.findLastIndex((e) => e.type === "tool")
  assert.ok(lastTool > 0 && firstDelta > lastTool, "steps come before the words")
  const seen = new Map<string, string[]>()
  for (const e of events) if (e.type === "tool") seen.set(e.step.id, [...(seen.get(e.step.id) ?? []), e.step.status])
  for (const states of seen.values()) assert.deepEqual(states, ["running", "done"])
  const done = events.at(-1) as Extract<ChatEvent, { type: "done" }>
  const text = events.flatMap((e) => (e.type === "delta" ? [e.text] : [])).join("")
  assert.equal(done.message.text, text)
  assert.equal(done.message.role, "agent")
  assert.equal(done.message.toolSteps?.length, seen.size)
  assert.match(text, /yours|your call|up to you/i, "the decision stays with the person")

  const after = fixtureThread("case-420458", "aino")!
  assert.deepEqual(
    after.messages.map((m) => [m.role, m.via]),
    [
      ["person", "voice"],
      ["agent", "voice"],
    ],
  )
  assert.equal(fixtureThread("case-420458", "mikko")!.messages.length, 0, "one thread per person")
})

test("reply: the chat reaches only read-only tools", async () => {
  const acting = /^(message_|call_|schedule_|propose_|resolve_|book|send)/
  const questions = ["What if we book the driver?", "Move it to Wednesday?", "How long will the release take?", "Who are you?"]
  for (const caseId of ["case-420458", "case-420015", "case-420516", "case-420347", "case-420593"]) {
    for (const q of questions) {
      resetChatFixtures()
      for await (const ev of fixtureReply(caseId, "aino", q, "text", 0)) {
        if (ev.type === "tool") assert.doesNotMatch(ev.step.tool, acting, `${caseId}: ${ev.step.tool}`)
      }
    }
    for (const s of fixtureThread(caseId, "aino")!.opener.toolSteps ?? []) assert.doesNotMatch(s.tool, acting)
  }
})

test("words: how far a kind is from the agent handling it alone", () => {
  const k = (over: Partial<CaseKnowledge>): CaseKnowledge => ({
    kindKey: "k",
    kindLabel: "Kind",
    novelty: "known",
    decided: 15,
    sameAsSuggestion: 14,
    peopleCount: 3,
    needed: 16,
    precedents: [],
    ...over,
  })
  assert.equal(gateWords(k({})), "2 more agreeing answers and the agent may offer to handle this kind alone.")
  assert.equal(gateWords(k({ sameAsSuggestion: 15 })), "1 more agreeing answer and the agent may offer to handle this kind alone.")
  assert.match(gateWords(k({ decided: 1, sameAsSuggestion: 1, peopleCount: 1 })), /^15 more agreeing answers, from more than one person,/)
  assert.match(gateWords(k({ decided: 20, sameAsSuggestion: 18, peopleCount: 3 })), /^Enough people agree/)
  assert.match(gateWords(k({ decided: 20, sameAsSuggestion: 18, peopleCount: 1 })), /all from one person/)
  assert.equal(knowledgeWords(k({ decided: 20, sameAsSuggestion: 18 })), "16 of 16 agree, 3 people")
  for (const s of [gateWords(k({})), knowledgeWords(k({}))]) assert.doesNotMatch(s, /·|ticket|human|escalat/i)
})
