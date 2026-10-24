// Maps the foundation API (/api/cr/*, see app-notes/foundation.md) onto the view
// shapes the screens read (./views.ts). Only reads and reshapes; the engine stays
// the source of truth.

import type { Call, Case, Decision, Lesson, OpsPerson, OrderCheck, TrackRecord, TrustRule } from "./types"
import { euro } from "./format"
import type { CaseV3Extras, Overview, WorkLists } from "./types-v3"
import type { CaseCard, CaseDetail, DeskView, LeadView, OrderSummary } from "./views"
import { whyFor } from "./why"

type Fetch = <T>(path: string, init?: RequestInit) => Promise<T>

// ---- API shapes (as returned today) ----
interface ApiDesk {
  person: OpsPerson
  focus: Case | null
  queue: Case[]
  quiet: { checked: number; notChecked: number; checkedAt: string; needsPerson: number; agentWorking: number; total: number }
}
interface ApiPlace { id: string; name: string; city: string; country: string; timezone: string }
interface ApiCaseDetail {
  case: Case
  order: {
    id: string
    reference: string
    lane: string
    status: string
    customer: { id: string; name: string; country: string }
    pickup: ApiPlace
    delivery: ApiPlace
    vehicle: { make: string; model: string; year?: number; fuel?: string; registration?: string | null; vin?: string | null } | null
  } | null
  routedTo: (Case["routedTo"] & { person: OpsPerson | null }) | null
  lessons: (Lesson & { fromDecisions?: { personName: string | null; at: string | null }[] })[]
  calls: Call[]
  check: OrderCheck | null
  decision?: Decision | null // the decision a person took on this case, once decided
}
interface ApiLead {
  coverage: { caseType: string; label: string; people: { personId: string; name: string; onShift: boolean; decided: number }[] }[]
  lessons: { proposed: Lesson[]; accepted: Lesson[] }
  trustRules: (TrustRule & { optionId?: string })[]
  today: { orders: number; needsPerson: number; agentWorking: number; notChecked: number; checkedQuiet: number; casesWaiting: number; decided: number; handledByAgent: number; checkedAt: string }
  money: { atStakeEur: number; line: string }
}
interface ApiChecks { checks: OrderCheck[]; orders: Record<string, { reference: string; customer: string; from: string; to: string }> }

const STATUS_WORDS: Record<string, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  WAITING_FOR_PICKUP: "Waiting for pickup",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
}

/** The cookie may hold a fixture id ("aino") or an engine id ("p-aino"). */
export function resolvePerson(people: OpsPerson[], id: string | undefined): OpsPerson {
  const bare = (id ?? "").replace(/^p-/, "")
  return (
    people.find((p) => p.id === id) ??
    people.find((p) => p.id.replace(/^p-/, "") === bare) ??
    people.find((p) => p.onShift && p.role === "ops") ??
    people[0]
  )
}

function orderSummary(d: ApiCaseDetail): OrderSummary {
  const o = d.order
  if (!o) {
    return {
      orderId: d.case.orderId,
      reference: d.check?.reference ?? "Order",
      vehicle: "Car",
      customer: { id: "", name: "Customer", country: "" },
      status: "",
      routeKind: "Domestic",
      pickup: { placeName: "Pickup place", address: "", city: "", country: "", timezone: "Europe/Helsinki" },
      delivery: { placeName: "Delivery place", address: "", city: "", country: "", timezone: "Europe/Helsinki" },
    }
  }
  const v = o.vehicle
  const endpoint = (p: ApiPlace) => ({ placeId: p.id, placeName: p.name, address: p.name.includes(p.city) ? "" : p.city, city: p.city, country: p.country, timezone: p.timezone })
  return {
    orderId: o.id,
    reference: o.reference,
    vehicle: v ? `${v.make} ${v.model}` : "Car",
    vehicleDetail: v ? [v.year, v.fuel].filter(Boolean).join(", ") : undefined,
    plate: v?.registration ?? undefined,
    vin: v?.vin ?? undefined,
    customer: o.customer,
    status: STATUS_WORDS[o.status] ?? o.status,
    routeKind: o.pickup.country !== o.delivery.country ? "Import" : "Domestic",
    pickup: endpoint(o.pickup),
    delivery: endpoint(o.delivery),
  }
}

