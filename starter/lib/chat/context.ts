// Everything the chat agent knows about one case, for one person: the case,
// the order, the history of decisions (with kinds), lessons, calls and what
// the reused lib/agent read tools need. Two loaders: the engine (Postgres +
// dataset) and the fixture store (CR_DATA=fixtures, no database).

import { site as datasetSite } from "@/lib/agent/data"
import { registerPeople } from "@/lib/agent/people"
import type { Call, Case, Decision, Lesson, OpsPerson, TrustRule } from "@/lib/control-room/types"
import type { CaseDepth } from "@/lib/depth/types"
import { kindOf, kindOfType, optionKey, storedKind, type Kind } from "./kind"
import { firstName, type PastDecision } from "./knowledge"

export interface ChatPlace {
  id?: string
  name: string
  city: string
  country: string
  timezone: string
}

export interface ChatCaseContext {
  source: "engine" | "fixtures"
  /** Dataset time: deadlines and "due in" maths use it. */
  now: string
  case: Case
  order: { id: string; reference: string; customer: string; vehicle: string; pickup: ChatPlace; delivery: ChatPlace }
  person: OpsPerson
  people: OpsPerson[]
  kind: Kind
  history: PastDecision[]
  /** Lessons used on this case, or accepted for its pickup place. */
  lessons: Lesson[]
  calls: Call[]
  /** Other cases at this pickup place (stored or derived), for the place history. */
  placeCases: Case[]
  /** What the reused lib/agent read tools read (RunContext.snap). */
  snap: { lessons: Lesson[]; decisions: Decision[]; trustRules: TrustRule[]; cases: Case[] }
  /** Baseline records beyond the dataset (lib/depth): thread, call, note, documents, people, hours, earlier pickups. Null for the demo orders. */
  depth?: CaseDepth | null
}

/** The case's baseline depth (stored row or generated); never fails the chat. */
async function depthOf(c: Case, now: string): Promise<CaseDepth | null> {
  try {
    const { depthForCase } = await import("@/lib/depth/store")
    return await depthForCase({ id: c.id, orderId: c.orderId, type: c.type, createdAt: c.createdAt, facts: c.facts }, now)
  } catch {
    return null
  }
}

export type ContextResult = { ok: true; ctx: ChatCaseContext } | { ok: false; status: 404; error: string }

/** Labels for Bahn's semantic option ids, for decisions whose case is not stored. */
const OPTION_LABELS: Record<string, string> = {
  pause_gig: "Pause the gig until the pickup place confirms",
  follow_pickup_place: "Go with what the pickup place said",
  keep_slot_call_again: "Keep the slot and call the pickup place again",
  hold_driver_until_key_holder: "Hold the driver until the key holder is named",
  driver_waits: "Ask the driver to wait 30 minutes more",
  release_driver: "Release the driver and pay the empty pickup",
  accept_fee: "Accept the fee and confirm the pickup",
  ask_customer: "Ask the customer",
  ask_customer_for_release: "Ask the customer for the signed release document",
  move_pickup_next_day: "Move the pickup to the next working day",
}

export function optionLabel(c: Case | undefined, optionId: string, editedDetail?: string): string {
  if (optionId === "other") return editedDetail?.trim() || "Another way"
  const opt = c ? [c.suggestion, ...c.alternatives].find((o) => o?.id === optionId) : undefined
  return opt?.label ?? OPTION_LABELS[optionKey(optionId)] ?? optionId.replace(/_/g, " ")
}

const isOrderRef = (id: string) => /^CD-\d+$/i.test(id.trim())

/** A case id, or an order reference: then the open case for that order (waiting first). */
function pickCase(cases: Case[], id: string, refOf: (orderId: string) => string | undefined): Case | undefined {
  const exact = cases.find((c) => c.id === id)
  if (exact || !isOrderRef(id)) return exact
  const forOrder = cases.filter((c) => refOf(c.orderId)?.toUpperCase() === id.trim().toUpperCase())
  const rank = (c: Case) => (c.status === "waiting_for_person" ? 0 : c.status === "agent_working" ? 1 : 2)
  return forOrder.sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))[0]
}

function personOf(people: OpsPerson[], id: string): OpsPerson | undefined {
  const bare = id.replace(/^p-/, "")
  return people.find((p) => p.id === id) ?? people.find((p) => p.id.replace(/^p-/, "") === bare)
}

// ---------- engine ----------

