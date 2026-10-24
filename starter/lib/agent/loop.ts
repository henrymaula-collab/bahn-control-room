// The Readiness desk agent loop. One run = one order. Three providers drive
// the same tools: the Anthropic API (manual tool loop), Claude Code through
// the Claude Agent SDK (our tools as an in-process MCP server, nothing else
// allowed), and a deterministic mock. Every run is an AgentRun with a JSONL
// trace; without a model, replay plays a recorded trace back.

import { z } from "zod"
import type { Case, Call, Decision, Lesson } from "@/lib/control-room/types"
import { RunClock, worldNow } from "./clock"
import { agentModel, callModel, claudeCodeEnv, effectiveProvider, emptyUsage, guards, paths, type Provider } from "./config"
import { findOrder, site } from "./data"
import { FactRegistry } from "./facts"
import { createTurn, type BetaContentBlock, type BetaMessage, type BetaMessageParam } from "./llm"
import { mockTurn } from "./mock-policy"
import { firstMessage, SYSTEM_PROMPT, type CallbackBrief } from "./prompt"
import { getStore, type StoredRun } from "./store"
import { apiToolDefinitions, executeTool, TOOL_DESCRIPTIONS, TOOL_NAMES, TOOL_SHAPES, type RunContext } from "./tools"
import { listTraces, readTrace, TraceWriter, type TraceLine, type TraceSummary } from "./trace"
import { audioUrlFor } from "./voices"
import { plainWordsDeep } from "./wording"
import { agentSdk } from "./sdk"
import type { TrustRule } from "./gate"

export interface RunOptions {
  provider?: Provider
  callback?: CallbackBrief
  startAt?: Date
  onStep?: (step: StoredRun["steps"][number]) => void
}

export interface RunResult {
  run: StoredRun
  case?: Case
  calls: Call[]
  traceFile: string
  handover: string
}

const MCP_SERVER = "readiness"

function runIdFor(orderRef: string, callback?: CallbackBrief): string {
  const t = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")
  return `run-${orderRef.toLowerCase()}-${callback ? "cb-" : ""}${t}-${Math.random().toString(36).slice(2, 5)}`
}

export async function runReadinessAgent(orderRef: string, opts: RunOptions = {}): Promise<RunResult> {
  const order = findOrder(orderRef)
  if (!order) throw new Error(`No order ${orderRef} in the dataset.`)
  const provider = effectiveProvider(opts.provider)
  if (provider === "replay") return replayLatest(order.reference, opts)
  await installDemoDepthIfPresent()

  const store = getStore()
  const runId = runIdFor(order.reference, opts.callback)
  const clock = new RunClock(opts.startAt ?? worldNow())
  const model = provider === "mock" ? "mock" : agentModel()
  const trace = new TraceWriter(runId, opts.onStep)
  const usage = emptyUsage()
  const run: StoredRun = { id: runId, agent: "readiness", orderId: order.id, model, startedAt: clock.now(), steps: [], outcome: "waiting", mode: provider === "mock" ? "mock" : "live" }
  trace.write({ type: "run", run, orderRef: order.reference, provider })

  const [lessons, decisions, trustRules, cases] = await Promise.all([store.listLessons(), store.listDecisions(), store.listTrustRules(), store.listCases()])
  const ctx: RunContext = {
    runId,
    provider,
    callModel: provider === "mock" ? "mock" : callModel(),
    order,
    clock,
    registry: new FactRegistry(runId.replace(/^run-/, "")),
    store,
    usage,
    trace,
    steps: [],
    calls: [],
    lessonsUsed: [],
    snap: { lessons, decisions, trustRules: trustRules as TrustRule[], cases },
    callbackFor: opts.callback,
  }
  const prompt = firstMessage(order.reference, clock.now(), opts.callback)
  trace.step("message", prompt, clock.now(), "brief")

  let handover = ""
  let error: string | undefined
  try {
    handover = provider === "claude-code" ? await sdkLoop(ctx, prompt, model) : await manualLoop(ctx, prompt, model, provider)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    trace.step("message", `Stopped with an error: ${error}`, clock.now(), "error")
  }

  if (ctx.outcome?.kind === "waiting" && !ctx.outcome.caseId && !opts.callback) await writeWaitingCase(ctx)
  const outcome: StoredRun["outcome"] = error && !ctx.outcome ? "error" : ctx.outcome?.kind ?? (error ? "error" : "waiting")
  const finished: StoredRun = {
    ...run,
    endedAt: clock.now(),
    steps: trace.steps(),
    outcome,
    ...(ctx.outcome?.caseId ? { caseId: ctx.outcome.caseId } : {}),
    usage: { ...usage, usd: Math.round(usage.usd * 10000) / 10000 },
    callIds: ctx.calls.map((c) => c.id),
  }
  trace.write({ type: "facts", facts: ctx.registry.all() })
  trace.write({ type: "end", run: finished })
  await store.saveRun(finished)
  const theCase = ctx.outcome?.caseId ? await store.getCase(ctx.outcome.caseId) : undefined
  return { run: finished, case: theCase, calls: ctx.calls, traceFile: trace.file, handover: handover || ctx.outcome?.summary || error || "" }
}

