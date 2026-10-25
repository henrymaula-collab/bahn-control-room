// The chat in one place: GET builds the thread (knowledge, opener, earlier
// turns); POST runs one turn and streams ChatEvents. The route handlers in
// app/api/cr/cases/[id]/chat only translate HTTP.

import type { CaseKnowledge, ChatEvent, ChatMessage, ChatThread } from "@/lib/control-room/types-chat"
import { answer, type AnswerInput, chatProvider, type ChatProvider } from "./brain"
import { loadContext, type ChatCaseContext } from "./context"
import { cleanCase } from "./clean"
import { type DecidedMessage, decidedFacts, decidedLine } from "./decided"
import { directAnswer } from "./direct"
import { chatIntent } from "./intent"
import { computeKnowledge } from "./knowledge"
import { buildOpener, type OpenerShape, type OpenerVariant, openerShape } from "./opener"
import { chatStore, messageId } from "./store"
import { shownAt } from "./words"

export type Failure = { ok: false; status: 400 | 404; error: string }

export interface Prepared {
  ctx: ChatCaseContext
  knowledge: CaseKnowledge
  shape: OpenerShape
  opener: ChatMessage
}

export function prepare(raw: ChatCaseContext): Prepared {
  // The recorded trace's day-less clock times are out of everything the chat reads and says (clean.ts).
  const clean = cleanCase(raw.case)
  const ctx: ChatCaseContext = { ...raw, case: clean, snap: { ...raw.snap, cases: raw.snap.cases.map((c) => (c.id === clean.id ? clean : c)) } }
  // Engine: the loop's own knowledge (the card, Know-how and History count the same). Fixtures: the same gate over the chat's history.
  const known = ctx.knowledge ?? computeKnowledge({ case: ctx.case, kind: ctx.kind, history: ctx.history })
  // Precedents dated on the room's day when decided after its clock (words.ts shownAt): the opener, the prompt and the panel.
  const knowledge: CaseKnowledge = { ...known, precedents: known.precedents.map((p) => ({ ...p, at: shownAt(p.at, ctx.now) })) }
  const shape = openerShape(ctx, knowledge)
  const { variant: _variant, ...opener } = buildOpener(ctx, knowledge)
  return { ctx, knowledge, shape, opener }
}

/** GET /api/cr/cases/:id/chat?person=<id> */
export async function getThread(caseId: string, personId: string | null | undefined): Promise<{ ok: true; thread: ChatThread; variant: OpenerVariant } | Failure> {
  if (!personId) return { ok: false, status: 400, error: "person is required" }
  const r = await loadContext(caseId, personId)
  if (!r.ok) return r
  const p = prepare(r.ctx)
  const messages = await chatStore().list(p.ctx.case.id, p.ctx.person.id)
  return { ok: true, thread: { caseId: p.ctx.case.id, knowledge: p.knowledge, opener: p.opener, messages }, variant: p.shape.variant }
}

export interface PostBody {
  person?: string
  text?: string
  via?: string
  /** Optional override for tests and demos: claude-code | api | mock. */
  provider?: string
}

export type Turn = (emit: (e: ChatEvent) => void, signal?: AbortSignal) => Promise<void>

/**
 * POST /api/cr/cases/:id/chat: validate, then hand back the turn to stream.
 * Event order: thinking first; each tool step as running, then done or failed;
 * text deltas; done (with the saved message) last, or error last.
 */
