// The chat agent's tools: read-only lookups, nothing else. Six reuse the
// Readiness agent's read tools in lib/agent (same data, same facts); three
// are the chat's own (precedents, the pickup place's history, calls). Every
// call shows as a ChatToolStep in plain words. The agent cannot act from the
// chat: no booking, no message, no call. The decision button does that.

import { RunClock } from "@/lib/agent/clock"
import { findOrder } from "@/lib/agent/data"
import { FactRegistry } from "@/lib/agent/facts"
import type { AgentStore } from "@/lib/agent/store"
import { executeTool, type RunContext } from "@/lib/agent/tools"
import type { TraceWriter } from "@/lib/agent/trace"
import type { ChatToolStep } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { answerWeight, earlierOfKind, recordOf } from "./knowledge"
import { day, dayTime } from "./words"

/** lib/agent read tools the chat may use. Everything else in lib/agent (calls, messages, proposing, resolving, callbacks) stays out. */
export const REUSED_READ_TOOLS = ["get_order", "get_pickup_place", "get_conversations", "get_documents", "get_time_windows", "list_trust_rules"] as const
export const OWN_TOOLS = ["get_precedents", "get_place_history", "get_calls"] as const
export const CHAT_TOOLS = [...REUSED_READ_TOOLS, ...OWN_TOOLS] as const
export type ChatToolName = (typeof CHAT_TOOLS)[number]

export const isChatTool = (name: string): name is ChatToolName => (CHAT_TOOLS as readonly string[]).includes(name)

export const CHAT_TOOL_DESCRIPTIONS: Record<ChatToolName, string> = {
  get_order: "Read the order: status, customer, car, pickup and delivery instructions with who stated them and when, notes, open alerts, the gig and the driver.",
  get_pickup_place: "Look up the pickup place: hours, access, its release document rule, language, and its accepted lessons.",
  get_conversations: "Read every message about this order (customer, pickup place, driver, Bahn people) with time and channel, in the original language.",
  get_documents: "Check the documents on the order (release document, CMR) and whether the pickup place needs a signed release document.",
  get_time_windows: "Check the pickup slot and the delivery promise, who set each one, and how many hours are left.",
  list_trust_rules: "List the trust rules for the Readiness desk: which kinds of case the agent may already handle alone.",
  get_precedents: "Earlier decisions on this kind of case: who decided, when, at which pickup place, what they chose, their reason, and how much each answer counts.",
  get_place_history: "Earlier cases and decisions at this pickup place, of any kind, and the lessons accepted for it.",
  get_calls: "The agent's phone calls on this order: who said what, with English translations.",
}

/** Plain words for each step, while it runs and when it is done. */
export function stepLabels(name: ChatToolName, ctx: ChatCaseContext): { running: string; done: string } {
  const place = ctx.order.pickup.name
  switch (name) {
    case "get_order":
      return { running: "Reading the order", done: "Read the order" }
    case "get_pickup_place":
      return { running: `Looking up ${place}`, done: `Looked up ${place}` }
    case "get_conversations":
      return { running: "Reading the messages on this order", done: "Read the messages on this order" }
    case "get_documents":
      return { running: "Checking the documents", done: "Checked the documents" }
    case "get_time_windows":
      return { running: "Checking the pickup slot and the delivery promise", done: "Checked the pickup slot and the delivery promise" }
    case "list_trust_rules":
      return { running: "Checking the trust rules", done: "Checked the trust rules" }
    case "get_precedents": {
      const n = earlierOfKind(ctx.history, ctx.kind.key, ctx.case.id).length
      return { running: "Looking up earlier cases of this kind", done: n ? `Looked up ${n} earlier ${n === 1 ? "case" : "cases"} of this kind` : "Looked up earlier cases of this kind: none" }
    }
    case "get_place_history":
      return { running: `Looking up earlier cases at ${place}`, done: `Looked up earlier cases at ${place}` }
    case "get_calls":
      return {
        running: ctx.calls.length === 1 ? `Reading the call with ${place}` : "Reading the calls on this order",
        done: ctx.calls.length === 0 ? "Looked for calls on this order: none yet" : ctx.calls.length === 1 ? `Read the call with ${place}` : `Read ${ctx.calls.length} calls on this order`,
      }
  }
}

// ---------- the reused lib/agent tools, behind a read-only context ----------

/** Any write from the chat is a bug: the store refuses all of them. */
const READ_ONLY_STORE = new Proxy({} as AgentStore, {
  get(_t, prop) {
    return async () => {
      throw new Error(`The chat cannot act (${String(prop)}): the decision button does that.`)
    }
  },
})

/** The chat writes no trace files; lib/agent's executeTool only calls step(). */
const NO_TRACE = {
  file: "",
  write() {},
  step(type: string, content: string, at: string, name?: string) {
    return { at, type, ...(name ? { name } : {}), content }
  },
  steps() {
    return []
  },
} as unknown as TraceWriter

