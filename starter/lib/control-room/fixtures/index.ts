// Fixture store: typed data that matches the contract, kept in memory so the
// screens can be clicked through without a database. Decisions, trust-rule
// switches and lesson reviews change this store until the dev server restarts.

import type { Case, Decision, Lesson, TrustRule } from "../types"
import type { CaseCard, CaseDetail, DeskView, LeadView, LessonSource } from "../views"
import { CALLS } from "./calls"
import { CASES, DRAFTS, WHY_CHOICES } from "./cases"
import { ROOM_NOW, today } from "./clock"
import { CASE_TYPE_ROWS, EVIDENCE, LESSON_SOURCES, LESSONS, MONEY, RULE_DISPLAY, TODAY_STATS, TRACK_RECORDS, TRUST_RULES } from "./learning"
import { ORDERS } from "./orders"
import { PEOPLE } from "./people"
import type { CaseV3Extras, Overview, WorkLists } from "../types-v3"
import { fixtureCaseExtras, fixtureOverview, fixtureWorkLists } from "./v3-derived"

interface Store {
  cases: Case[]
  decisions: Decision[]
  lessons: Lesson[]
  lessonSources: Record<string, LessonSource>
  rules: TrustRule[]
}

const g = globalThis as unknown as { __crFixtureStore?: Store }

function store(): Store {
  if (!g.__crFixtureStore) {
    g.__crFixtureStore = structuredClone({
      cases: CASES,
      decisions: [],
      lessons: LESSONS,
      lessonSources: LESSON_SOURCES,
      rules: TRUST_RULES,
    })
  }
  return g.__crFixtureStore
}

/** Back to the seeded state (used by the screenshot script). */
export function resetFixtures() {
  delete g.__crFixtureStore
}

// Accepts the engine's ids too ("p-aino"), so one cookie works in both modes.
const person = (id?: string) => PEOPLE.find((p) => p.id === (id ?? "").replace(/^p-/, "")) ?? PEOPLE[0]

function card(c: Case): CaseCard {
  const order = ORDERS[c.orderId]
  if (!order) throw new Error(`No order summary for ${c.orderId}`)
  const ruleUsed =
    c.status === "handled_by_agent"
      ? store().rules.find((r) => r.status === "on" && r.caseType === c.type && (!r.scope.placeId || r.scope.placeId === c.placeId))
      : undefined
  return { case: c, order, ruleUsed }
}

const byDecideBy = (a: Case, b: Case) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999")

function waitingFor(personId: string): Case[] {
  return store()
    .cases.filter((c) => c.status === "waiting_for_person" && c.routedTo?.personId === personId)
    .sort(byDecideBy)
}

/** Extra made-up rows to check that a long queue stays calm. Fixture mode only. */
function stressRows(n: number, exclude: Set<string>): CaseCard[] {
  const pool = CASES.filter((c) => c.status === "waiting_for_person" && !exclude.has(c.id))
  const base = pool.length ? pool : CASES.filter((c) => c.status === "waiting_for_person")
  const rows: CaseCard[] = []
  for (let i = 0; i < n; i++) {
    const src = base[i % base.length]
    const minutes = 30 + i * 47
    const decideBy = new Date(Date.parse(ROOM_NOW) + minutes * 60_000).toISOString()
    rows.push(card({ ...src, id: `${src.id}-copy-${i + 1}`, decideBy }))
  }
  return rows
}

export function deskView(personId?: string, opts: { extraRows?: number } = {}): DeskView {
  const me = person(personId)
  const mine = waitingFor(me.id).map(card)
  const [decision, ...queue] = mine
  if (opts.extraRows) {
    queue.push(...stressRows(opts.extraRows, new Set(mine.map((m) => m.case.id))))
    queue.sort((a, b) => byDecideBy(a.case, b.case))
  }
  const onMyDesks = (c: Case) => me.desks.includes(c.desk)
  return {
    asOf: ROOM_NOW,
    person: me,
    people: PEOPLE,
    decision: decision ?? null,
    queue,
    agentWorking: store().cases.filter((c) => c.status === "agent_working" && onMyDesks(c)).map(card),
    handledByAgent: store().cases.filter((c) => c.status === "handled_by_agent" && onMyDesks(c)).map(card),
    quiet: { ordersChecked: TODAY_STATS.ordersChecked, checkedAt: TODAY_STATS.checkedAt, notChecked: 0 },
  }
}

export function caseDetail(id: string, personId?: string): CaseDetail | null {
  const me = person(personId)
  const c = store().cases.find((x) => x.id === id)
  if (!c) return null
  const decision = [...store().decisions].reverse().find((d) => d.caseId === id)
  const lessonsUsed = (c.lessonIdsUsed ?? [])
    .map((lid) => store().lessons.find((l) => l.id === lid))
    .filter((l): l is Lesson => !!l)
    .map((l) => ({ ...l, source: store().lessonSources[l.id] }))
  const owner = c.routedTo?.personId ?? me.id
  const queue = waitingFor(owner)
  const index = queue.findIndex((q) => q.id === id)
  return {
    asOf: ROOM_NOW,
    person: me,
    people: PEOPLE,
    card: card(c),
    calls: CALLS.filter((call) => call.caseId === id),
    lessonsUsed,
    drafts: DRAFTS,
    whyChoices: WHY_CHOICES,
    decision,
    decidedBy: decision ? person(decision.personId) : undefined,
    queue:
      index >= 0
        ? { index: index + 1, total: queue.length, prevId: queue[index - 1]?.id, nextId: queue[index + 1]?.id }
        : undefined,
  }
}

