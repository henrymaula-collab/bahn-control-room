// The chat agent's answer to one message, streamed as ChatEvents. Providers
// come from the lib/agent layer: api (Anthropic API, streamed), claude-code
// (Claude Agent SDK with the chat tools as an in-process MCP server and no
// other tool), mock (scripted, no keys). replay has no recorded chats, so it
// answers like mock.

import type { RunContext } from "@/lib/agent/tools"
import { agentModel, agentProvider, claudeCodeEnv, effectiveProvider, paths, supportsDefaultFallback, type Provider } from "@/lib/agent/config"
import type { BetaMessageParam } from "@/lib/agent/llm"
import type { CaseKnowledge, ChatAction, ChatEvent, ChatMessage, ChatToolStep } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { mockAnswer, mockPlan } from "./mock"
import type { OpenerShape } from "./opener"
import { chatSystem } from "./prompt"
import { asksForDetail, DETAIL_WORDS } from "./words"
import { CHAT_TOOL_DESCRIPTIONS, CHAT_TOOLS, chatApiTools, chatRunContext, chatSummary, executeChatTool, isChatTool, PROPOSE_DESCRIPTION, PROPOSE_TOOL, proposeApiTool, proposeOption, stepId, toolStep, type ChatToolName, type ChatToolResult, type Proposal } from "./tools"

export type ChatProvider = Exclude<Provider, "replay">

/** CR_CHAT_PROVIDER, else CR_AGENT_PROVIDER, else mock. api without a key falls back to mock. */
export function chatProvider(requested?: string): ChatProvider {
  const raw = (requested ?? process.env.CR_CHAT_PROVIDER ?? process.env.CR_AGENT_PROVIDER ?? "mock").trim().toLowerCase()
  const p = (["claude-code", "api", "mock", "replay"].includes(raw) ? raw : agentProvider("mock")) as Provider
  const eff = effectiveProvider(p)
  return eff === "replay" ? "mock" : eff
}

export function chatModel(): string {
  return process.env.CR_CHAT_MODEL?.trim() || agentModel()
}

export interface AnswerInput {
  ctx: ChatCaseContext
  knowledge: CaseKnowledge
  shape: OpenerShape
  opener: ChatMessage
  /** Earlier turns, oldest first, without the new message. */
  history: ChatMessage[]
  text: string
  via: "text" | "voice"
  emit: (e: ChatEvent) => void
  signal?: AbortSignal
}

export interface AnswerResult {
  text: string
  toolSteps: ChatToolStep[]
  /** The option the agent offered to carry out, if it did (shown as one tap). */
  action?: ChatAction
  provider: ChatProvider
  model: string
}

const MAX_TURNS = 4

/** Runs tools and reports each as a step: running first, then done or failed. */
class Steps {
  readonly list: ChatToolStep[] = []
  private run?: RunContext
  constructor(private ctx: ChatCaseContext, private emit: (e: ChatEvent) => void) {}

  async call(name: string): Promise<ChatToolResult> {
    if (!isChatTool(name)) return executeChatTool(this.ctx, name, () => this.runContext())
    const id = stepId(this.list.length + 1, name)
    const running = toolStep(id, name, this.ctx, "running")
    this.list.push(running)
    this.emit({ type: "tool", step: running })
    const r = await executeChatTool(this.ctx, name, () => this.runContext())
    const final = toolStep(id, name as ChatToolName, this.ctx, r.isError ? "failed" : "done")
    this.list[this.list.indexOf(running)] = final
    this.emit({ type: "tool", step: final })
    return r
  }

  private runContext(): RunContext {
    this.run ??= chatRunContext(this.ctx)
    return this.run
  }
}

/** propose_option for one answer: checked against the case, emitted once as an action event. */
function offerer(input: AnswerInput) {
  let offered: ChatAction | undefined
  const asked = [...input.history.filter((m) => m.role === "person").map((m) => m.text), input.text]
  const offer = (raw: unknown): Proposal => {
    if (offered) return { content: JSON.stringify({ error: "You already offered an option in this answer." }), isError: true }
    const p = proposeOption(input.ctx, (raw ?? {}) as { option_id?: unknown; summary?: unknown }, chatSummary(asked))
    if (p.action) {
      offered = p.action
      input.emit({ type: "action", action: p.action })
    }
    return p
  }
  return { offer, offered: () => offered }
}

function userText(input: { text: string; via: "text" | "voice" }): string {
  if (input.via !== "voice") return input.text
  return asksForDetail(input.text)
    ? `${input.text}\n\n(Said by voice, asking for detail: answer in at most ${DETAIL_WORDS.voice} words, easy to listen to, with the specific names, times and words from your lookups.)`
    : `${input.text}\n\n(Said by voice: answer in at most 35 words, easy to listen to.)`
}

