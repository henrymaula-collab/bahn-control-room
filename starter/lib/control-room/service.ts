// The engine in one place: read the dataset and our tables, compute checks,
// derive cases, apply trust rules and lessons, route. The API routes and the
// smoke script call these functions; nothing here is cached, so a reseed shows
// on the next request.

import { type OrderCheckResult, computeOrderChecks, countChecks } from "./checks"
import { lessonsFor, proposeLesson, reviewLesson, ruleFor, suggestTrustRules } from "./learning"
import { deriveReadinessCases } from "./readiness-cases"
import { type HistoryRow, routeCase } from "./routing"
import { scaleChecks } from "./scale"
import {
  type DecisionRecord, type StoredTrustRule, getLesson, listAgentRuns, listCalls, listDecisions, listLessons, listPeople,
  listStoredCases, listTrustRules, saveCase, saveDecision, saveLesson, saveTrustRule,
} from "./store"
import type { Case, Decision, Lesson, OpsPerson, OrderCheck } from "./types"
import { CASE_TYPE_WORDS, caseTypeWords } from "./vocab"
import { caseExtras, findPerson, overview, workLists } from "./v3"
import { type World, loadWorld, worldNow } from "./world"

const OPEN: Case["status"][] = ["waiting_for_person", "agent_working"]

export type EngineState = {
  world: World
  now: string
  people: OpsPerson[]
  decisions: DecisionRecord[]
  lessons: Lesson[]
  rules: StoredTrustRule[]
  cases: Case[]
  /** Case ids that are derived on read and not stored yet. */
  derivedIds: Set<string>
  checks: OrderCheckResult[]
}

function history(decisions: DecisionRecord[]): HistoryRow[] {
  return decisions.map((row) => ({ personId: row.personId, caseType: row.caseType, placeId: row.placeId, country: row.country, laterChanged: row.laterChanged, at: row.at }))
}