export function leadView(personId?: string): LeadView {
  const s = store()
  const waiting = s.cases.filter((c) => c.status === "waiting_for_person").length
  const decidedToday = s.cases.filter((c) => c.status === "decided" || c.status === "done").length
  const handled = s.cases.filter((c) => c.status === "handled_by_agent").length
  const EARLIER_DECIDED = 4 // decided before the snapshot this morning (synthetic history)
  const EARLIER_HANDLED = 2
  return {
    asOf: ROOM_NOW,
    person: person(personId ?? "kaisa"),
    people: PEOPLE,
    today: {
      since: TODAY_STATS.since,
      ordersChecked: TODAY_STATS.ordersChecked,
      checkedAt: TODAY_STATS.checkedAt,
      casesToPeople: EARLIER_DECIDED + decidedToday + waiting,
      decided: EARLIER_DECIDED + decidedToday,
      waiting,
      handledByAgent: EARLIER_HANDLED + handled,
      medianMinutesToDecide: TODAY_STATS.medianMinutesToDecide,
    },
    trackRecords: TRACK_RECORDS,
    caseTypes: CASE_TYPE_ROWS,
    lessons: s.lessons.map((l) => ({ ...l, source: s.lessonSources[l.id] })),
    trustRules: s.rules.map((r) => ({ ...r, ...RULE_DISPLAY[r.id] })),
    evidence: EVIDENCE,
    money: MONEY,
  }
}

/** Upsert by id: the screen saves the choice at once and adds the "why" later. */
export function saveDecision(input: Omit<Decision, "at"> & { at?: string }): Decision {
  const s = store()
  const c = s.cases.find((x) => x.id === input.caseId)
  if (!c) throw new Error("Case not found")
  const existing = s.decisions.find((d) => d.id === input.id)
  const decision: Decision = { ...existing, ...input, at: existing?.at ?? input.at ?? today("12:04") }
  if (existing) Object.assign(existing, decision)
  else s.decisions.push(decision)
  c.status = "decided"

  // A reason given when the person did not take the suggestion becomes a lesson
  // waiting for the shift lead. Nothing is relied on before review.
  if (decision.why && decision.optionId !== c.suggestion.id) {
    const lessonId = `lesson-from-${decision.id}`
    const text = decision.why
    const existingLesson = s.lessons.find((l) => l.id === lessonId)
    if (existingLesson) existingLesson.text = text
    else {
      s.lessons.unshift({
        id: lessonId,
        scope: { caseType: c.type, placeId: c.placeId },
        text,
        fromDecisionIds: [decision.id],
        status: "proposed",
        createdAt: decision.at,
      })
      s.lessonSources[lessonId] = {
        personName: person(decision.personId).name,
        at: decision.at,
        orderReference: ORDERS[c.orderId]?.reference,
        placeName: ORDERS[c.orderId]?.pickup.placeName,
      }
    }
  }
  return decision
}

export function setTrustRule(id: string, status: TrustRule["status"], personId: string): TrustRule {
  const r = store().rules.find((x) => x.id === id)
  if (!r) throw new Error("Trust rule not found")
  r.status = status
  r.changedBy = personId
  r.changedAt = today("12:06")
  return r
}

export function reviewLesson(id: string, action: "accept" | "retire" | "edit", personId: string, text?: string): Lesson {
  const l = store().lessons.find((x) => x.id === id)
  if (!l) throw new Error("Lesson not found")
  if (action === "edit" && text) l.text = text
  if (action === "accept" || action === "edit") l.status = "accepted"
  if (action === "retire") l.status = "retired"
  l.reviewedBy = personId
  return l
}

// ---- v3 shapes (types-v3.ts), built from the same store ----

export function overview(personId?: string): Overview {
  return fixtureOverview(ROOM_NOW, store().cases, ORDERS, person(personId))
}

/** `extraRows` (cookie cr-rows) adds copies to Needs you, to check that a long list stays calm. */
export function workLists(personId?: string, opts: { extraRows?: number } = {}): WorkLists {
  const lists = fixtureWorkLists(store().cases, ORDERS, person(personId))
  if (!opts.extraRows || !lists.needYou.length) return lists
  const pool = lists.needYou
  const copies = Array.from({ length: opts.extraRows }, (_, i) => ({
    ...pool[i % pool.length]!,
    caseId: `${pool[i % pool.length]!.caseId}-copy-${i + 1}`,
    decideBy: new Date(Date.parse(ROOM_NOW) + (65 + i * 47) * 60_000).toISOString(),
  }))
  const needYou = [...pool, ...copies].sort((a, b) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999"))
  return { ...lists, needYou }
}

/** The copies in a long list open their original case. */
export const baseCaseId = (id: string) => id.replace(/-copy-\d+$/, "")

export function caseExtras(id: string): CaseV3Extras | null {
  const c = store().cases.find((candidate) => candidate.id === id)
  return c ? fixtureCaseExtras(c, ORDERS[c.orderId], PEOPLE, TRACK_RECORDS) : null
}