/** The newest question carries the word budget, where the model weighs it most. An explicit ask for detail gets the larger one. */
export function wordBudget(input: Pick<AnswerInput, "via" | "shape"> & { text?: string }): number {
  const detail = !!input.text && asksForDetail(input.text)
  if (input.via === "voice") return detail ? DETAIL_WORDS.voice : 35
  return detail ? DETAIL_WORDS.text : input.shape.experienced ? 45 : 90
}

const DETAIL_HINT =
  "The person asked for detail: look up what the question touches first, then give the specifics from the records. Names and roles, phone numbers, times, " +
  "what each message or call said in the writer's own words with the English, what is on file and what is missing. No summary in place of the words; nothing the records do not hold. " +
  "Write it as plain sentences: no numbered or bulleted lists, no bold."

function lastUserText(input: AnswerInput): string {
  const n = wordBudget(input)
  if (input.via === "voice") return userText(input)
  if (n === DETAIL_WORDS.text && asksForDetail(input.text)) return `${input.text}\n\n(${DETAIL_HINT} One or two short paragraphs, at most ${n} words. This is a hard limit.)`
  const shape = n <= 45 ? "two or three short sentences" : "a short paragraph"
  return `${input.text}\n\n(Answer in ${shape}, at most ${n} words. This is a hard limit.)`
}

function apiMessages(input: AnswerInput): BetaMessageParam[] {
  const turns = input.history.filter((m) => m.text.trim())
  while (turns.length && turns[0].role === "agent") turns.shift()
  const messages: BetaMessageParam[] = turns.map((m) => ({ role: m.role === "person" ? ("user" as const) : ("assistant" as const), content: m.role === "person" ? userText(m) : m.text }))
  messages.push({ role: "user", content: lastUserText(input) })
  return messages
}

export async function answer(input: AnswerInput, provider: ChatProvider = chatProvider()): Promise<AnswerResult> {
  if (provider === "api") return apiAnswer(input)
  if (provider === "claude-code") return sdkAnswer(input)
  return mockRun(input)
}

// ---------- mock ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function mockRun(input: AnswerInput): Promise<AnswerResult> {
  const delay = Number(process.env.CR_CHAT_MOCK_DELAY_MS ?? 0)
  const steps = new Steps(input.ctx, input.emit)
  const plan = mockPlan(input.text, input.ctx)
  const results: Partial<Record<ChatToolName, string>> = {}
  for (const name of plan.tools) {
    if (delay) await sleep(delay * 4)
    results[name] = (await steps.call(name)).content
  }
  const { offer, offered } = offerer(input)
  const proposal = plan.intent === "act" && plan.optionId ? offer({ option_id: plan.optionId }) : undefined
  const text = mockAnswer({
    ctx: input.ctx, knowledge: input.knowledge, plan, results, via: input.via, experienced: input.shape.experienced,
    turn: input.history.filter((m) => m.role === "agent").length, offered: proposal?.action,
  })
  // Stream it the way a model does: a few words at a time.
  const parts = text.match(/\S+\s*/g) ?? [text]
  for (let i = 0; i < parts.length; i += 3) {
    if (input.signal?.aborted) break
    if (delay) await sleep(delay)
    input.emit({ type: "delta", text: parts.slice(i, i + 3).join("") })
  }
  return { text, toolSteps: steps.list, action: offered(), provider: "mock", model: "mock" }
}

// ---------- Anthropic API (streamed) ----------

async function apiAnswer(input: AnswerInput): Promise<AnswerResult> {
  const { anthropic } = await import("@/lib/agent/llm")
  const model = chatModel()
  const steps = new Steps(input.ctx, input.emit)
  const system = chatSystem(input.ctx, input.knowledge, input.shape, input.opener)
  const messages = apiMessages(input)
  const { offer, offered } = offerer(input)
  const tools = [...chatApiTools(), proposeApiTool(input.ctx)]
  const fallback = supportsDefaultFallback(model)
  let text = ""
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (turn > 0) input.emit({ type: "thinking" })
    const last = turn === MAX_TURNS - 1
    const stream = anthropic().beta.messages.stream(
      {
        model,
        max_tokens: 4000,
        system,
        messages,
        tools,
        ...(last ? { tool_choice: { type: "none" as const } } : {}),
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        cache_control: { type: "ephemeral" },
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: input.signal },
    )
    let started = false
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
        const piece = !started && text && !/\s$/.test(text) ? `\n${ev.delta.text}` : ev.delta.text
        started = true
        text += piece
        input.emit({ type: "delta", text: piece })
      }
    }
    const message = await stream.finalMessage()
    if (message.stop_reason === "refusal") {
      if (!text.trim()) {
        text = "I cannot answer that one here. The facts are on the case, and the decision is yours."
        input.emit({ type: "delta", text })
      }
      break
    }
    const uses = message.content.filter((b): b is Extract<(typeof message.content)[number], { type: "tool_use" }> => b.type === "tool_use")
    if (!uses.length || message.stop_reason !== "tool_use") break
    messages.push({ role: "assistant", content: message.content as BetaMessageParam["content"] })
    const results = await Promise.all(uses.map(async (u) => {
      const r = u.name === PROPOSE_TOOL ? offer(u.input) : await steps.call(u.name)
      return { type: "tool_result" as const, tool_use_id: u.id, content: r.content, ...(r.isError ? { is_error: true } : {}) }
    }))
    messages.push({ role: "user", content: results })
  }
  return { text: text.trim(), toolSteps: steps.list, action: offered(), provider: "api", model }
}