/**
 * The demo orders' hand-made records (lib/demo/overlay.ts) in the read tools' table cache, as the
 * chat sees them, so a live run on a demo order reads the same threads, documents and contacts.
 * Optional: a build without lib/demo runs on the packet alone.
 */
async function installDemoDepthIfPresent(): Promise<void> {
  try {
    const { installDemoDepth } = await import("@/lib/demo/overlay")
    installDemoDepth()
  } catch {
    // no demo overlay in this build
  }
}

/**
 * The agent is still on it (nobody answered, a follow-up is promised): the
 * order shows as "agent working" with what was done, instead of a person's case.
 */
async function writeWaitingCase(ctx: RunContext): Promise<void> {
  const callbacks = (await ctx.store.listCallbacks()).filter((c) => c.createdByRunId === ctx.runId && c.status === "scheduled")
  const next = callbacks.sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  if (!next) return
  const place = site(ctx.order.pickup_site_id)
  const tz = place?.timezone ?? "Europe/Helsinki"
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(next.dueAt))
  const noAnswer = ctx.calls.some((c) => c.outcome === "no_answer")
  const placeName = place?.name ?? "The pickup place"
  const factIds = new Set<string>([...ctx.calls.flatMap((c) => c.factIds), ...ctx.steps.filter((s) => s.kind === "message" || s.kind === "ask").flatMap((s) => s.factIds ?? [])])
  const slot = ctx.registry.all().find((f) => /^Selected pickup slot/.test(f.statement))
  if (slot) factIds.add(slot.id)
  const id = `case-${ctx.order.id}-agent`
  const theCase: Case = {
    id,
    orderId: ctx.order.id,
    desk: "ops-readiness",
    type: noAnswer ? "readiness.no_answer" : "readiness.keys_or_access",
    headline: noAnswer ? `${placeName} did not answer. The agent wrote to them and calls again at ${when}.` : `The agent is waiting: ${next.reason}`,
    decideBy: next.dueAt,
    reasons: noAnswer ? ["pickup_place_not_answering"] : [],
    facts: [...factIds].map((f) => ctx.registry.get(f)).filter((f): f is NonNullable<typeof f> => Boolean(f)),
    agentSteps: [...ctx.steps],
    suggestion: { id: "keep_slot_call_again", label: "Keep the slot and call the pickup place again", effect: `The agent calls again at ${when} and brings you a decision if they still do not answer.`, changes: [] },
    alternatives: [],
    status: "agent_working",
    placeId: place?.id,
    customerId: ctx.order.customer_id,
    createdAt: ctx.clock.now(),
  }
  for (const c of ctx.calls) c.caseId = c.caseId ?? id
  await ctx.store.saveCase(theCase)
  for (const c of ctx.calls) await ctx.store.saveCall(c)
  ctx.trace.write({ type: "case", case: theCase })
  ctx.outcome = { kind: "waiting", caseId: id, summary: theCase.headline }
}

