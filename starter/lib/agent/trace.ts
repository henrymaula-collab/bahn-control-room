// Agent traces (Bahn asked for them). One JSONL file per run under
// starter/traces/<runId>.jsonl: the run header, every step (thinking, tool
// call, tool result, message), the Call and Case the run produced, and the
// final AgentRun with tokens and cost. No keys, no personal data: the
// dataset and the personas are made up. Replay reads the same file.

import fs from "node:fs"
import path from "node:path"
import type { AgentRun, Call, Case, Fact, OrderCheck } from "@/lib/control-room/types"
import { paths } from "./config"
import type { Callback, StoredRun } from "./store"

export type TraceLine =
  | { type: "run"; run: StoredRun; orderRef: string; provider: string }
  | { type: "step"; step: AgentRun["steps"][number] }
  | { type: "call"; call: Call }
  | { type: "case"; case: Case }
  | { type: "facts"; facts: Fact[] }
  | { type: "order_check"; check: OrderCheck }
  | { type: "callback"; callback: Callback }
  | { type: "end"; run: StoredRun }

const MAX_CONTENT = 8000

export class TraceWriter {
  readonly file: string
  private lines: TraceLine[] = []
  constructor(runId: string, private onStep?: (step: AgentRun["steps"][number]) => void) {
    fs.mkdirSync(paths.traces(), { recursive: true })
    this.file = path.join(paths.traces(), `${runId}.jsonl`)
    fs.writeFileSync(this.file, "")
  }

  write(line: TraceLine): void {
    this.lines.push(line)
    fs.appendFileSync(this.file, `${JSON.stringify(line)}\n`)
  }

  step(type: AgentRun["steps"][number]["type"], content: string, at: string, name?: string): AgentRun["steps"][number] {
    const text = content.length > MAX_CONTENT ? `${content.slice(0, MAX_CONTENT)} [cut, ${content.length} chars]` : content
    const step = { at, type, ...(name ? { name } : {}), content: text }
    this.write({ type: "step", step })
    this.onStep?.(step)
    return step
  }

  steps(): AgentRun["steps"] {
    return this.lines.filter((l): l is Extract<TraceLine, { type: "step" }> => l.type === "step").map((l) => l.step)
  }
}

export function readTrace(file: string): TraceLine[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as TraceLine)
}

export interface TraceSummary {
  runId: string
  file: string
  orderRef: string
  orderId: string
  provider: string
  model: string
  outcome: AgentRun["outcome"] | "unfinished"
  startedAt: string
  recordedAt: number
}

export function listTraces(): TraceSummary[] {
  const dir = paths.traces()
  if (!fs.existsSync(dir)) return []
  const out: TraceSummary[] = []
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
    const file = path.join(dir, f)
    try {
      const lines = readTrace(file)
      const head = lines.find((l): l is Extract<TraceLine, { type: "run" }> => l.type === "run")
      const end = lines.find((l): l is Extract<TraceLine, { type: "end" }> => l.type === "end")
      if (!head) continue
      out.push({
        runId: head.run.id,
        file,
        orderRef: head.orderRef,
        orderId: head.run.orderId,
        provider: head.provider,
        model: head.run.model,
        outcome: end?.run.outcome ?? "unfinished",
        startedAt: head.run.startedAt,
        recordedAt: fs.statSync(file).mtimeMs,
      })
    } catch {
      // a half-written trace is skipped
    }
  }
  return out.sort((a, b) => b.recordedAt - a.recordedAt)
}
