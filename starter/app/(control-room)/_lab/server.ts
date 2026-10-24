// Night lab, server side: the page's lab params (also in layouts, through the proxy's header),
// the ?many= padding of Needs you, and Kaisa's trust-rule proposal as a Your tasks item.
import { headers } from "next/headers"
import { cache } from "react"
import { getOverview, getSignedIn, getWork } from "@/lib/control-room/client"
import type { WorkLists, WorkRow } from "@/lib/control-room/types-v3"
import { LAB_HEADER, labStateOf, PAD_ORDER_PREFIX, RULE_ITEM_PREFIX, type LabState } from "./slots"

/** This request's lab params (layouts too). */
export const labState = cache(async (): Promise<LabState> => {
  const h = await headers()
  const q = new URLSearchParams((h.get(LAB_HEADER) ?? "").replace(/^\?/, ""))
  return labStateOf((k) => q.get(k))
})

async function base(): Promise<string> {
  const h = await headers()
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "127.0.0.1:3160"}`
}

const PEOPLE = ["aino", "sofie", "emil", "jonas", "mikko", "lea", "kaisa"]

/** Every real case open today (other people's Needs you, then the agent's) and the red orders with no case yet. */
const padPool = cache(async (personId: string): Promise<WorkRow[]> => {
  const [lists, overview] = await Promise.all([Promise.all(PEOPLE.map((p) => getWork(p))), getOverview(personId)])
  const seen = new Set<string>()
  const pool: WorkRow[] = []
  const add = (r: WorkRow) => !seen.has(r.caseId) && (seen.add(r.caseId), pool.push(r))
  for (const l of lists) l.needYou.forEach(add)
  for (const l of lists) l.agentWorking.forEach(add)
  // Red orders without a case: the made-up decide-by times step 10 minutes from the room's clock.
  const now = Date.parse(overview.now)
  const casedOrders = new Set(pool.map((r) => r.orderId))
  overview.cars
    .filter((c) => c.state === "needs_person" && !c.caseId && !casedOrders.has(c.orderId))
    .forEach((c, i) =>
      add({
        caseId: `${PAD_ORDER_PREFIX}${c.orderId}`,
        orderId: c.orderId,
        vehicle: c.vehicle,
        place: c.from.split(" ")[0],
        decideBy: new Date(now + (25 + i * 10) * 60_000).toISOString(),
        status: "waiting_for_person",
      }),
    )
  return pool
})

/** The person's Needs you with `many` rows in all: own rows kept, padding from padPool, sorted by decide-by. */
export async function padNeedYou(personId: string, own: WorkRow[], many: number): Promise<WorkRow[]> {
  if (!many || own.length >= many) return own
  const mine = new Set(own.map((r) => r.caseId))
  const pool = (await padPool(personId)).filter((r) => !mine.has(r.caseId))
  const rows = [...own, ...pool.slice(0, many - own.length)]
  const t = (r: WorkRow) => (r.decideBy ? Date.parse(r.decideBy) : Infinity)
  return rows.map((r, i) => ({ r, i })).sort((a, b) => t(a.r) - t(b.r) || a.i - b.i).map(({ r }) => r)
}

/** The kind and the agent's proposal, as /api/cr/lead has them (the rule slot's data). */
export type RuleProposal = {
  id: string // "rule-kind-facts_disagree_open_gig-pause_gig"
  status: "suggested" | "on" | "off"
  when: string // "When the pickup place and the order disagree on where to collect the car while the gig is posted"
  then: string // "Pause the gig until the pickup place confirms"
  kindLabel: string // "Details disagree while the gig is posted"
  line: string // "29 of 30 agree, 4 people"
  agreeing: number
  decided: number
  people: string[] // ["Jonas", "Mikko", "Sofie", "Lea"]
  medianMinutes?: number // how long people took to decide, median
  evidence: { matched: number; total: number; caseIds: string[] }
  changedBy?: string
  changedAt?: string
}

type ApiLead = {
  trustRules: { id: string; status: "suggested" | "on" | "off"; when: string; then: string; kindKey?: string; evidence: RuleProposal["evidence"]; changedBy?: string; changedAt?: string }[]
  kinds: { kindKey: string; label: string; line: string; agreeing: number; decided: number; peopleNames: string[]; medianMinutes?: number; ruleId?: string }[]
}

/** The demo's proposal (kind facts_disagree_open_gig), read from the lab database. */
export const ruleProposal = cache(async (): Promise<RuleProposal | null> => {
  const res = await fetch(`${await base()}/api/cr/lead`, { cache: "no-store" })
  if (!res.ok) return null
  const lead = (await res.json()) as ApiLead
  const rule = lead.trustRules.find((r) => r.kindKey === "facts_disagree_open_gig") ?? lead.trustRules[0]
  if (!rule) return null
  const kind = lead.kinds.find((k) => k.ruleId === rule.id || k.kindKey === rule.kindKey)
  return {
    id: rule.id,
    status: rule.status,
    when: rule.when,
    then: rule.then,
    kindLabel: kind?.label ?? rule.when,
    line: kind?.line ?? `${rule.evidence.matched} of ${rule.evidence.total} agree`,
    agreeing: kind?.agreeing ?? rule.evidence.matched,
    decided: kind?.decided ?? rule.evidence.total,
    people: kind?.peopleNames ?? [],
    medianMinutes: kind?.medianMinutes,
    evidence: rule.evidence,
    changedBy: rule.changedBy,
    changedAt: rule.changedAt,
  }
})

/** The Your tasks row for the proposal (shift leads only, when the lab asks for it). */
export async function ruleRow(personId: string, state: LabState): Promise<WorkRow | null> {
  if (!state.rule) return null
  const me = (await getSignedIn(personId)).person
  if (me.role !== "shift_lead") return null
  const p = await ruleProposal()
  if (!p) return null
  return { caseId: p.id, orderId: "", vehicle: p.kindLabel, place: p.line, status: "waiting_for_person" }
}

export const isRuleItem = (id: string) => id.startsWith(RULE_ITEM_PREFIX)

/** getWork with the lab applied: the proposal first (it has no deadline), then ?many= padding. */
export async function labWork(personId: string, lists: WorkLists): Promise<WorkLists> {
  const state = await labState()
  const rule = await ruleRow(personId, state)
  const padded = await padNeedYou(personId, lists.needYou, state.many)
  return { ...lists, needYou: rule ? [rule, ...padded] : padded }
}
