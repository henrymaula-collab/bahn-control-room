// History (v4 loop 2, track H): the finished cases, newest first, as Finder
// lists files: grouped Today, Yesterday, Previous 7 days, Previous 30 days,
// then by month. One row per decided case (the learning loop's one answer per
// case, with its case record), plus the cases the agent finished alone under
// a trust rule. Read-only: nothing here writes to the database.
//
// Clock: the room runs on the dataset clock (Wed 21 Oct 2026 12:00 Helsinki,
// world.ts worldNow); live decisions carry the wall clock (service.ts decide).
// A live decision made after the room clock is shown on the room's day at its
// own time of day, so it lands under Today right away, at the same time Your
// tasks shows ("Decided by Aino at 20:27").
//
// Made-up past (synthetic records, CD-41xxxx) has no order behind it. For those
// rows the car is picked deterministically from the dataset's own vehicle mix,
// and about one in four gets a short made-up chat summary, so the record view
// shows what a talked-through case looks like. Same output on every read.

import { sql } from "drizzle-orm"
import { crDb } from "./db"
import { hel } from "./fixtures/clock"
import { clock, dayKey } from "./format"
import { kindDef, kindOf } from "./kinds"
import { OPTION_TEXT, ruleFor } from "./learning"
import { type KindAnswer, kindAnswers } from "./loop"
import { type EngineState, buildState, loopInput } from "./service"
import { evaluateKind, onePerCase } from "./trust-gate"
import type { OpsPerson } from "./types"
import type { CaseRecord } from "./types-loop"
import { findPerson, vehicleName } from "./v3"

export type HistoryGroup = "today" | "yesterday" | "week" | "month" | `m-${string}`

export interface HistoryChatLine {
  who: "person" | "agent"
  text: string
}

export interface HistoryRow {
  caseId: string
  reference: string
  car: string
  place: string
  country?: string
  kindKey: string
  kindLabel: string
  headline: string
  /** What was decided, in the option's own words. */
  decision: string
  /** The agent's suggestion when the person chose something else. */
  suggested?: string
  reason?: string
  chat?: { via?: "text" | "voice" | "mixed"; summary?: string; lines?: HistoryChatLine[] }
  by: { id: string; name: string } // "agent" for the agent
  /** The time the row is filed under (room clock); `at` is when it was saved. */
  shownAt: string
  at: string
  minutes?: number
  /** "1 of 16" right after this decision, for its kind. */
  counted: string
  /** What the kind stands at now, when it moved on since ("2 of 16, 2 people"). */
  countedNow?: string
  /** How much the answer counted: 1 is full weight. */
  weight?: { value: number; decided: number; held: number }
  /** The trust rule the agent decided under (agent rows only). */
  rule?: { when: string; then: string; evidence: string; turnedOnBy?: string }
  /** The case is part of today's room: Your tasks can open it. */
  live: boolean
}

export interface HistoryView {
  asOf: string
  person: { id: string; name: string; role: OpsPerson["role"] }
  /** Everyone on the team, for a shift lead's person filter. Empty for ops. */
  people: { id: string; name: string }[]
  rows: HistoryRow[]
}

// ---- Deterministic picks for the made-up past ----

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function carFor(caseId: string, fleet: string[]): string {
  return fleet.length ? fleet[hash(`car:${caseId}`) % fleet.length]! : "Car"
}

/** Made-up summaries of talking a case through, per kind: what was asked, what the agent said. */
const CHAT_SUMMARIES: Record<string, string[]> = {
  no_answer: [
    "Asked when the pickup place last answered. The agent had called twice that morning with no answer and left a message.",
    "Asked whether anyone else at the place could confirm. The agent had no second number on file.",
  ],
  car_not_ready: [
    "Asked how late the car could still be ready today. The agent said the workshop promised the afternoon, without a time.",
    "Asked what moving the pickup does to the delivery. The agent said the promised day still holds if it moves one working day.",
  ],
  keys_or_access: [
    "Asked who holds the keys. The agent said reception did not know and stock control had not answered yet.",
    "Asked whether the driver could wait on site. The agent said the gate closes at 16:00.",
  ],
  facts_disagree: [
    "Asked which address is newer. The agent said the pickup place's own message came after the order note.",
    "Asked the agent to read the pickup place's message. It names the back yard, the order names the showroom.",
  ],
  facts_disagree_open_gig: [
    "Asked whether a driver had taken the gig yet. The agent said nobody had, and pausing it takes a minute to undo.",
  ],
  release_document_missing: [
    "Asked whether the customer had sent the release before. The agent found one earlier order where it came a day late.",
    "Asked the agent to read the workshop's reply. They release the car only with the signed document on file.",
  ],
  fee_requested: [
    "Asked how big the fee is against another trip. The agent said the fee is smaller than an empty pickup.",
  ],
  seller_hold: [
    "Asked who can lift the hold. The agent said only the seller, through the customer.",
  ],
}