export async function buildState(): Promise<EngineState> {
  const [world, people, decisions, lessons, rules, stored] = await Promise.all([
    loadWorld(), listPeople(), listDecisions(), listLessons(), listTrustRules(), listStoredCases(),
  ])
  const now = worldNow(world)
  // Contract: every option says what changes. Agent cases can store an option with no
  // change at all (keep the slot, call again); it reads as "nothing changes".
  for (const c of stored) {
    for (const option of [c.suggestion, ...c.alternatives]) {
      if (option && !option.changes?.length) option.changes = [{ kind: "none", detail: "Nothing changes on the order" }]
    }
  }
  const storedOrders = new Set(stored.map((c) => c.orderId))
  // First pass: checks from the data alone, to know which derived cases need a person.
  const firstChecks = computeOrderChecks(world, stored)
  const derived = deriveReadinessCases(world, firstChecks).filter((c) => !storedOrders.has(c.orderId))
  const derivedIds = new Set(derived.map((c) => c.id))

  // Lessons the agent would apply, and trust rules that let it decide alone.
  for (const c of derived) {
    const used = lessonsFor(c, lessons)
    if (used.length) c.lessonIdsUsed = used.map((lesson) => lesson.id)
    const rule = ruleFor(c, rules)
    if (rule && OPEN.includes(c.status)) {
      c.status = "handled_by_agent"
      c.agentSteps.push({ at: now, kind: "propose", summary: `Decided under a trust rule: ${rule.then.replace(/^./, (ch) => ch.toLowerCase())}.` })
    }
  }

  const cases = [...stored, ...derived]
  // Route open cases, most urgent first, so queue lengths spread the load.
  const hist = history(decisions)
  const queue = new Map<string, number>()
  for (const c of cases) if (c.routedTo && OPEN.includes(c.status)) queue.set(c.routedTo.personId, (queue.get(c.routedTo.personId) ?? 0) + 1)
  const toRoute = cases.filter((c) => !c.routedTo && c.status === "waiting_for_person")
    .sort((a, b) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999"))
  for (const c of toRoute) {
    const place = c.placeId ? world.places.get(c.placeId) : undefined
    c.routedTo = routeCase({
      caseId: c.id, type: c.type, desk: c.desk, placeId: c.placeId, placeName: place?.name, country: place?.country,
      people, history: hist, queueLengths: queue, now,
    })
    queue.set(c.routedTo.personId, (queue.get(c.routedTo.personId) ?? 0) + 1)
  }
  const checks = [...computeOrderChecks(world, cases), ...scaleChecks(world, now)]
  return { world, now, people, decisions, lessons, rules, cases, derivedIds, checks }
}

const byUrgency = (a: Case, b: Case) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999") || a.id.localeCompare(b.id)

export function quietLine(state: EngineState) {
  const counts = countChecks(state.checks)
  return {
    checked: counts.total - counts.not_checked,
    notChecked: counts.not_checked,
    checkedAt: state.now,
    needsPerson: counts.needs_person,
    agentWorking: counts.agent_working,
    total: counts.total,
  }
}

export async function getDesk(personId: string, given?: EngineState) {
  const state = given ?? await buildState()
  const person = state.people.find((candidate) => candidate.id === personId) ?? null
  if (!person) return null
  const mine = state.cases.filter((c) => c.routedTo?.personId === personId && c.status === "waiting_for_person").sort(byUrgency)
  return { person, focus: mine[0] ?? null, queue: mine.slice(1), quiet: quietLine(state) }
}

export async function getCaseDetail(id: string, given?: EngineState) {
  const state = given ?? await buildState()
  const c = state.cases.find((candidate) => candidate.id === id)
  if (!c) return null
  const order = state.world.byId.get(c.orderId)
  const [calls, agentRuns] = await Promise.all([listCalls({ caseId: c.id }), listAgentRuns({ caseId: c.id })])
  const usedLessons = state.lessons.filter((lesson) => c.lessonIdsUsed?.includes(lesson.id))
  return {
    case: c,
    order: order ? {
      id: order.id, reference: order.reference, lane: order.bundle.order.lane, status: order.bundle.order.status,
      customer: order.customer,
      pickup: { id: order.pickup.id, name: order.pickup.name, city: order.pickup.city, country: order.pickup.country, timezone: order.pickup.timezone },
      delivery: { id: order.delivery.id, name: order.delivery.name, city: order.delivery.city, country: order.delivery.country, timezone: order.delivery.timezone },
      vehicle: order.bundle.items[0]?.vehicle ?? null,
    } : null,
    routedTo: c.routedTo ? { ...c.routedTo, person: state.people.find((p) => p.id === c.routedTo!.personId) ?? null } : null,
    lessons: usedLessons.map((lesson) => ({ ...lesson, fromDecisions: lessonOrigin(state, lesson) })),
    calls,
    agentRuns,
    check: state.checks.find((check) => check.orderId === c.orderId) ?? null,
    derived: state.derivedIds.has(c.id),
    // v3 (types-v3.ts CaseV3Extras): key facts and the situation panel.
    ...(caseExtras(state, c) ?? { why: [], situation: null }),
  }
}

/** GET /api/cr/overview: every car active today on the map, the counts, and this person's cases. */
export async function getOverview(personId: string, given?: EngineState) {
  const state = given ?? await buildState()
  const person = findPerson(state.people, personId)
  return person ? overview(state, person) : null
}

/** GET /api/cr/work: Needs you, Agent working, Done today for one person. */
export async function getWork(personId: string, given?: EngineState) {
  const state = given ?? await buildState()
  const person = findPerson(state.people, personId)
  return person ? workLists(state, person) : null
}

/** "Learned from Aino's decision on 24 Oct": who and when, for each lesson. */
function lessonOrigin(state: EngineState, lesson: Lesson) {
  return lesson.fromDecisionIds.map((id) => {
    const decision = state.decisions.find((row) => row.id === id)
    const person = decision ? state.people.find((p) => p.id === decision.personId) : undefined
    return { decisionId: id, personId: decision?.personId ?? null, personName: person?.name ?? null, at: decision?.at ?? null }
  })
}

export type DecideInput = { caseId: string; personId: string; optionId: string; editedDetail?: string; why?: string }

export async function decide(input: DecideInput) {
  const state = await buildState()
  const c = state.cases.find((candidate) => candidate.id === input.caseId)
  if (!c) return { error: "Case not found", status: 404 as const }
  const person = state.people.find((candidate) => candidate.id === input.personId)
  if (!person) return { error: "Person not found", status: 404 as const }
  const options = [c.suggestion, ...c.alternatives]
  if (input.optionId !== "other" && !options.some((option) => option.id === input.optionId)) {
    return { error: `Unknown option ${input.optionId}`, status: 400 as const }
  }
  const at = new Date().toISOString()
  const decision: Decision = {
    id: `dec-${c.id.replace(/^case-/, "")}-${Date.now().toString(36)}`,
    caseId: c.id, personId: person.id, optionId: input.optionId, editedDetail: input.editedDetail, why: input.why, at,
  }
  const place = c.placeId ? state.world.places.get(c.placeId) : undefined
  await saveDecision({
    id: decision.id, caseId: c.id, personId: person.id, optionId: input.optionId, caseType: c.type, placeId: c.placeId ?? null,
    customerId: c.customerId ?? null, country: place?.country ?? null, tookSuggestion: input.optionId === c.suggestion.id,
    laterChanged: false, onTime: true, synthetic: false, at, data: decision,
  })
  const updated: Case = {
    ...c, status: "decided",
    agentSteps: [...c.agentSteps, { at, kind: "propose", summary: `${person.name} decided: ${(options.find((option) => option.id === input.optionId)?.label ?? input.editedDetail ?? "another way").replace(/^./, (ch) => ch.toLowerCase())}. The agent carries it out.` }],
  }
  await saveCase(updated, state.derivedIds.has(c.id) ? "derived" : "agent")
  const lesson = await proposeLesson({ decision, case: c, personName: person.name, placeName: place?.name, country: place?.country }, at)
  await saveLesson(lesson)
  const rules = await refreshTrustRules(state)
  return { decision, case: updated, lesson, trustRules: rules }
}

/** Recompute trust-rule suggestions from every decision and save them. */
export async function refreshTrustRules(state?: EngineState) {
  const [decisions, existing] = await Promise.all([listDecisions(), listTrustRules()])
  const placeNames = new Map<string, string>()
  const world = state?.world ?? await loadWorld()
  for (const [id, place] of world.places) placeNames.set(id, place.name)
  const rules = suggestTrustRules(decisions.map((row) => ({ caseId: row.caseId, optionId: row.optionId, caseType: row.caseType, placeId: row.placeId })), existing, placeNames)
  for (const rule of rules) await saveTrustRule(rule)
  return rules
}

export async function setTrustRule(id: string, status: "on" | "off", personId: string) {
  const rules = await listTrustRules()
  const rule = rules.find((candidate) => candidate.id === id)
  if (!rule) return null
  const next: StoredTrustRule = { ...rule, status, changedBy: personId, changedAt: new Date().toISOString() }
  await saveTrustRule(next)
  return next
}

export async function reviewLessonById(id: string, accept: boolean, personId: string, text?: string) {
  const lesson = await getLesson(id)
  if (!lesson) return null
  const next = reviewLesson(lesson, accept, personId, text)
  await saveLesson(next)
  return next
}

export async function getLead(given?: EngineState) {
  const state = given ?? await buildState()
  const counts = countChecks(state.checks)
  const live = state.decisions.filter((row) => !row.synthetic)
  const openCases = state.cases.filter((c) => c.status === "waiting_for_person")
  const team = state.people.map((person) => ({
    ...person,
    waiting: openCases.filter((c) => c.routedTo?.personId === person.id).length,
    decidedToday: live.filter((row) => row.personId === person.id).length,
  }))
  const types = Object.keys(CASE_TYPE_WORDS)
  const coverage = types.map((type) => {
    const people = state.people
      .filter((person) => person.desks.includes("ops-readiness"))
      .map((person) => {
        const rows = state.decisions.filter((row) => row.personId === person.id && row.caseType === type)
        return { personId: person.id, name: person.name, onShift: person.onShift, decided: rows.filter((row) => !row.laterChanged).length }
      })
      .filter((entry) => entry.decided > 0)
      .sort((a, b) => b.decided - a.decided)
    const able = people.filter((entry) => entry.decided >= 3)
    return { caseType: type, label: caseTypeWords(type).label, people, canHandle: able.length, onlyOne: able.length <= 1 }
  })
  // Money: driver fees on the orders that need a person now. Cost side only; the packet holds no customer prices.
  let atStakeCents = 0
  for (const check of state.checks) {
    if (check.state !== "needs_person") continue
    const order = state.world.byId.get(check.orderId)
    if (!order) continue
    const fees = [...(order.bundle.related.work_assignments ?? []), ...(order.bundle.related.market_offers ?? [])]
      .filter((row) => ["ASSIGNED", "IN_PROGRESS", "PUBLISHED"].includes(String(row.details.status)))
      .map((row) => Number(row.details.fee_cents) || 0)
    atStakeCents += Math.max(0, ...fees)
  }
  const atStakeEur = Math.round(atStakeCents / 100)
  const handled = state.cases.filter((c) => c.status === "handled_by_agent").length
  return {
    team,
    coverage,
    lessons: {
      proposed: state.lessons.filter((lesson) => lesson.status === "proposed"),
      accepted: state.lessons.filter((lesson) => lesson.status === "accepted"),
    },
    trustRules: state.rules,
    today: {
      orders: counts.total,
      needsPerson: counts.needs_person,
      agentWorking: counts.agent_working,
      notChecked: counts.not_checked,
      checkedQuiet: counts.checked_quiet,
      casesWaiting: openCases.length,
      decided: live.length,
      handledByAgent: handled,
      checkedAt: state.now,
    },
    money: {
      atStakeEur,
      line: `EUR ${atStakeEur.toLocaleString("en-US")} of driver fees sit on the ${counts.needs_person} orders that need a person.`,
    },
  }
}

export async function getOrderChecks(): Promise<{ checks: OrderCheck[]; counts: ReturnType<typeof countChecks>; checkedAt: string; orders: Record<string, { reference: string; customer: string; from: string; to: string; synthetic?: boolean }> }> {
  const state = await buildState()
  const orders: Record<string, { reference: string; customer: string; from: string; to: string; synthetic?: boolean }> = {}
  for (const order of state.world.orders) orders[order.id] = { reference: order.reference, customer: order.customer.name, from: order.pickup.city, to: order.delivery.city }
  for (const check of state.checks) if (check.synthetic) orders[check.orderId] = { reference: check.reference, customer: check.syntheticCustomer ?? "", from: check.syntheticFrom ?? "", to: check.syntheticTo ?? "", synthetic: true }
  const checks: OrderCheck[] = state.checks.map(({ orderId, state: s, checkedAt, checks: rows, caseId }) => ({ orderId, state: s, checkedAt, checks: rows, caseId }))
  return { checks, counts: countChecks(state.checks), checkedAt: state.now, orders }
}
