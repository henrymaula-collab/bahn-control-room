// The engine in one place: read the dataset and our tables, compute checks,
// derive cases, apply trust rules and lessons, route. The API routes and the
// smoke script call these functions; nothing here is cached, so a reseed shows
// on the next request.

import { sql } from "drizzle-orm"
import { type OrderCheckResult, computeOrderChecks, countChecks } from "./checks"
import { crDb } from "./db"
import { kindDef, kindOf } from "./kinds"
import { lessonsFor, proposeLesson, reviewLesson, ruleFor } from "./learning"
import { type LoopInput, kindRules, kindSummaries, knowledgeFor, weightOn } from "./loop"
import { deriveReadinessCases } from "./readiness-cases"
import { type HistoryRow, routeCase } from "./routing"
import { scaleChecks } from "./scale"
import {
  type DecisionRecord, type StoredTrustRule, deleteTrustRule, getLesson, listAgentRuns, listCalls, listCaseRecords, listDecisions, listLessons, listPeople,
  listStoredCases, listTrustRules, replaceDecision, saveCase, saveCaseRecord, saveDecision, saveLesson, saveTrustRule,
} from "./store"
import { GATE_FLOOR, GATE_MIN_PEOPLE, GATE_N } from "./trust-gate"
import type { Case, Decision, Lesson, OpsPerson, OrderCheck } from "./types"
import type { CaseRecord } from "./types-loop"
import { CASE_TYPE_WORDS, caseTypeWords } from "./vocab"
import { caseExtras, findPerson, overview, workLists } from "./v3"
import { type World, loadWorld, worldNow } from "./world"

const OPEN: Case["status"][] = ["waiting_for_person", "agent_working"]