function card(d: ApiCaseDetail, rules: TrustRule[] = []): CaseCard {
  const c = d.case
  const ruleUsed =
    c.status === "handled_by_agent"
      ? rules.find((r) => r.status === "on" && r.caseType === c.type && (!r.scope.placeId || r.scope.placeId === c.placeId))
      : undefined
  return { case: c, order: orderSummary(d), ruleUsed }
}

export async function apiDesk(get: Fetch, personId: string): Promise<DeskView> {
  const people = await get<OpsPerson[]>("/api/cr/people")
  const person = resolvePerson(people, personId)
  const [desk, checks] = await Promise.all([
    get<ApiDesk>(`/api/cr/desk?person=${encodeURIComponent(person.id)}`),
    get<ApiChecks>("/api/cr/orders/checks"),
  ])
  const caseIds = [desk.focus, ...desk.queue].filter((c): c is Case => !!c).map((c) => c.id)
  // The agent's own open work on this person's desks, from the order checks.
  const agentIds = checks.checks.filter((ch) => ch.state === "agent_working" && ch.caseId).map((ch) => ch.caseId!)
  const details = await Promise.all([...caseIds, ...agentIds].map((id) => get<ApiCaseDetail | null>(`/api/cr/cases/${encodeURIComponent(id)}`)))
  const byId = new Map(details.filter((d): d is ApiCaseDetail => !!d).map((d) => [d.case.id, d]))
  const cardFor = (c: Case): CaseCard => (byId.has(c.id) ? card({ ...byId.get(c.id)!, case: c }) : card({ case: c, order: null, routedTo: null, lessons: [], calls: [], check: null }))
  const onMyDesks = (c: Case) => person.desks.includes(c.desk)
  const agentCases = agentIds.map((id) => byId.get(id)).filter((d): d is ApiCaseDetail => !!d && onMyDesks(d.case))
  return {
    asOf: desk.quiet.checkedAt,
    person,
    people,
    decision: desk.focus ? cardFor(desk.focus) : null,
    queue: desk.queue.map(cardFor),
    agentWorking: agentCases.filter((d) => d.case.status === "agent_working").map((d) => card(d)),
    handledByAgent: agentCases.filter((d) => d.case.status === "handled_by_agent").map((d) => card(d)),
    quiet: { ordersChecked: desk.quiet.checked, checkedAt: desk.quiet.checkedAt, notChecked: desk.quiet.notChecked },
  }
}

export async function apiCase(get: Fetch, id: string, personId: string): Promise<CaseDetail | null> {
  return (await apiWorkCase(get, id, personId))?.detail ?? null
}

/** A case as Your tasks shows it, from one read of /api/cr/cases/:id: the detail, plus why, the situation and the next line. */
export async function apiWorkCase(get: Fetch, id: string, personId: string): Promise<{ detail: CaseDetail; extras: CaseV3Extras | null } | null> {
  const [people, d] = await Promise.all([
    get<OpsPerson[]>("/api/cr/people"),
    get<(ApiCaseDetail & Partial<CaseV3Extras>) | null>(`/api/cr/cases/${encodeURIComponent(id)}`),
  ])
  if (!d || !d.case) return null
  const detail = caseDetailFrom(d, people, personId)
  const extras = d.situation ? { why: d.why ?? [], situation: d.situation, ...(d.next ? { next: d.next } : {}) } : null
  return { detail, extras }
}

