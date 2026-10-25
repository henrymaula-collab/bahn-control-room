// The chat agent's tools: read-only lookups, nothing else. Six reuse the
// Readiness agent's read tools in lib/agent (same data, same facts); three
// are the chat's own (precedents, the pickup place's history, calls). Every
// call shows as a ChatToolStep in plain words. The agent does not act on its
// own from the chat: no booking, no message, no call. It can offer one of the
// case's own options (propose_option), which the chat shows as one tap; the
// person's tap is the decision, and it goes the same way as the card's button.

import { RunClock } from "@/lib/agent/clock"
import { findOrder } from "@/lib/agent/data"
import { FactRegistry } from "@/lib/agent/facts"
import type { AgentStore } from "@/lib/agent/store"
import { executeTool, type RunContext } from "@/lib/agent/tools"
import type { TraceWriter } from "@/lib/agent/trace"
import { answerFor } from "@/app/(control-room)/_ui/ask"
import type { Option } from "@/lib/control-room/types"
import type { ChatAction, ChatToolStep } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { withDepth } from "./depth"
import type { ChatDraft, ChatOffer } from "./intent"
import { answerWeight, earlierOfKind, recordOf } from "./knowledge"
import { day, inPersonZone, shownAt, stamp } from "./words"

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
  get_calls: "The phone calls on this order (the agent's and the Readiness desk's) and the desk's internal notes: who said what, with English translations.",
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
    case "get_calls": {
      const n = ctx.calls.length + (ctx.depth?.calls.length ?? 0)
      return {
        running: n === 1 ? `Reading the call with ${place}` : "Reading the calls on this order",
        done: n === 0 ? "Looked for calls on this order: none yet" : n === 1 ? `Read the call with ${place}` : `Read ${n} calls on this order`,
      }
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
      when: day(shownAt(d.at, ctx.now)),
      who: d.personName,
      car: d.car ?? null,
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
    decisions: rows.slice(0, 20).map((d) => ({ when: day(shownAt(d.at, ctx.now)), kind: d.kind.label, who: d.personName, car: d.car ?? null, order: d.reference || null, chose: d.choice, why: d.why ?? null })),
    other_open_cases_here: ctx.placeCases.filter((c) => c.status === "waiting_for_person" || c.status === "agent_working").map((c) => ({ headline: c.headline, status: c.status.replace(/_/g, " ") })),
    lessons: ctx.lessons.map((l) => ({ text: l.text, status: l.status })),
  }
}

function calls(ctx: ChatCaseContext) {
  return {
    calls: ctx.calls.map((c) => ({
      started: stamp(c.startedAt),
      language: c.language,
      outcome: c.outcome.replace(/_/g, " "),
      turns: c.turns.map((t) => ({ speaker: t.speaker === "agent" ? "Bahn agent" : ctx.order.pickup.name, text: t.text, ...(t.translation ? { english: t.translation } : {}) })),
    })),
  }
}