export async function prepareTurn(caseId: string, body: PostBody): Promise<{ ok: true; turn: Turn; provider: ChatProvider } | Failure> {
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!body.person) return { ok: false, status: 400, error: "person is required" }
  if (!text) return { ok: false, status: 400, error: "text is required" }
  if (text.length > 4000) return { ok: false, status: 400, error: "text is too long (4000 characters at most)" }
  const via: "voice" | "text" = body.via === "voice" ? "voice" : "text"
  const r = await loadContext(caseId, body.person)
  if (!r.ok) return r
  const p = prepare(r.ctx)
  const provider = chatProvider(body.provider)
  const store = chatStore()
  const caseKey = p.ctx.case.id
  const personId = p.ctx.person.id

  const turn: Turn = async (emit, signal) => {
    let closed = false
    const send = (e: ChatEvent) => {
      if (closed) return
      if (e.type === "done" || e.type === "error") closed = true
      emit(e)
    }
    try {
      const history = await store.list(caseKey, personId)
      const mine: ChatMessage = { id: messageId("msg-p"), caseId: caseKey, role: "person", personId, text, via, at: new Date().toISOString() }
      await store.add(mine, personId)
      send({ type: "thinking" })
      const input: AnswerInput = { ...p, history, text, via, emit: (e: ChatEvent) => send(e), signal }
      // "Send the email" / "show me the email" are commands, answered at once (direct.ts); the rest goes to the model.
      const intent = chatIntent(text)
      const res = (intent && (await directAnswer(input, intent))) || (await answer(input, provider))
      if (signal?.aborted) return
      const reply: ChatMessage = {
        id: messageId("msg-a"), caseId: caseKey, role: "agent", text: res.text || "I could not find an answer to that. The decision is yours.", via, at: new Date().toISOString(),
        toolSteps: res.toolSteps.map((s) => (s.status === "running" ? { ...s, status: "failed" as const } : s)),
        // "Show me the email": the email rides on the message (ChatMessage plus one field), so it is there on reload and in History.
        ...(res.email ? { email: res.email } : {}),
      }
      await store.add(reply, personId)
      send({ type: "done", message: reply })
    } catch (e) {
      send({ type: "error", message: e instanceof Error ? e.message : String(e) })
    }
  }
  return { ok: true, turn, provider }
}

/** Run one turn to the end and collect its events (tests, scripts). */
export async function collectTurn(caseId: string, body: PostBody): Promise<{ ok: true; events: ChatEvent[] } | Failure> {
  const prep = await prepareTurn(caseId, body)
  if (!prep.ok) return prep
  const events: ChatEvent[] = []
  await prep.turn((e) => events.push(e))
  return { ok: true, events }
}

/** DELETE /api/cr/cases/:id/chat[?person=<id>]: start a thread over (demo reset). */
export async function clearThread(caseId: string, personId?: string | null): Promise<{ ok: true; removed: number } | Failure> {
  const r = await loadContext(caseId, personId ?? "p-aino")
  const id = r.ok ? r.ctx.case.id : caseId
  const pid = personId && r.ok ? r.ctx.person.id : undefined
  if (personId && !r.ok) return r
  return { ok: true, removed: await chatStore().clear(id, pid) }
}

/**
 * For the learning loop's case record ("the chat: ids or a short summary"): the
 * thread's message ids and what the person asked. Ids are the engine's (case id, "p-aino").
 */
export async function chatForCaseRecord(caseId: string, personId: string): Promise<{ messageIds: string[]; turns: number; viaVoice: boolean; summary: string }> {
  const messages = await chatStore().list(caseId, personId)
  const asked = messages.filter((m) => m.role === "person" && m.text.trim())
  const short = (q: string) => (q.length > 80 ? `${q.slice(0, 77).trimEnd()}...` : q)
  return {
    messageIds: messages.map((m) => m.id),
    turns: asked.length,
    viaVoice: asked.some((m) => m.via === "voice"),
    summary: asked.length ? `Asked: ${asked.map((m) => short(m.text.trim())).join(" / ")}` : "Decided without talking it through",
  }
}

/**
 * Right after a decision is saved (actions.ts decide, for the card, the sheet and the chat alike): the
 * person's thread gets one agent line saying who decided, when, what went out and what comes next, so
 * the conversation, a reopened panel and the model all read the same settled fact.
 */
export async function noteDecision(caseId: string, personId: string): Promise<void> {
  const r = await loadContext(caseId, personId)
  if (!r.ok) return
  const { ctx } = prepare(r.ctx)
  const f = decidedFacts(ctx)
  if (!f) return
  const message: DecidedMessage = {
    id: messageId("msg-a"),
    caseId: ctx.case.id,
    role: "agent",
    text: decidedLine(f),
    via: "text",
    at: new Date(Math.max(Date.parse(f.iso), Date.now())).toISOString(),
    decided: { at: f.at, by: f.by },
  }
  await chatStore().add(message, ctx.person.id)
}