export function chatRunContext(ctx: ChatCaseContext): RunContext {
  const order = findOrder(ctx.order.reference) ?? findOrder(ctx.order.id)
  if (!order) throw new Error(`No order ${ctx.order.reference} in the dataset.`)
  return {
    runId: `chat-${ctx.case.id}`,
    // "mock" keeps the read tools from calling a model (translation); the chat model reads the original language itself.
    provider: "mock",
    callModel: "mock",
    order,
    clock: new RunClock(new Date(ctx.now)),
    registry: new FactRegistry(`chat-${order.reference.toLowerCase()}`),
    store: READ_ONLY_STORE,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, usd: 0 },
    trace: NO_TRACE,
    steps: [],
    calls: [],
    lessonsUsed: [],
    snap: { lessons: ctx.snap.lessons, decisions: ctx.snap.decisions, trustRules: ctx.snap.trustRules as RunContext["snap"]["trustRules"], cases: ctx.snap.cases },
  }
}

// ---------- the chat's own tools ----------

function precedents(ctx: ChatCaseContext) {
  const rows = earlierOfKind(ctx.history, ctx.kind.key, ctx.case.id)
  return {
    kind: ctx.kind.label,
    earlier_decisions: rows.length,
    people: [...new Set(rows.map((d) => d.personName))].length,
    note: "Weights are how much each answer counts (the person's record on this kind at the time). Use them to judge; never tell anyone another person's numbers.",
    decisions: rows.slice(0, 20).map((d) => ({
      when: day(d.at),
      who: d.personName,
      pickup_place: d.placeName,
      order: d.reference || null,
      chose: d.choice,
      why: d.why ?? null,
      later_changed: d.laterChanged,
      weight: answerWeight(recordOf(ctx.history, d.personId, ctx.kind.key, { before: d.at, excludeCaseId: d.caseId })),
      made_up_history: d.synthetic,
    })),
  }
}

function placeHistory(ctx: ChatCaseContext) {
  const placeId = ctx.case.placeId
  const rows = ctx.history.filter((d) => placeId && d.placeId === placeId && d.caseId !== ctx.case.id).sort((a, b) => b.at.localeCompare(a.at))
  return {
    pickup_place: ctx.order.pickup.name,
    earlier_decisions_here: rows.length,
    decisions: rows.slice(0, 10).map((d) => ({ when: day(d.at), kind: d.kind.label, who: d.personName, chose: d.choice, why: d.why ?? null })),
    other_open_cases_here: ctx.placeCases.filter((c) => c.status === "waiting_for_person" || c.status === "agent_working").map((c) => ({ headline: c.headline, status: c.status.replace(/_/g, " ") })),
    lessons: ctx.lessons.map((l) => ({ text: l.text, status: l.status })),
  }
}

function calls(ctx: ChatCaseContext) {
  return {
    calls: ctx.calls.map((c) => ({
      started: dayTime(c.startedAt),
      language: c.language,
      outcome: c.outcome.replace(/_/g, " "),
      turns: c.turns.map((t) => ({ speaker: t.speaker === "agent" ? "Bahn agent" : ctx.order.pickup.name, text: t.text, ...(t.translation ? { english: t.translation } : {}) })),
    })),
  }
}

export interface ChatToolResult {
  content: string
  isError: boolean
}

/**
 * Run one chat tool. Only names in CHAT_TOOLS run; anything else (call_pickup_place,
 * message_driver, propose_case, resolve_without_person, schedule_callback...) is refused here,
 * before lib/agent is reached.
 */
export async function executeChatTool(ctx: ChatCaseContext, name: string, getRun: () => RunContext): Promise<ChatToolResult> {
  if (!isChatTool(name)) return { content: JSON.stringify({ error: `The chat cannot use ${name}. It only looks things up; the decision button acts.` }), isError: true }
  try {
    if (name === "get_precedents") return { content: JSON.stringify(precedents(ctx)), isError: false }
    if (name === "get_place_history") return { content: JSON.stringify(placeHistory(ctx)), isError: false }
    if (name === "get_calls") return { content: JSON.stringify(calls(ctx)), isError: false }
    const r = await executeTool(getRun(), name, { order: ctx.order.reference })
    return { content: r.content, isError: r.isError }
  } catch (e) {
    return { content: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), isError: true }
  }
}

/** Tool definitions for the Anthropic API: no inputs, the case is fixed by the thread. */
export function chatApiTools() {
  return CHAT_TOOLS.map((name) => ({
    name,
    description: CHAT_TOOL_DESCRIPTIONS[name],
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false, required: [] as string[] },
  }))
}

/** A step id that is unique within one answer. */
export function stepId(n: number, name: string): string {
  return `step-${n}-${name}`
}

export function toolStep(id: string, name: ChatToolName, ctx: ChatCaseContext, status: ChatToolStep["status"]): ChatToolStep {
  const l = stepLabels(name, ctx)
  return { id, tool: name, label: status === "running" ? l.running : status === "failed" ? `${l.running} failed` : l.done, status }
}