export type EngineState = {
  world: World
  now: string
  people: OpsPerson[]
  decisions: DecisionRecord[]
  /** One case record per decided case (v4 learning loop). */
  records: CaseRecord[]
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

/**
 * A stored case can be held back until another case is decided ("a second
 * case of the same kind comes in"): the demo's round 2. Until then it is not
 * part of the state at all. When it shows, `followPrecedent` makes the option
 * that person chose the agent's suggestion, so the agent visibly learned.
 */
export type HeldBack = { showAfter?: { caseId: string; followPrecedent?: boolean } }

function revealHeldBack(stored: (Case & HeldBack)[], decisions: DecisionRecord[], people: OpsPerson[]): Case[] {
  const latest = new Map<string, DecisionRecord>()
  for (const row of decisions) {
    const known = latest.get(row.caseId)
    if (!known || row.at >= known.at) latest.set(row.caseId, row)
  }
  const out: Case[] = []
  for (const c of stored) {
    const hold = c.showAfter
    if (!hold) { out.push(c); continue }
    const decided = latest.get(hold.caseId)
    if (!decided) continue
    // Once a person acted on it, the stored case already is the shown one.
    if (c.status !== "waiting_for_person") { out.push(c); continue }
    // Times stay on the dataset clock the case was written for; only the order of steps changes.
    const shown: Case & HeldBack = { ...c, agentSteps: [...c.agentSteps] }
    const name = people.find((person) => person.id === decided.personId)?.name ?? "a person"
    const kind = kindDef(kindOf(c))
    const same = [c.suggestion, ...c.alternatives].find((option) => option.id === decided.optionId)
    const propose = shown.agentSteps.findIndex((step) => step.kind === "propose")
    if (hold.followPrecedent && same && same.id !== c.suggestion.id) {
      shown.alternatives = [c.suggestion, ...c.alternatives.filter((option) => option.id !== same.id)]
      shown.suggestion = same
    }
    const at = shown.agentSteps[propose >= 0 ? propose : shown.agentSteps.length - 1]?.at ?? c.createdAt
    const step = { at, kind: "lookup" as const, summary: `Looked up earlier ${kind.many}: decided once before, by ${name}.` }
    if (propose >= 0) {
      shown.agentSteps.splice(propose, 1, step, { ...shown.agentSteps[propose]!, summary: `Stopped here and suggested: ${shown.suggestion.label.replace(/^./, (ch) => ch.toLowerCase())}.` })
    } else shown.agentSteps.push(step)
    out.push(shown)
  }
  return out
}

export async function buildState(): Promise<EngineState> {
  const [world, people, decisions, records, lessons, rules, storedAll] = await Promise.all([
    loadWorld(), listPeople(), listDecisions(), listCaseRecords(), listLessons(), listTrustRules(), listStoredCases(),
  ])
  const stored = revealHeldBack(storedAll as (Case & HeldBack)[], decisions, people)
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
  return { world, now, people, decisions, records, lessons, rules, cases, derivedIds, checks }
}

/** The learning loop's view of the state (lib/control-room/loop.ts). */
export function loopInput(state: EngineState): LoopInput {
  const byCase = new Map(state.cases.map((c) => [c.id, c]))
  return {
    decisions: state.decisions, records: state.records, cases: state.cases, people: state.people,
    describe: (caseId) => {
      const c = byCase.get(caseId)
      if (!c) return undefined
      return { reference: state.world.byId.get(c.orderId)?.reference, place: c.placeId ? state.world.places.get(c.placeId)?.name : undefined }
    },
  }
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
  // The decision a person took on this case, newest first (a case is decided once; a later one wins).
  const taken = c.status === "decided" || c.status === "done" ? state.decisions.filter((row) => row.caseId === c.id && !row.synthetic).at(-1) : undefined
  return {
    case: c,
    decision: taken ? { ...taken.data, at: taken.data.at ?? taken.at } : null,
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
    // v4 learning loop: the kind of case and what people decided on it before.
    kind: { key: kindOf(c), label: kindDef(kindOf(c)).label },
    knowledge: knowledgeFor(loopInput(state), c),
    // v3 (types-v3.ts CaseV3Extras): key facts, the situation panel, the line under the button.
    ...(caseExtras(state, c) ?? { why: [], situation: null, next: undefined }),
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

export type DecideInput = {
  caseId: string
  personId: string
  optionId: string
  editedDetail?: string
  why?: string
  /** When the person opened the case, so the record keeps the minutes it took (ISO). */
  openedAt?: string
  /** The conversation before deciding (Track 1's chat), if the caller has it. */
  chat?: CaseRecord["chat"]
}

type ChatSource = (input: { caseId: string; personId: string }) => Promise<CaseRecord["chat"] | undefined>

/** The chat workstream can register where a case's conversation lives. */
let chatSource: ChatSource = async ({ caseId }) => {
  // Default: message ids from cr_chat_messages when that table exists; nothing otherwise.
  try {
    const rows = await crDb.execute(sql`SELECT id FROM cr_chat_messages WHERE case_id = ${caseId} ORDER BY 1`) as unknown as { id: string }[]
    return rows.length ? { messageIds: rows.map((row) => String(row.id)) } : undefined
  } catch {
    return undefined
  }
}

export function setCaseChatSource(next: ChatSource) {
  chatSource = next
}

const lower = (text: string) => text.replace(/^./, (ch) => ch.toLowerCase())

/**
 * A person decides. Saves the decision, one case record (kind, situation,
 * choice, reason, chat, who, weight), a proposed lesson, and refreshes the
 * kind-level trust proposals. Deciding the same case again as the same person
 * (the UI saves the choice, then adds the why) updates that decision and its
 * record in place instead of counting twice.
 */
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
  const earlier = c.status === "decided"
    ? state.decisions.filter((row) => row.caseId === c.id && !row.synthetic && row.personId === person.id).at(-1)
    : undefined
  const at = earlier?.at ?? new Date().toISOString()
  const why = input.why ?? (earlier?.optionId === input.optionId ? earlier?.data.why : undefined)
  const editedDetail = input.editedDetail ?? (earlier?.optionId === input.optionId ? earlier?.data.editedDetail : undefined)
  const decision: Decision = {
    id: earlier?.id ?? `dec-${c.id.replace(/^case-/, "")}-${Date.now().toString(36)}`,
    caseId: c.id, personId: person.id, optionId: input.optionId, ...(editedDetail ? { editedDetail } : {}), ...(why ? { why } : {}), at,
  }
  const place = c.placeId ? state.world.places.get(c.placeId) : undefined
  const row = {
    id: decision.id, caseId: c.id, personId: person.id, optionId: input.optionId, caseType: c.type, placeId: c.placeId ?? null,
    customerId: c.customerId ?? null, country: place?.country ?? null, tookSuggestion: input.optionId === c.suggestion.id,
    laterChanged: false, onTime: true, synthetic: false, at, data: decision,
  }
  if (earlier) await replaceDecision(row)
  else await saveDecision(row)

  const chosen = options.find((option) => option.id === input.optionId)
  const label = chosen?.label ?? editedDetail ?? "another way"
  const decidedStep = (step: Case["agentSteps"][number]) => step.kind === "propose" && step.summary.startsWith(`${person.name} decided:`)
  const steps = earlier ? c.agentSteps.filter((step) => !decidedStep(step)) : c.agentSteps
  const updated: Case = {
    ...c, status: "decided",
    agentSteps: [...steps, { at, kind: "propose", summary: `${person.name} decided: ${lower(label)}. The agent carries it out.` }],
  }
  await saveCase(updated, state.derivedIds.has(c.id) ? "derived" : "agent")

  const kindKey = kindOf(c)
  const loop = loopInput(state)
  const order = state.world.byId.get(c.orderId)
  const openedAt = input.openedAt && !Number.isNaN(Date.parse(input.openedAt)) ? input.openedAt : undefined
  const earlierRecord = state.records.find((record) => record.caseId === c.id)
  const minutes = openedAt ? Math.max(1, Math.round((Date.parse(at) - Date.parse(openedAt)) / 60_000)) : earlierRecord?.minutes
  const chat = input.chat ?? await chatSource({ caseId: c.id, personId: person.id }) ?? earlierRecord?.chat
  const record: CaseRecord = {
    id: `rec-${c.id}`,
    caseId: c.id,
    decisionId: decision.id,
    orderId: c.orderId,
    ...(order?.reference ? { reference: order.reference } : {}),
    kindKey,
    kindLabel: kindDef(kindKey).label,
    situation: {
      headline: c.headline,
      ...(place?.name ? { place: place.name } : {}),
      ...(c.placeId ? { placeId: c.placeId } : {}),
      ...(place?.country ? { country: place.country } : {}),
      facts: c.facts.slice(0, 12).map((fact) => ({ statement: fact.statement, source: fact.source.name ?? fact.source.kind, at: fact.source.at })),
      suggestion: { id: c.suggestion.id, label: c.suggestion.label },
      alternatives: c.alternatives.map((option) => ({ id: option.id, label: option.label })),
    },
    choice: {
      optionId: input.optionId, label, tookSuggestion: input.optionId === c.suggestion.id,
      ...(editedDetail ? { editedDetail } : {}),
      changes: (chosen?.changes ?? []).map((change) => change.kind).filter((kind) => kind !== "none"),
    },
    ...(why ? { reason: why } : {}),
    ...(chat ? { chat } : {}),
    decidedBy: { personId: person.id, name: person.name },
    weight: weightOn(loop, kindKey, person.id, c.id),
    ...(minutes ? { minutes } : {}),
    at,
    synthetic: false,
  }
  await saveCaseRecord(record)

  const lesson = await proposeLesson({ decision, case: c, personName: person.name, placeName: place?.name, country: place?.country }, at)
  await saveLesson(lesson)
  const rules = await refreshTrustRules(state)
  return { decision, case: updated, lesson, record, trustRules: rules }
}

/**
 * Recompute the kind-level trust proposals from every decision and save them
 * (lib/control-room/loop.ts kindRules, gate in trust-gate.ts). Proposals whose
 * kind no longer passes are withdrawn.
 */
export async function refreshTrustRules(state?: EngineState) {
  const base = state ?? await buildState()
  const [decisions, records, existing] = await Promise.all([listDecisions(), listCaseRecords(), listTrustRules()])
  const { rules, drop } = kindRules({ ...loopInput(base), decisions, records }, existing)
  for (const id of drop) await deleteTrustRule(id)
  for (const rule of rules) await saveTrustRule(rule)
  return rules
}

/** The kinds of case for Know-how and the shift lead: decided ones and the kinds of today's open cases. */
export function kindsOf(state: EngineState) {
  const open = state.cases.filter((c) => OPEN.includes(c.status)).map((c) => kindOf(c))
  return kindSummaries(loopInput(state), state.rules, open)
}

/** GET /api/cr/kinds */
export async function getKinds(given?: EngineState) {
  const state = given ?? await buildState()
  return { kinds: kindsOf(state), gate: { needed: GATE_N, minPeople: GATE_MIN_PEOPLE, lowerBound: Math.round(GATE_FLOOR * 1000) / 1000 } }
}

/** What the agent knows about this case's kind (types-chat.ts CaseKnowledge), for the chat. */
export async function getCaseKnowledge(caseId: string, given?: EngineState) {
  const state = given ?? await buildState()
  const c = state.cases.find((candidate) => candidate.id === caseId)
  return c ? knowledgeFor(loopInput(state), c) : null
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
    kinds: kindsOf(state),
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
