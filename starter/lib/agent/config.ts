// Settings for the Readiness desk agent. Everything comes from env so the master
// can swap models or paths without touching code. Never log a key.

import fs from "node:fs"
import path from "node:path"

/**
 * Who runs the model:
 *   claude-code = Claude Agent SDK through the local Claude Code login (default for local dev, no API credits)
 *   api         = Anthropic API with ANTHROPIC_API_KEY from starter/.env.local (production, final recorded traces)
 *   mock        = deterministic stand-in behind the same tools (no model at all)
 *   replay      = no model: replay a recorded trace (a fresh clone without a key)
 */
export type Provider = "claude-code" | "api" | "mock" | "replay"

export function agentProvider(fallback: Provider = "claude-code"): Provider {
  const raw = process.env.CR_AGENT_PROVIDER?.trim().toLowerCase()
  if (raw === "claude-code" || raw === "api" || raw === "mock" || raw === "replay") return raw
  if (process.env.CR_AGENT_MODEL?.trim() === "mock") return "mock"
  return fallback
}

/** Env for the Claude Code child process: without ANTHROPIC_API_KEY, so it uses the login (an invalid shell key would break auth). */
export function claudeCodeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "bahn-control-room/0.1" }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  return env
}

const starterRoot = () => process.env.CR_STARTER_ROOT ?? process.cwd()

export const paths = {
  starter: () => starterRoot(),
  dataset: () => process.env.DATASET_DIR ?? path.resolve(starterRoot(), "..", "dataset", "data"),
  dataDir: () => process.env.CR_DATA_DIR ?? path.resolve(starterRoot(), ".cr-data"),
  traces: () => process.env.CR_TRACES_DIR ?? path.resolve(starterRoot(), "traces"),
  calls: () => path.resolve(starterRoot(), "public", "calls"),
  scenarios: () => path.resolve(starterRoot(), "lib", "agent", "sim", "scenarios.json"),
}

export const DEFAULT_MODEL = "claude-sonnet-5-5"

/** The model id the loop uses (the same name for the api and claude-code providers). */
export function agentModel(): string {
  const m = process.env.CR_AGENT_MODEL?.trim()
  return m && m !== "mock" ? m : DEFAULT_MODEL
}

/** The model both sides of the simulated phone call and the lesson summaries use. */
export function callModel(): string {
  return process.env.CR_CALL_MODEL?.trim() || agentModel()
}

export function hasAnthropicKey(): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return true
  try {
    return /^ANTHROPIC_API_KEY=\S+/m.test(fs.readFileSync(path.join(paths.starter(), ".env.local"), "utf8"))
  } catch {
    return false
  }
}

/** The api provider without a key cannot run: fall back to replay so a fresh clone still demos. */
export function effectiveProvider(requested?: Provider, fallback: Provider = "claude-code"): Provider {
  const p = requested ?? agentProvider(fallback)
  if (p === "api" && !hasAnthropicKey()) return "replay"
  return p
}

/** Guards so one run can never run away with time or money. */
export const guards = {
  maxModelTurns: Number(process.env.CR_AGENT_MAX_TURNS ?? 16),
  maxSeconds: Number(process.env.CR_AGENT_MAX_SECONDS ?? 300),
  maxUsd: Number(process.env.CR_AGENT_MAX_USD ?? 1.5),
  maxCallTurns: Number(process.env.CR_CALL_MAX_TURNS ?? 12),
}

/** USD per million tokens (input, output). Cache reads are cheaper; we count them at the cache-read rate. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  usd: number
}

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, usd: 0 })

export function addUsage(total: Usage, model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): Usage {
  const p = PRICES[model] ?? PRICES[DEFAULT_MODEL]
  const input = u.input_tokens ?? 0
  const output = u.output_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  const write = u.cache_creation_input_tokens ?? 0
  total.inputTokens += input
  total.outputTokens += output
  total.cacheReadTokens += read
  total.cacheWriteTokens += write
  total.usd += (input * p.input + output * p.output + read * p.cacheRead + write * p.cacheWrite) / 1_000_000
  return total
}

/** Models that accept the server-side refusal fallback ("default" form, Claude API). */
export function supportsDefaultFallback(model: string): boolean {
  return ["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"].includes(model) && process.env.CR_AGENT_FALLBACKS !== "off"
}
