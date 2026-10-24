// One structured model call (a JSON answer to one prompt), whichever provider
// runs it. The simulated phone call, the fact extraction after a call and
// the lesson summaries use this. The agent loop itself lives in loop.ts.

import { query } from "@anthropic-ai/claude-agent-sdk"
import { claudeCodeEnv, paths, type Provider, type Usage } from "./config"
import { jsonTurn, type Effort } from "./llm"

export interface StructuredParams {
  provider: Provider
  model: string
  system: string
  prompt: string
  schema: Record<string, unknown>
  effort?: Effort
}

export async function structured<T>(p: StructuredParams, usage?: Usage): Promise<T> {
  if (p.provider === "api") {
    return jsonTurn<T>({ model: p.model, system: p.system, messages: [{ role: "user", content: p.prompt }], format: p.schema, effort: p.effort ?? "low" }, usage)
  }
  if (p.provider === "claude-code") {
    const q = query({
      prompt: p.prompt,
      options: {
        systemPrompt: p.system,
        model: p.model,
        tools: [],
        allowedTools: [],
        settingSources: [],
        persistSession: false,
        permissionMode: "dontAsk",
        maxTurns: 3,
        cwd: paths.starter(),
        env: claudeCodeEnv(),
        thinking: { type: "adaptive" },
        effort: p.effort ?? "low",
        outputFormat: { type: "json_schema", schema: p.schema },
      },
    })
    for await (const m of q) {
      if (m.type !== "result") continue
      if (usage) {
        usage.inputTokens += m.usage.input_tokens ?? 0
        usage.outputTokens += m.usage.output_tokens ?? 0
        usage.cacheReadTokens += m.usage.cache_read_input_tokens ?? 0
        usage.cacheWriteTokens += m.usage.cache_creation_input_tokens ?? 0
        usage.usd += m.total_cost_usd ?? 0
      }
      if (m.subtype !== "success") throw new Error(`Claude Code stopped: ${m.subtype}${"errors" in m && m.errors?.length ? ` (${m.errors.join("; ")})` : ""}`)
      if (m.structured_output !== undefined && m.structured_output !== null) return m.structured_output as T
      return JSON.parse(m.result) as T
    }
    throw new Error("Claude Code returned no result.")
  }
  throw new Error(`No model call in ${p.provider} mode.`)
}