function overBudget(ctx: RunContext, started: number): string | undefined {
  if ((Date.now() - started) / 1000 > guards.maxSeconds) return `time limit (${guards.maxSeconds} s)`
  // Claude Code reports a nominal cost on a subscription login; the money guard is for the API.
  if (ctx.provider === "api" && ctx.usage.usd > guards.maxUsd) return `cost limit (USD ${guards.maxUsd})`
  return undefined
}

function recordBlocks(ctx: RunContext, content: BetaContentBlock[]): string {
  let lastText = ""
  for (const b of content) {
    if (b.type === "thinking" && b.thinking.trim()) ctx.trace.step("thinking", b.thinking, ctx.clock.now())
    if (b.type === "text" && b.text.trim()) {
      ctx.trace.step("message", b.text, ctx.clock.now())
      lastText = b.text
    }
  }
  return lastText
}

async function manualLoop(ctx: RunContext, prompt: string, model: string, provider: Provider): Promise<string> {
  const messages: BetaMessageParam[] = [{ role: "user", content: prompt }]
  const tools = provider === "api" ? apiToolDefinitions() : []
  const started = Date.now()
  let handover = ""
  let endedWork = false
  for (let turn = 0; turn < guards.maxModelTurns; turn++) {
    const over = overBudget(ctx, started)
    if (over) {
      ctx.trace.step("message", `Stopped at the ${over}. Handing over what I found so far.`, ctx.clock.now(), "guard")
      break
    }
    const response: BetaMessage =
      provider === "mock"
        ? mockTurn(messages)
        : await createTurn({ model, system: SYSTEM_PROMPT, messages, tools: tools as never, effort: "medium", maxTokens: 16000 }, ctx.usage)
    ctx.clock.advance(provider === "mock" ? 1 : 3)
    if (response.stop_reason === "refusal") throw new Error("The model declined this request.")
    const text = recordBlocks(ctx, response.content)
    if (text) handover = text
    messages.push({ role: "assistant", content: response.content as BetaMessageParam["content"] })
    const uses = response.content.filter((b): b is Extract<BetaContentBlock, { type: "tool_use" }> => b.type === "tool_use")
    if (uses.length === 0 || endedWork) break
    if (response.stop_reason === "max_tokens") throw new Error("The model's tool input was cut off (max_tokens).")
    const results = []
    for (const u of uses) {
      const r = await executeTool(ctx, u.name, u.input)
      if (r.terminal) endedWork = true
      results.push({ type: "tool_result" as const, tool_use_id: u.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })
    }
    messages.push({ role: "user", content: results })
  }
  return handover
}

