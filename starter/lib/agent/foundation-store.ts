// The agent's store on top of the foundation's tables (lib/control-room/store.ts).
// Cases, calls, agent runs, lessons, trust rules and decisions go to Postgres
// so the control room sees them. What the foundation has no table for (the
// agent's own order checks and promised callbacks) stays in the local JSON
// store, which also mirrors calls and runs for quick lookups by id.

import type { Call, Case, Decision, Lesson, OrderCheck, TrustRule } from "@/lib/control-room/types"
import * as fs from "@/lib/control-room/store"
import { site } from "./data"
import type { AgentStore, Callback, StoredRun } from "./store"

export class FoundationStore implements AgentStore {
  constructor(private local: AgentStore) {}

  async getCase(id: string) { return (await fs.getStoredCase(id)) ?? undefined }
  async listCases() { return fs.listStoredCases() }
  async saveCase(c: Case) {
    // An open case leaves routedTo empty: the engine routes it on its next read.
    // A case a person decided keeps who it was sent to (a carried-out call-back).
    if (c.status === "decided" || c.status === "done") {
      await fs.saveCase(c, "agent")
      return
    }
    const { routedTo: _routed, ...rest } = c
    void _routed
    await fs.saveCase(rest as Case, "agent")
  }

  async getCall(id: string) { return this.local.getCall(id) }
  async listCalls() { return this.local.listCalls() }
  async saveCall(c: Call) {
    await fs.saveCall(c)
    await this.local.saveCall(c)
  }

  async getRun(id: string) { return this.local.getRun(id) }
  async listRuns() { return this.local.listRuns() }
  async saveRun(r: StoredRun) {
    await fs.saveAgentRun(r)
    await this.local.saveRun(r)
  }

  async listLessons() { return fs.listLessons() }
  async saveLesson(l: Lesson) { await fs.saveLesson(l) }

  async listTrustRules() { return fs.listTrustRules() }
  async saveTrustRule(r: TrustRule & { optionId?: string }) { await fs.saveTrustRule({ ...r, optionId: r.optionId ?? "" }) }

  async listDecisions(): Promise<Decision[]> {
    return (await fs.listDecisions()).map((row) => row.data ?? { id: row.id, caseId: row.caseId, personId: row.personId, optionId: row.optionId, at: row.at })
  }
  async saveDecision(d: Decision) {
    const c = await fs.getStoredCase(d.caseId)
    await fs.saveDecision({
      id: d.id, caseId: d.caseId, personId: d.personId, optionId: d.optionId, caseType: c?.type ?? "readiness", placeId: c?.placeId ?? null,
      customerId: c?.customerId ?? null, country: site(c?.placeId)?.country ?? null, tookSuggestion: d.optionId === c?.suggestion.id,
      laterChanged: false, onTime: true, synthetic: false, at: d.at, data: d,
    })
  }

  async listOrderChecks(): Promise<OrderCheck[]> { return this.local.listOrderChecks() }
  async saveOrderCheck(c: OrderCheck) { await this.local.saveOrderCheck(c) }
  async listCallbacks(): Promise<Callback[]> { return this.local.listCallbacks() }
  async saveCallback(c: Callback) { await this.local.saveCallback(c) }
}

/** True when the foundation's Postgres answers within a short time. */
export async function foundationReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const probe = fs.listTrustRules().then(() => true, () => false)
    const timer = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
    return await Promise.race([probe, timer])
  } catch {
    return false
  }
}