// ---------- Claude Code (Agent SDK) ----------

const MCP = "chat"

/** The only tools Claude Code may use in the chat: the chat's read-only tools and propose_option, by their MCP names. No built-in tool. */
export const SDK_ALLOWED_TOOLS = [...CHAT_TOOLS, PROPOSE_TOOL].map((n) => `mcp__${MCP}__${n}`)

function transcript(input: AnswerInput): string {
  const turns = input.history.filter((m) => m.text.trim()).map((m) => `${m.role === "person" ? input.ctx.person.name : "You"}: ${m.text}`)
  const now = `${input.ctx.person.name}: ${lastUserText(input)}`
  return turns.length ? `The conversation so far:\n${turns.join("\n\n")}\n\nNow:\n${now}` : now
}

async function sdkAnswer(input: AnswerInput): Promise<AnswerResult> {
  const { agentSdk } = await import("@/lib/agent/sdk")
  const { createSdkMcpServer, query, tool } = await agentSdk()
  const model = chatModel()
  const steps = new Steps(input.ctx, input.emit)
  const { offer, offered } = offerer(input)
  const { z } = await import("zod")
  const server = createSdkMcpServer({
    name: MCP,
    version: "1.0.0",
    alwaysLoad: true,
    tools: [
      ...CHAT_TOOLS.map((name) =>
        tool(name, CHAT_TOOL_DESCRIPTIONS[name], {}, async () => {
          const r = await steps.call(name)
          return { content: [{ type: "text" as const, text: r.content }], ...(r.isError ? { isError: true } : {}) }
        }),
      ),
      tool(PROPOSE_TOOL, PROPOSE_DESCRIPTION, { option_id: z.string(), summary: z.string() }, async (args) => {
        const r = offer(args)
        return { content: [{ type: "text" as const, text: r.content }], ...(r.isError ? { isError: true } : {}) }
      }),
    ],
  })
  const abort = new AbortController()
  input.signal?.addEventListener("abort", () => abort.abort())
  const timer = setTimeout(() => abort.abort(), 120_000)
  let text = ""
  let final = ""
  let turns = 0
  try {
    const q = query({
      prompt: transcript(input),
      options: {
        systemPrompt: chatSystem(input.ctx, input.knowledge, input.shape, input.opener),
        model,
        mcpServers: { [MCP]: server },
        tools: [],
        allowedTools: SDK_ALLOWED_TOOLS,
        settingSources: [],
        persistSession: false,
        permissionMode: "dontAsk",
        maxTurns: MAX_TURNS + 2,
        thinking: { type: "adaptive" },
        effort: "low",
        cwd: paths.starter(),
        env: claudeCodeEnv(),
        includePartialMessages: true,
        abortController: abort,
      },
    })
    let started = false
    for await (const m of q) {
      if (m.type === "stream_event" && !m.parent_tool_use_id) {
        const ev = m.event
        if (ev.type === "message_start") {
          if (turns++ > 0) input.emit({ type: "thinking" })
          started = false
        }
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
          const piece = !started && text && !/\s$/.test(text) ? `\n${ev.delta.text}` : ev.delta.text
          started = true
          text += piece
          input.emit({ type: "delta", text: piece })
        }
      } else if (m.type === "result") {
        if (m.subtype !== "success") throw new Error(`Claude Code stopped: ${m.subtype}`)
        final = m.result
      }
    }
  } finally {
    clearTimeout(timer)
  }
  if (!text.trim() && final.trim()) {
    text = final
    input.emit({ type: "delta", text })
  }
  return { text: text.trim(), toolSteps: steps.list, action: offered(), provider: "claude-code", model }
}
