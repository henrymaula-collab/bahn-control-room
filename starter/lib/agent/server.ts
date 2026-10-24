// Shared setup for the agent's API routes: the foundation's tables, the LLM
// lesson summariser, and the provider (replay unless CR_AGENT_PROVIDER says
// otherwise, so a fresh clone without a model still demos).

import { agentProvider, effectiveProvider, type Provider } from "./config"
import { registerAgentHooks } from "./hooks"
import { initStore } from "./store"

let ready: Promise<unknown> | undefined

export async function agentServer(): Promise<void> {
  if (!ready) ready = initStore(process.env.CR_AGENT_STORE ?? "foundation").then(() => registerAgentHooks())
  await ready
}

export function routeProvider(requested?: string): Provider {
  const allowed = ["claude-code", "api", "mock", "replay"]
  return effectiveProvider(requested && allowed.includes(requested) ? (requested as Provider) : agentProvider("replay"))
}