function caseDetailFrom(d: ApiCaseDetail, people: OpsPerson[], personId: string): CaseDetail {
  const person = resolvePerson(people, personId)
  const c = d.case
  const options = [c.suggestion, ...c.alternatives]
  // The agent writes its own likely reasons and the message each option would send; the generic ones fill the gaps.
  const whyChoices = Object.fromEntries(options.map((o) => [o.id, o.whyChoices?.length ? o.whyChoices : whyFor(o.id)]))
  const drafts = Object.fromEntries(options.filter((o) => o.draft).map((o) => [o.id, o.draft!]))
  const decision = d.decision ?? undefined
  return {
    asOf: d.check?.checkedAt ?? c.createdAt,
    person,
    people,
    card: card(d),
    calls: d.calls ?? [],
    lessonsUsed: (d.lessons ?? []).map((l) => {
      const from = l.fromDecisions?.find((f) => f.personName)
      return { ...l, source: from?.personName ? { personName: from.personName, at: from.at ?? l.createdAt } : undefined }
    }),
    drafts,
    whyChoices,
    decision,
    decidedBy: decision ? people.find((p) => p.id === decision.personId) : undefined,
    // No `queue` here: Your tasks walks its own list (WorkLists), so the desk is not read again per card.
  }
}

export async function apiLead(get: Fetch, personId: string): Promise<LeadView> {
  const [people, lead] = await Promise.all([get<OpsPerson[]>("/api/cr/people"), get<ApiLead>("/api/cr/lead")])
  const person = resolvePerson(people, personId)
  const t = lead.today
  const trackRecords: TrackRecord[] = lead.coverage.flatMap((row) =>
    row.people.map((p) => ({ personId: p.personId, caseType: row.caseType, decided: p.decided, laterChanged: 0, onTime: p.decided })),
  )
  const since = new Date(Date.parse(t.checkedAt))
  since.setUTCHours(3, 0, 0, 0) // 06:00 in Helsinki before the clocks change
  return {
    asOf: t.checkedAt,
    person,
    people,
    today: {
      since: since.toISOString(),
      ordersChecked: t.orders - t.notChecked,
      checkedAt: t.checkedAt,
      casesToPeople: t.decided + t.casesWaiting,
      decided: t.decided,
      waiting: t.casesWaiting,
      handledByAgent: t.handledByAgent,
      medianMinutesToDecide: null,
    },
    trackRecords,
    caseTypes: lead.coverage.map((row) => ({ type: row.caseType, label: row.label })),
    // Who a lesson came from is not in the lead response yet; the row then says "From a past decision."
    lessons: [...lead.lessons.proposed, ...lead.lessons.accepted],
    trustRules: lead.trustRules,
    evidence: {},
    money: {
      line: `${euro(lead.money.atStakeEur)} of driver fees sit on the ${t.needsPerson} orders that need a person.`,
      detail: "Each decision made in time keeps a driver from a wasted trip.",
      basis: "Driver fees on gigs that are booked or posted, on orders that need a person now. Cost side only: the dataset has no customer prices.",
    },
  }
}

/** The API saves a decision once, with the why if there is one. */
export async function apiDecide(post: Fetch, d: Omit<Decision, "at">): Promise<Decision> {
  const res = await post<{ decision: Decision }>("/api/cr/decisions", {
    method: "POST",
    body: JSON.stringify({ caseId: d.caseId, personId: d.personId, optionId: d.optionId, editedDetail: d.editedDetail, why: d.why }),
  })
  return res.decision
}

// ---- v3 (types-v3.ts): the engine serves these shapes as they are ----

export async function apiOverview(get: Fetch, personId: string): Promise<Overview> {
  return get<Overview>(`/api/cr/overview?person=${encodeURIComponent(personId)}`)
}

export async function apiWork(get: Fetch, personId: string): Promise<WorkLists> {
  return get<WorkLists>(`/api/cr/work?person=${encodeURIComponent(personId)}`)
}