export async function engineContext(caseId: string, personId: string): Promise<ContextResult> {
  const [{ buildState }, { listCalls }, { vehicleName }] = await Promise.all([
    import("@/lib/control-room/service"),
    import("@/lib/control-room/store"),
    import("@/lib/control-room/v3"),
  ])
  const state = await buildState()
  const refOf = (orderId: string) => state.world.byId.get(orderId)?.reference
  const c = pickCase(state.cases, caseId, refOf)
  if (!c) return { ok: false, status: 404, error: "Case not found" }
  const person = personOf(state.people, personId)
  if (!person) return { ok: false, status: 404, error: "Person not found" }
  registerPeople(state.people)
  const order = state.world.byId.get(c.orderId)
  const byId = new Map(state.cases.map((x) => [x.id, x]))
  const placeName = (id: string | null | undefined) => (id ? state.world.places.get(id)?.name ?? datasetSite(id)?.name ?? "a pickup place" : "a pickup place")

  const history: PastDecision[] = state.decisions.map((row) => {
    const stored = byId.get(row.caseId)
    const kind = storedKind(row) ?? storedKind(row.data) ?? (stored ? kindOf(stored) : kindOfType(row.caseType))
    return {
      id: row.id,
      caseId: row.caseId,
      reference: stored ? refOf(stored.orderId) ?? "" : "",
      personId: row.personId,
      personName: firstName(state.people, row.personId),
      kind,
      caseType: row.caseType,
      placeId: row.placeId ?? undefined,
      placeName: placeName(row.placeId),
      optionId: row.optionId,
      choice: optionLabel(stored, row.optionId, row.data.editedDetail),
      ...(row.data.why ? { why: row.data.why } : {}),
      at: row.at,
      laterChanged: row.laterChanged,
      onTime: row.onTime,
      synthetic: row.synthetic,
    }
  })
  const [calls, depth] = await Promise.all([listCalls({ caseId: c.id, orderId: c.orderId }), depthOf(c, state.now)])
  const place = (p: { id: string; name: string; city: string; country: string; timezone: string | null } | undefined): ChatPlace =>
    p ? { id: p.id, name: p.name, city: p.city, country: p.country, timezone: p.timezone ?? "Europe/Helsinki" } : { name: "Unknown", city: "", country: "", timezone: "Europe/Helsinki" }
  return {
    ok: true,
    ctx: {
      source: "engine",
      now: state.now,
      case: c,
      order: {
        id: c.orderId,
        reference: order?.reference ?? c.orderId,
        customer: order?.customer.name ?? "the customer",
        vehicle: order ? vehicleName(order) : "the car",
        pickup: place(order?.pickup),
        delivery: place(order?.delivery),
      },
      person,
      people: state.people,
      kind: kindOf(c),
      history,
      lessons: state.lessons.filter((l) => c.lessonIdsUsed?.includes(l.id) || (l.status === "accepted" && !!c.placeId && l.scope.placeId === c.placeId)),
      calls,
      placeCases: state.cases.filter((x) => !!c.placeId && x.placeId === c.placeId && x.orderId !== c.orderId),
      snap: { lessons: state.lessons, decisions: state.decisions.map((row) => row.data), trustRules: state.rules, cases: state.cases },
      depth,
    },
  }
}

// ---------- fixtures ----------

type FixtureStore = { cases: Case[]; decisions: Decision[]; lessons: Lesson[]; rules: TrustRule[] }