/** One time zone in every answer (words.ts inPersonZone). */
function zoned(content: string): string {
  try {
    return JSON.stringify(inPersonZone(JSON.parse(content)))
  } catch {
    return content
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
  if (!isChatTool(name)) return { content: JSON.stringify({ error: `The chat cannot use ${name}. It only looks things up, and offers one of the case's options with propose_option.` }), isError: true }
  try {
    if (name === "get_precedents") return { content: zoned(JSON.stringify(precedents(ctx))), isError: false }
    if (name === "get_place_history") return { content: zoned(withDepth(name, JSON.stringify(placeHistory(ctx)), ctx)), isError: false }
    if (name === "get_calls") return { content: zoned(withDepth(name, JSON.stringify(calls(ctx)), ctx)), isError: false }
    const r = await executeTool(getRun(), name, { order: ctx.order.reference })
    return { content: r.isError ? r.content : zoned(withDepth(name, r.content, ctx)), isError: r.isError }
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

// ---------- offering one of the case's options (the person's tap decides) ----------

export const PROPOSE_TOOL = "propose_option" as const

export const PROPOSE_DESCRIPTION =
  "Offer to carry out one of the case's options when the person asks you to do it (send the email, keep the gig unpublished...). " +
  "The chat shows the option's button and 'Not now'; nothing happens until the person taps it, and that tap is their decision. " +
  "Only the option ids listed under Options. Call it at most once per answer."

export function caseOptions(ctx: ChatCaseContext): Option[] {
  return [ctx.case.suggestion, ...ctx.case.alternatives].filter(Boolean)
}

/** The option's own button label, as on the card ("Send the email"). */
export const buttonLabel = (o: Option): string => answerFor(o, o.draft)

/** What the agent does once it is decided: the effect's sentences about the agent, else the whole effect. */
export function nextWords(o: Option): string {
  const sentences = o.effect.split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean)
  const agent = sentences.filter((x) => /^the agent\b/i.test(x))
  return (agent.length ? agent : sentences).join(" ")
}

/** Tool definition for the Anthropic API: the option ids are the case's own, nothing else. */
export function proposeApiTool(ctx: ChatCaseContext) {
  const ids = caseOptions(ctx).map((o) => o.id)
  return {
    name: PROPOSE_TOOL,
    description: PROPOSE_DESCRIPTION,
    input_schema: {
      type: "object" as const,
      properties: {
        option_id: { type: "string", enum: ids, description: "The id of the option the person asked you to carry out." },
        summary: { type: "string", description: "One short sentence, in English, of what the person asked and weighed in this conversation. Saved as the reason for the decision." },
      },
      additionalProperties: false,
      required: ["option_id", "summary"],
    },
  }
}

export interface Proposal {
  action?: ChatAction
  content: string
  isError: boolean
}

/** Checks a propose_option call: only an open case, only one of its options. */
export function proposeOption(ctx: ChatCaseContext, input: { option_id?: unknown; summary?: unknown }, fallbackSummary: string): Proposal {
  if (ctx.case.status !== "waiting_for_person")
    return { content: JSON.stringify({ error: "This case is not waiting for a decision any more. Say so; do not offer anything." }), isError: true }
  const option = caseOptions(ctx).find((o) => o.id === input.option_id)
  if (!option)
    return { content: JSON.stringify({ error: `No option ${String(input.option_id)} on this case. Offer only the listed options; for anything else, say the card's Other options is the way.` }), isError: true }
  const summary = typeof input.summary === "string" && input.summary.trim() ? input.summary.trim().slice(0, 240) : fallbackSummary
  const draft = draftOf(ctx, option)
  // The pickup place the agent calls back once it is decided (actions.ts carryOut), for the chat's receipt.
  const offer: ChatOffer = { optionId: option.id, label: buttonLabel(option), summary, next: nextWords(option), ...(draft ? { draft } : {}), calls: ctx.order.pickup.name }
  const action: ChatAction = offer
  return {
    action,
    content: JSON.stringify({
      shown: true,
      button: action.label,
      note: "The person now sees this button and 'Not now' under your answer. Nothing has happened yet. In one short sentence say what happens when they tap it. Do not say it is done, and do not ask them to confirm in words.",
    }),
    isError: false,
  }
}

/** The message the option sends, so the yes is given on the actual text: the option's draft, else its message change. */
export function draftOf(ctx: ChatCaseContext, o: Option): ChatDraft | undefined {
  const subject = `${ctx.order.vehicle}, ${ctx.order.reference}`
  if (o.draft?.text) return { to: o.draft.to, language: o.draft.language, text: o.draft.text, ...(o.draft.translation ? { translation: o.draft.translation } : {}), ...(/e-?mail/i.test(o.draft.to) ? { subject } : {}) }
  const msg = o.changes.find((ch) => ch.kind === "customer_message" || ch.kind === "driver_message")
  if (!msg?.detail) return undefined
  return { to: msg.kind === "customer_message" ? ctx.order.customer : "The driver", language: "en", text: msg.detail }
}

/** The conversation in one line, for the decision's reason when the model gives none. */
export function chatSummary(asked: string[]): string {
  const short = (q: string) => (q.length > 70 ? `${q.slice(0, 67).trimEnd()}...` : q)
  const qs = asked.map((q) => q.trim()).filter(Boolean)
  return qs.length ? `Decided in the chat after asking: ${qs.map((q) => `"${short(q)}"`).join(", ")}` : "Decided in the chat"
}