function madeUpChat(record: CaseRecord): HistoryRow["chat"] | undefined {
  const options = CHAT_SUMMARIES[record.kindKey]
  const h = hash(`chat:${record.caseId}`)
  if (!options?.length || h % 4 !== 0) return undefined
  return { via: h % 3 === 0 ? "voice" : "text", summary: options[(h >>> 3) % options.length] }
}

// ---- Live chat (cr_chat_messages, when the chat track's table exists) ----

type ChatRow = { case_id: string; thread_person_id: string; role: string; via: string; at: string; text: string | null }

async function chatLines(caseIds: string[]): Promise<Map<string, ChatRow[]>> {
  const out = new Map<string, ChatRow[]>()
  if (!caseIds.length) return out
  try {
    const list = sql.join(caseIds.map((id) => sql`${id}`), sql`, `)
    const rows = (await crDb.execute(sql`
      SELECT case_id, thread_person_id, role, via, at, data->>'text' AS text
      FROM cr_chat_messages WHERE case_id IN (${list}) ORDER BY at
    `)) as unknown as ChatRow[]
    for (const row of rows) out.set(row.case_id, [...(out.get(row.case_id) ?? []), row])
  } catch {
    // No chat table in this database: no chat lines.
  }
  return out
}

// ---- Counting toward the kind's gate ----

function gateLine(answers: KindAnswer[]): string {
  const gate = evaluateKind(answers)
  if (gate.status === "differ") return "People answer this differently"
  if (gate.status === "ready") return `${gate.agreeing} of ${gate.decided} agree, ${gate.people} people`
  if (gate.status === "new") return "New kind of case"
  return `${gate.agreeing} of ${gate.needed}${gate.people > 1 ? `, ${gate.people} people` : ""}`
}

/** For every answered case: the kind's line right after it, and the line now. */
function countedLines(answers: KindAnswer[]): Map<string, { then: string; now: string }> {
  const byKind = new Map<string, KindAnswer[]>()
  for (const answer of answers) byKind.set(answer.kindKey, [...(byKind.get(answer.kindKey) ?? []), answer])
  const out = new Map<string, { then: string; now: string }>()
  for (const list of byKind.values()) {
    const sorted = onePerCase(list) as KindAnswer[]
    const now = gateLine(sorted)
    sorted.forEach((answer, index) => out.set(answer.caseId, { then: gateLine(sorted.slice(0, index + 1)), now }))
  }
  return out
}

// ---- Rows ----

/** The time a row is filed under: live decisions after the room clock go on the room's day. */
function shownAt(at: string, now: string, synthetic: boolean): string {
  if (synthetic || at <= now) return at
  return hel(dayKey(now), clock(at))
}

const lower = (text: string) => text.replace(/^./, (ch) => ch.toLowerCase())