export async function fixtureContext(caseId: string, personId: string): Promise<ContextResult> {
  const fx = await import("@/lib/control-room/fixtures")
  const [{ CASES }, { ROOM_NOW, hel }, { LESSONS, TRACK_RECORDS, TRUST_RULES }, { ORDERS }, { PEOPLE }, { CALLS }] = await Promise.all([
    import("@/lib/control-room/fixtures/cases"),
    import("@/lib/control-room/fixtures/clock"),
    import("@/lib/control-room/fixtures/learning"),
    import("@/lib/control-room/fixtures/orders"),
    import("@/lib/control-room/fixtures/people"),
    import("@/lib/control-room/fixtures/calls"),
  ])
  // The fixture store lives on globalThis (fixtures/index.ts); deskView() creates it on first use.
  fx.deskView(PEOPLE[0]?.id)
  const live = (globalThis as unknown as { __crFixtureStore?: FixtureStore }).__crFixtureStore
  const cases = live?.cases ?? CASES
  const refOf = (orderId: string) => ORDERS[orderId]?.reference
  const c = pickCase(cases, caseId.replace(/-copy-\d+$/, ""), refOf)
  if (!c) return { ok: false, status: 404, error: "Case not found" }
  const person = personOf(PEOPLE, personId)
  if (!person) return { ok: false, status: 404, error: "Person not found" }
  registerPeople(PEOPLE)
  const o = ORDERS[c.orderId]
  const byId = new Map(cases.map((x) => [x.id, x]))
  // The made-up history borrows the option and the pickup place from the fixture case of the same type.
  const sample = new Map<string, Case>()
  for (const x of CASES) if (!sample.has(x.type)) sample.set(x.type, x)

  // The fixtures keep a track record as counts; spread each count into dated, made-up decisions.
  const history: PastDecision[] = []
  TRACK_RECORDS.forEach((r, ri) => {
    for (let i = 0; i < r.decided; i++) {
      const like = sample.get(r.caseType)
      const optionId = like?.suggestion.id ?? "other"
      const placeId = r.placeId ?? like?.placeId
      history.push({
        id: `fx-hist-${ri}-${i}`,
        caseId: `fx-hist-case-${ri}-${i}`,
        reference: "",
        personId: r.personId,
        personName: firstName(PEOPLE, r.personId),
        kind: kindOfType(r.caseType),
        caseType: r.caseType,
        placeId,
        placeName: (like && ORDERS[like.orderId]?.pickup.placeName) || (placeId ? datasetSite(placeId)?.name : undefined) || "a pickup place",
        optionId,
        choice: optionLabel(like, optionId),
        at: new Date(Date.parse(ROOM_NOW) - (3 + ri * 2 + i * 5) * 86_400_000).toISOString(),
        laterChanged: i < r.laterChanged,
        onTime: i < r.onTime,
        synthetic: true,
      })
    }
  })
  for (const d of live?.decisions ?? []) {
    const stored = byId.get(d.caseId)
    const ord = stored ? ORDERS[stored.orderId] : undefined
    history.push({
      id: d.id, caseId: d.caseId, reference: ord?.reference ?? "", personId: d.personId, personName: firstName(PEOPLE, d.personId),
      kind: stored ? kindOf(stored) : kindOfType("readiness.other"), caseType: stored?.type ?? "readiness.other", placeId: stored?.placeId,
      placeName: ord?.pickup.placeName ?? "a pickup place", optionId: d.optionId, choice: optionLabel(stored, d.optionId, d.editedDetail),
      ...(d.why ? { why: d.why } : {}), at: d.at, laterChanged: false, onTime: true, synthetic: false,
    })
  }
  const lessons = live?.lessons ?? LESSONS
  let depth: CaseDepth | null = null
  try {
    const { generateDepth } = await import("@/lib/depth/generate")
    depth = generateDepth({ order: o?.reference ?? c.orderId, case: { id: c.id, type: c.type, createdAt: c.createdAt, facts: c.facts }, now: ROOM_NOW })
  } catch {
    depth = null
  }
  const end = (e: (typeof ORDERS)[string]["pickup"] | undefined): ChatPlace =>
    e ? { id: e.placeId, name: e.placeName, city: e.city, country: e.country, timezone: e.timezone } : { name: "Unknown", city: "", country: "", timezone: "Europe/Helsinki" }
  void hel
  return {
    ok: true,
    ctx: {
      source: "fixtures",
      now: ROOM_NOW,
      case: c,
      order: { id: c.orderId, reference: o?.reference ?? c.orderId, customer: o?.customer.name ?? "the customer", vehicle: o?.vehicle ?? "the car", pickup: end(o?.pickup), delivery: end(o?.delivery) },
      person,
      people: PEOPLE,
      kind: kindOf(c),
      history,
      lessons: lessons.filter((l) => c.lessonIdsUsed?.includes(l.id) || (l.status === "accepted" && !!c.placeId && l.scope.placeId === c.placeId)),
      calls: CALLS.filter((call) => call.caseId === c.id || call.orderId === c.orderId),
      placeCases: cases.filter((x) => !!c.placeId && x.placeId === c.placeId && x.orderId !== c.orderId),
      snap: { lessons, decisions: live?.decisions ?? [], trustRules: live?.rules ?? TRUST_RULES, cases },
      depth,
    },
  }
}

export function fixtureMode(): boolean {
  return process.env.CR_DATA === "fixtures"
}

export function loadContext(caseId: string, personId: string): Promise<ContextResult> {
  return fixtureMode() ? fixtureContext(caseId, personId) : engineContext(caseId, personId)
}