async function sdkLoop(ctx: RunContext, prompt: string, model: string): Promise<string> {
  const { createSdkMcpServer, query, tool } = await agentSdk()
  const server = createSdkMcpServer({
    name: MCP_SERVER,
    version: "1.0.0",
    alwaysLoad: true,
    tools: TOOL_NAMES.map((name) =>
      tool(name, TOOL_DESCRIPTIONS[name], TOOL_SHAPES[name] as z.ZodRawShape, async (args: Record<string, unknown>) => {
        const r = await executeTool(ctx, name, args)
        return { content: [{ type: "text" as const, text: r.content }], ...(r.isError ? { isError: true } : {}) }
      }),
    ),
  })
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), guards.maxSeconds * 1000)
  let handover = ""
  try {
    const q = query({
      prompt,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        model,
        mcpServers: { [MCP_SERVER]: server },
        tools: [],
        allowedTools: TOOL_NAMES.map((n) => `mcp__${MCP_SERVER}__${n}`),
        settingSources: [],
        persistSession: false,
        permissionMode: "dontAsk",
        maxTurns: guards.maxModelTurns,
        thinking: { type: "adaptive", display: "summarized" },
        effort: "medium",
        cwd: paths.starter(),
        env: claudeCodeEnv(),
        abortController: abort,
      },
    })
    for await (const m of q) {
      if (m.type === "assistant" && !m.parent_tool_use_id) {
        const text = recordBlocks(ctx, m.message.content as BetaContentBlock[])
        if (text) handover = text
        ctx.clock.advance(3)
      } else if (m.type === "result") {
        ctx.usage.inputTokens += m.usage.input_tokens ?? 0
        ctx.usage.outputTokens += m.usage.output_tokens ?? 0
        ctx.usage.cacheReadTokens += m.usage.cache_read_input_tokens ?? 0
        ctx.usage.cacheWriteTokens += m.usage.cache_creation_input_tokens ?? 0
        ctx.usage.usd += m.total_cost_usd ?? 0
        if (m.subtype !== "success") {
          ctx.trace.step("message", `Stopped: ${m.subtype}${"errors" in m && m.errors?.length ? ` (${m.errors.join("; ")})` : ""}. Handing over what I found so far.`, ctx.clock.now(), "guard")
        }
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return handover
}

// ---------- replay ----------

export interface ReplayOptions {
  onStep?: RunOptions["onStep"]
  delayMs?: number
  /**
   * Carrying out a decision a person just made (POST /api/cr/agent/carry-out):
   * the recorded call-back is put onto the case as it is now. The case keeps
   * its live suggestion, routing and the person's "decided" step; the recorded
   * run adds its own steps, facts and calls and marks the case done. The live
   * decision already saved the decision, the case record and the lesson, so
   * the recorded ones are left out.
   */
  ontoLive?: boolean
}

const decidedStep = (s: Case["agentSteps"][number]) => s.kind === "propose" && / decided: /.test(s.summary)

/** The recorded call-back's work on top of the live case (see ReplayOptions.ontoLive). */
export function ontoLiveCase(live: Case, recorded: Case, startedAt: string): Case {
  const key = (s: Case["agentSteps"][number]) => `${s.at}|${s.kind}|${s.summary}`
  const have = new Set(live.agentSteps.map(key))
  // The run's own steps start at its start time; earlier ones are the case as it was when recorded.
  // The recorded why belongs to the recording's decision; the live one is in the case record.
  const added = recorded.agentSteps
    .filter((s) => s.at >= startedAt && !decidedStep(s))
    .map((s) => (s.kind === "message" ? { ...s, summary: s.summary.replace(/^(Carried out the decision: [\s\S]*?)\. Why: [\s\S]*$/, "$1.") } : s))
    .filter((s) => !have.has(key(s)))
  return {
    ...live,
    status: recorded.status,
    facts: [...live.facts, ...recorded.facts.filter((f) => !live.facts.some((e) => e.id === f.id))],
    agentSteps: [...live.agentSteps, ...added],
  }
}

export async function replayTrace(file: string, opts: ReplayOptions = {}): Promise<RunResult> {
  // Recordings stay verbatim on disk; what reaches the control room is in today's wording (wording.ts).
  const lines = readTrace(file).map((l) => plainWordsDeep(l))
  const store = getStore()
  const head = lines.find((l): l is Extract<TraceLine, { type: "run" }> => l.type === "run")
  const end = lines.find((l): l is Extract<TraceLine, { type: "end" }> => l.type === "end")
  if (!head || !end) throw new Error(`Trace ${file} is incomplete.`)
  const calls: Call[] = []
  let theCase: Case | undefined
  const decisions: Decision[] = []
  const lessons: Lesson[] = []
  const rules: TrustRule[] = []
  for (const l of lines) {
    if (l.type === "step") {
      opts.onStep?.(l.step)
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
    }
    if (l.type === "call") {
      const audioUrl = audioUrlFor(l.call.id)
      const i = calls.findIndex((c) => c.id === l.call.id)
      const call = { ...l.call, ...(audioUrl ? { audioUrl } : {}) }
      if (i >= 0) calls[i] = call
      else calls.push(call)
    }
    if (l.type === "case") theCase = l.case
    if (l.type === "decision") decisions.push(l.decision)
    if (l.type === "lesson") lessons.push(l.lesson)
    if (l.type === "trust_rule") rules.push(l.rule)
  }
  if (theCase) {
    const audioCalls = calls.map((c) => ({ ...c, caseId: c.caseId ?? theCase!.id }))
    calls.splice(0, calls.length, ...audioCalls)
  }
  let liveDecision = false
  if (theCase && opts.ontoLive) {
    const live = await store.getCase(theCase.id)
    liveDecision = (await store.listDecisions()).some((d) => d.caseId === theCase!.id)
    if (live) theCase = ontoLiveCase(live, theCase, head.run.startedAt)
  }
  if (theCase) await store.saveCase(theCase)
  for (const c of calls) await store.saveCall(c)
  if (liveDecision) {
    decisions.splice(0)
    lessons.splice(0)
  }
  for (const d of decisions) await store.saveDecision(d)
  // Never take a lesson back from accepted to proposed by replaying an older line.
  const existingLessons = lessons.length ? await store.listLessons() : []
  for (const l of lessons) {
    const existing = existingLessons.find((x) => x.id === l.id)
    if (existing?.status === "accepted" && l.status === "proposed") continue
    await store.saveLesson(l)
  }
  // A run that acted under a trust rule restores that rule as it was (ON, who turned it on).
  const existingRules = rules.length ? await store.listTrustRules() : []
  for (const r of rules) {
    const existing = existingRules.find((x) => x.id === r.id)
    await store.saveTrustRule(existing ? { ...existing, status: r.status, changedBy: r.changedBy, changedAt: r.changedAt } : r)
  }
  const run: StoredRun = { ...end.run, mode: "replay", replayOf: end.run.id }
  await store.saveRun(run)
  const lastMessage = [...end.run.steps].reverse().find((s) => s.type === "message" && !s.name)
  return { run, case: theCase, calls, traceFile: file, handover: lastMessage?.content ?? "" }
}

/** The newest recorded run for this order; real-model traces before mock ones. */
export async function replayLatest(orderRef: string, opts: RunOptions = {}): Promise<RunResult> {
  const pick = recordingFor(orderRef, opts.callback)
  if (!pick) throw new Error(`No recorded ${opts.callback ? "call-back" : "run"} for ${orderRef}. Set CR_AGENT_PROVIDER=claude-code, api or mock to run the agent.`)
  return replayTrace(pick.file, { onStep: opts.onStep, ontoLive: Boolean(opts.callback) })
}

/**
 * The recording replay mode plays for an order. Carrying out a decision replays a recorded call-back,
 * for the option the person chose when one was recorded; a first look replays a first run. A first
 * look is never replayed as a call-back: it would put a decided case back to waiting.
 */
export function recordingFor(orderRef: string, callback?: Pick<CallbackBrief, "optionKey">): TraceSummary | undefined {
  const traces = listTraces().filter((t) => t.orderRef.toUpperCase() === orderRef.toUpperCase() && t.outcome !== "unfinished" && t.outcome !== "error")
  const kind = traces.filter((t) => (callback ? t.runId.includes("-cb-") : !t.runId.includes("-cb-")))
  const sameOption = callback ? kind.filter((t) => t.optionKey === callback.optionKey) : kind
  const pool = callback ? (sameOption.length ? sameOption : kind) : kind.length ? kind : traces
  return pool.find((t) => t.provider === "api") ?? pool.find((t) => t.provider === "claude-code") ?? pool[0]
}

/** Replay every recorded run (or one order's), oldest first, into the store. */
export async function replayAll(orderRef?: string): Promise<{ runId: string; order: string; outcome: string }[]> {
  const traces = listTraces()
    .filter((t) => t.outcome !== "unfinished" && t.outcome !== "error")
    .filter((t) => !orderRef || t.orderRef.toUpperCase() === orderRef.toUpperCase())
    .reverse()
  const out: { runId: string; order: string; outcome: string }[] = []
  for (const t of traces) {
    const r = await replayTrace(t.file)
    out.push({ runId: t.runId, order: t.orderRef, outcome: r.run.outcome })
  }
  return out
}
