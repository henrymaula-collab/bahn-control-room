// Where the agent keeps what it writes (Cases, Calls, AgentRuns, lessons,
// trust rules, decisions, callbacks). Until the foundation tables are merged
// this is JSON files under starter/.cr-data/ (gitignored). The interface is
// small on purpose so the master can swap in lib/control-room/store.ts.

import fs from "node:fs"
import path from "node:path"
import type { AgentRun, Call, Case, Decision, Lesson, OrderCheck, TrustRule } from "@/lib/control-room/types"
import { paths } from "./config"

/** A follow-up the agent promised: call the pickup place again, or call back after a person decides. */
export interface Callback {
  id: string
  orderId: string
  placeId?: string
  caseId?: string
  dueAt: string
  reason: string
  status: "scheduled" | "done" | "cancelled"
  createdAt: string
  createdByRunId?: string
}

/** AgentRun plus what the trace also records (not part of the shared contract). */
export type StoredRun = AgentRun & {
  mode?: "live" | "mock" | "replay"
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; usd: number }
  callIds?: string[]
  replayOf?: string
}

export interface AgentStore {
  getCase(id: string): Promise<Case | undefined>
  listCases(): Promise<Case[]>
  saveCase(c: Case): Promise<void>
  getCall(id: string): Promise<Call | undefined>
  listCalls(): Promise<Call[]>
  saveCall(c: Call): Promise<void>
  getRun(id: string): Promise<StoredRun | undefined>
  listRuns(): Promise<StoredRun[]>
  saveRun(r: StoredRun): Promise<void>
  listLessons(): Promise<Lesson[]>
  saveLesson(l: Lesson): Promise<void>
  listTrustRules(): Promise<TrustRule[]>
  saveTrustRule(r: TrustRule): Promise<void>
  listDecisions(): Promise<Decision[]>
  saveDecision(d: Decision): Promise<void>
  listOrderChecks(): Promise<OrderCheck[]>
  saveOrderCheck(c: OrderCheck): Promise<void>
  listCallbacks(): Promise<Callback[]>
  saveCallback(c: Callback): Promise<void>
}

type Collection = "cases" | "calls" | "runs" | "lessons" | "trust_rules" | "decisions" | "order_checks" | "callbacks"

class JsonFileStore implements AgentStore {
  constructor(private dir: string) {}

  private file(name: Collection) {
    return path.join(this.dir, `${name}.json`)
  }

  private read<T>(name: Collection): T[] {
    const f = this.file(name)
    if (!fs.existsSync(f)) return []
    try {
      return JSON.parse(fs.readFileSync(f, "utf8")) as T[]
    } catch {
      return []
    }
  }

  private upsert<T extends { id?: string; orderId?: string }>(name: Collection, row: T, key: (r: T) => string) {
    fs.mkdirSync(this.dir, { recursive: true })
    const rows = this.read<T>(name)
    const k = key(row)
    const i = rows.findIndex((r) => key(r) === k)
    if (i >= 0) rows[i] = row
    else rows.push(row)
    const tmp = `${this.file(name)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2))
    fs.renameSync(tmp, this.file(name))
  }

  async getCase(id: string) { return this.read<Case>("cases").find((c) => c.id === id) }
  async listCases() { return this.read<Case>("cases") }
  async saveCase(c: Case) { this.upsert("cases", c, (r) => r.id) }
  async getCall(id: string) { return this.read<Call>("calls").find((c) => c.id === id) }
  async listCalls() { return this.read<Call>("calls") }
  async saveCall(c: Call) { this.upsert("calls", c, (r) => r.id) }
  async getRun(id: string) { return this.read<StoredRun>("runs").find((r) => r.id === id) }
  async listRuns() { return this.read<StoredRun>("runs") }
  async saveRun(r: StoredRun) { this.upsert("runs", r, (x) => x.id) }
  async listLessons() { return this.read<Lesson>("lessons") }
  async saveLesson(l: Lesson) { this.upsert("lessons", l, (r) => r.id) }
  async listTrustRules() { return this.read<TrustRule>("trust_rules") }
  async saveTrustRule(r: TrustRule) { this.upsert("trust_rules", r, (x) => x.id) }
  async listDecisions() { return this.read<Decision>("decisions") }
  async saveDecision(d: Decision) { this.upsert("decisions", d, (r) => r.id) }
  async listOrderChecks() { return this.read<OrderCheck>("order_checks") }
  async saveOrderCheck(c: OrderCheck) { this.upsert("order_checks", c, (r) => r.orderId) }
  async listCallbacks() { return this.read<Callback>("callbacks") }
  async saveCallback(c: Callback) { this.upsert("callbacks", c, (r) => r.id) }
}

let current: AgentStore | undefined

export function getStore(): AgentStore {
  if (!current) current = new JsonFileStore(paths.dataDir())
  return current
}

/** The master calls this once to point the agent at the foundation's store. */
export function setStore(store: AgentStore): void {
  current = store
}

export function resetLocalStore(): void {
  const dir = paths.dataDir()
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  current = undefined
}

export function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`
}
