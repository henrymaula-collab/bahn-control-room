// Thin wrapper over the official Anthropic SDK for the agent loop, the
// simulated call and lesson summaries. One place sets the model options:
// adaptive thinking with summarized display (readable traces), explicit
// effort, top-level prompt caching, and the server-side refusal fallback on
// models that support it.

import fs from "node:fs"
import path from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
import { addUsage, paths, supportsDefaultFallback, type Usage } from "./config"

let client: Anthropic | undefined

/**
 * The project's key from starter/.env.local wins over the shell's: Henry's shell
 * exports an older, invalid ANTHROPIC_API_KEY, and Next.js does not let .env
 * files override variables that are already set.
 */
function projectKey(): string | undefined {
  try {
    const file = path.join(paths.starter(), ".env.local")
    if (fs.existsSync(file)) return dotenv.parse(fs.readFileSync(file)).ANTHROPIC_API_KEY?.trim() || undefined
  } catch {
    // fall back to the environment
  }
  return undefined
}

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: projectKey() ?? process.env.ANTHROPIC_API_KEY, maxRetries: 3, timeout: 120_000 })
  return client
}

export type Effort = "low" | "medium" | "high"
export type BetaMessage = Anthropic.Beta.Messages.BetaMessage
export type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam
export type BetaTool = Anthropic.Beta.Messages.BetaTool
export type BetaContentBlock = Anthropic.Beta.Messages.BetaContentBlock

export interface TurnParams {
  model: string
  system: string
  messages: BetaMessageParam[]
  tools?: BetaTool[]
  effort?: Effort
  maxTokens?: number
  format?: Record<string, unknown> // JSON schema for structured output
}

export async function createTurn(p: TurnParams, usage?: Usage): Promise<BetaMessage> {
  const fallback = supportsDefaultFallback(p.model)
  const response = await anthropic().beta.messages.create({
    model: p.model,
    max_tokens: p.maxTokens ?? 16000,
    system: p.system,
    messages: p.messages,
    ...(p.tools ? { tools: p.tools } : {}),
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: p.effort ?? "medium", ...(p.format ? { format: { type: "json_schema", schema: p.format } } : {}) },
    cache_control: { type: "ephemeral" },
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  })
  if (usage) addUsage(usage, response.model ?? p.model, response.usage)
  return response
}

export function textOf(message: BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
}

/** One structured-output call. Throws on refusal or a cut-off answer. */
export async function jsonTurn<T>(p: TurnParams & { format: Record<string, unknown> }, usage?: Usage): Promise<T> {
  const message = await createTurn({ ...p, effort: p.effort ?? "low", maxTokens: p.maxTokens ?? 8000 }, usage)
  if (message.stop_reason === "refusal") throw new Error("The model declined this request.")
  if (message.stop_reason === "max_tokens") throw new Error("The model's answer was cut off.")
  const text = textOf(message)
  return JSON.parse(text) as T
}