export function historyRows(state: EngineState): HistoryRow[] {
  const input = loopInput(state)
  const answers = kindAnswers(input)
  const counted = countedLines(answers)
  const cases = new Map(state.cases.map((c) => [c.id, c]))
  const names = new Map(state.people.map((person) => [person.id, person.name]))
  const fleet = state.world.orders.map((order) => vehicleName(order)).filter((name) => name !== "Car").sort()
  const whyOf = new Map<string, string>()
  for (const row of state.decisions) if (row.data.why) whyOf.set(row.caseId, row.data.why)
  const rows: HistoryRow[] = []

  for (const answer of answers) {
    const record = answer.record
    const c = cases.get(answer.caseId)
    const order = c ? state.world.byId.get(c.orderId) : record?.orderId ? state.world.byId.get(record.orderId) : undefined
    const place = c?.placeId ? state.world.places.get(c.placeId) : undefined
    const synthetic = record?.synthetic ?? !c
    const options = c ? [c.suggestion, ...c.alternatives] : []
    const chosen = options.find((option) => option.id === answer.optionId)
    const decision = record?.choice.label ?? chosen?.label ?? OPTION_TEXT[answer.optionId]?.then ?? answer.optionId
    const suggestion = record?.situation.suggestion.label ?? c?.suggestion.label
    const tookSuggestion = record?.choice.tookSuggestion ?? (c ? c.suggestion.id === answer.optionId : true)
    const at = record?.at ?? answer.at
    const loose = record as (CaseRecord & { vehicle?: unknown; car?: unknown }) | undefined
    const ownCar = typeof loose?.vehicle === "string" ? loose.vehicle : typeof loose?.car === "string" ? loose.car : undefined
    const kindKey = record?.kindKey ?? answer.kindKey
    const line = counted.get(answer.caseId)
    const reason = record?.reason ?? whyOf.get(answer.caseId)
    const chat = record?.chat?.summary ? { via: record.chat.via, summary: record.chat.summary } : record?.synthetic ? madeUpChat(record) : undefined
    rows.push({
      caseId: answer.caseId,
      reference: record?.reference ?? order?.reference ?? "",
      car: order ? vehicleName(order) : ownCar ?? carFor(answer.caseId, fleet),
      place: record?.situation.place ?? place?.name ?? "",
      ...(record?.situation.country ?? place?.country ? { country: record?.situation.country ?? place?.country } : {}),
      kindKey,
      kindLabel: record?.kindLabel ?? kindDef(kindKey).label,
      headline: record?.situation.headline ?? c?.headline ?? `${kindDef(kindKey).label}.`,
      decision,
      ...(!tookSuggestion && suggestion && suggestion !== decision ? { suggested: suggestion } : {}),
      ...(reason ? { reason } : {}),
      ...(chat ? { chat } : {}),
      by: { id: answer.personId, name: names.get(answer.personId) ?? answer.personId },
      shownAt: shownAt(at, state.now, synthetic),
      at,
      ...(record?.minutes ? { minutes: record.minutes } : {}),
      counted: line?.then ?? "",
      ...(line && line.now !== line.then ? { countedNow: line.now } : {}),
      ...(record?.weight ? { weight: { value: Math.round(record.weight.value * 100) / 100, decided: record.weight.decided, held: record.weight.held } } : {}),
      live: !!c && !synthetic,
    })
  }

  // The agent's own: cases it finished under a trust rule today.
  for (const c of state.cases) {
    if (c.status !== "handled_by_agent") continue
    const rule = ruleFor(c, state.rules)
    const order = state.world.byId.get(c.orderId)
    const place = c.placeId ? state.world.places.get(c.placeId) : undefined
    const kindKey = kindOf(c)
    const step = [...c.agentSteps].reverse().find((s) => s.kind === "propose")
    const at = step?.at ?? state.now
    const decision = rule?.then ?? c.suggestion.label
    rows.push({
      caseId: c.id,
      reference: order?.reference ?? "",
      car: vehicleName(order),
      place: place?.name ?? "",
      ...(place?.country ? { country: place.country } : {}),
      kindKey,
      kindLabel: kindDef(kindKey).label,
      headline: c.headline,
      decision,
      by: { id: "agent", name: "Agent" },
      shownAt: shownAt(at, state.now, false),
      at,
      counted: "Decided under a trust rule",
      ...(rule ? {
        rule: {
          when: rule.when,
          then: lower(rule.then),
          evidence: `${rule.evidence.matched} of ${rule.evidence.total} agree`,
          ...(rule.changedBy ? { turnedOnBy: names.get(rule.changedBy) ?? rule.changedBy } : {}),
        },
      } : {}),
      live: true,
    })
  }

  return rows.sort((a, b) => b.shownAt.localeCompare(a.shownAt) || a.caseId.localeCompare(b.caseId))
}

/**
 * GET /api/cr/history?person=<id>&scope=mine|everyone. Ops always get their own
 * finished cases; a shift lead can ask for everyone's (the agent's included).
 */
export async function getHistory(personId: string, scope: "mine" | "everyone" = "mine", given?: EngineState): Promise<HistoryView | null> {
  const state = given ?? await buildState()
  const person = findPerson(state.people, personId)
  if (!person) return null
  const lead = person.role === "shift_lead"
  const all = historyRows(state)
  const rows = lead && scope === "everyone" ? all : all.filter((row) => row.by.id === person.id)

  // The live conversations, as lines, for the cases that have one.
  const chats = await chatLines(rows.filter((row) => row.live && row.by.id !== "agent").map((row) => row.caseId))
  for (const row of rows) {
    const lines = (chats.get(row.caseId) ?? []).filter((line) => line.thread_person_id === row.by.id && line.text)
    if (!lines.length) continue
    const vias = new Set(lines.map((line) => line.via))
    row.chat = {
      ...row.chat,
      via: vias.size > 1 ? "mixed" : (lines[0]!.via as "text" | "voice"),
      lines: lines.slice(-8).map((line) => ({ who: line.role === "person" ? "person" : "agent", text: line.text! })),
    }
  }

  return {
    asOf: state.now,
    person: { id: person.id, name: person.name, role: person.role },
    people: lead ? state.people.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)) : [],
    rows,
  }
}
