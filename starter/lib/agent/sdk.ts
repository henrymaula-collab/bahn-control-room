// The Claude Agent SDK, loaded at run time. A variable specifier keeps
// Next.js from bundling it (it ships a native Claude Code binary); Node
// resolves it from node_modules when the claude-code provider runs.

import type * as Sdk from "@anthropic-ai/claude-agent-sdk"

const NAME = "@anthropic-ai/claude-agent-sdk"

export async function agentSdk(): Promise<typeof Sdk> {
  return (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ NAME)) as typeof Sdk
}
