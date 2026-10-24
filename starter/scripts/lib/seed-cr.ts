// Seeds the control room's own tables: a made-up ops team, a made-up past of
// decisions (so routing has real counts to explain), one case record per past
// decision (v4 learning loop), a few reviewed lessons and the trust-rule
// proposals that history supports.
//
// EVERYTHING HERE IS FICTION. The people, their languages, shifts, every past
// decision, its minutes, its reason and its order reference (CD-41xxxx, a range
// the packet does not use) are invented for the demo. Only the pickup places
// and customers they point at come from the (also fictional) challenge dataset,
// read from the database at seed time, so counts point at real pickup places.
//
// Deterministic: fixed RNG seeds give the same team and history every run.
// The main history stream is unchanged from v3, so routing reads the same; the
// v4 parts (the known kind's story, records, minutes, reasons) use streams of
// their own.

import { eq, sql } from "drizzle-orm"
import { computeOrderChecks } from "../../lib/control-room/checks"
import { crDb } from "../../lib/control-room/db"
import { kindDef, kindForType, kindOf } from "../../lib/control-room/kinds"
import { OPTION_TEXT } from "../../lib/control-room/learning"
import { deriveReadinessCases } from "../../lib/control-room/readiness-cases"
import { crCaseRecords, crCases, crDecisions, crLessons, crOpsPeople, crTrustRules } from "../../lib/control-room/schema"
import { refreshTrustRules } from "../../lib/control-room/service"
import { type DecisionRecord, saveLesson } from "../../lib/control-room/store"
import { personWeight } from "../../lib/control-room/trust-gate"
import type { CaseType, Lesson, OpsPerson } from "../../lib/control-room/types"
import type { CaseRecord } from "../../lib/control-room/types-loop"
import { loadWorld } from "../../lib/control-room/world"

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- The made-up team -------------------------------------------------------
type Profile = OpsPerson & { count: number; from: string; types: Partial<Record<CaseType & string, number>>; countries: Record<string, number> }

export const TEAM: Profile[] = [
  { id: "p-aino", name: "Aino", role: "ops", title: "Operations Associate", avatar: "/control-room/people/aino.jpg", desks: ["ops-readiness", "ops-support"], languages: ["fi", "sv", "en"], onShift: true, count: 70, from: "2026-08-03",
    types: { "readiness.car_not_ready": 3, "readiness.no_answer": 3, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2 }, countries: { FI: 6, SE: 1 } },
  { id: "p-mikko", name: "Mikko", role: "ops", title: "Operations Associate", avatar: "/control-room/people/mikko.jpg", desks: ["ops-readiness", "ops-import"], languages: ["fi", "en"], onShift: true, count: 55, from: "2026-08-10",
    types: { "readiness.facts_disagree": 3, "readiness.keys_or_access": 3, "readiness.no_answer": 1, "readiness.car_not_ready": 1 }, countries: { FI: 4, DE: 1, AT: 1 } },
  { id: "p-sofie", name: "Sofie", role: "ops", title: "Operations Associate", avatar: "/control-room/people/sofie.jpg", desks: ["ops-readiness", "ops-support"], languages: ["da", "en", "sv"], onShift: true, count: 45, from: "2026-08-17",
    types: { "readiness.car_not_ready": 2, "readiness.no_answer": 2, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2, "readiness.fee_requested": 1 }, countries: { DK: 5, SE: 2 } },
  { id: "p-jonas", name: "Jonas", role: "ops", title: "Operations Associate", avatar: "/control-room/people/jonas.jpg", desks: ["ops-readiness", "ops-import"], languages: ["de", "en"], onShift: true, count: 60, from: "2026-08-03",
    types: { "readiness.release_document_missing": 4, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2, "readiness.car_not_ready": 1, "readiness.fee_requested": 1 }, countries: { DE: 5, AT: 2, FR: 1 } },
  { id: "p-lea", name: "Lea", role: "ops", title: "Operations Associate", avatar: "/control-room/people/lea.jpg", desks: ["ops-support", "ops-readiness"], languages: ["de", "en", "fr"], onShift: false, count: 40, from: "2026-08-24",
    types: { "readiness.facts_disagree": 2, "readiness.no_answer": 2, "readiness.car_not_ready": 2, "readiness.fee_requested": 1 }, countries: { DE: 3, FR: 3, NL: 1, BE: 1 } },
  { id: "p-emil", name: "Emil", role: "ops", title: "Operations Associate", avatar: "/control-room/people/emil.jpg", desks: ["ops-import", "ops-readiness"], languages: ["da", "de", "en"], onShift: true, count: 6, from: "2026-10-05",
    types: { "readiness.no_answer": 2, "readiness.car_not_ready": 1 }, countries: { DK: 2, DE: 1 } },
  { id: "p-kaisa", name: "Kaisa", role: "shift_lead", title: "Operations Lead", avatar: "/control-room/people/kaisa.jpg", desks: ["ops-shift", "ops-readiness"], languages: ["fi", "sv", "en", "de"], onShift: true, count: 25, from: "2026-08-03",
    types: { "readiness.car_not_ready": 1, "readiness.facts_disagree": 1, "readiness.keys_or_access": 1, "readiness.no_answer": 1 }, countries: { FI: 3, DE: 1, DK: 1 } },
]

/** What people usually chose, per case type (semantic option ids, see lib/control-room/learning.ts). */
const CHOICES: Record<string, Record<string, number>> = {
  "readiness.facts_disagree": { pause_gig: 0.45, follow_pickup_place: 0.35, ask_customer: 0.2 },
  "readiness.release_document_missing": { ask_customer_for_release: 0.7, move_pickup_next_day: 0.2, keep_slot_call_again: 0.1 },
  "readiness.car_not_ready": { move_pickup_next_day: 0.6, keep_slot_call_again: 0.3, ask_customer: 0.1 },
  "readiness.keys_or_access": { hold_driver_until_key_holder: 0.6, keep_slot_call_again: 0.3, ask_customer: 0.1 },
  "readiness.no_answer": { keep_slot_call_again: 0.65, ask_customer: 0.2, move_pickup_next_day: 0.15 },
  "readiness.fee_requested": { accept_fee: 0.75, ask_customer: 0.25 },
}
const SUGGESTED: Record<string, string> = Object.fromEntries(Object.entries(CHOICES).map(([type, options]) => [type, Object.keys(options)[0]!]))

const LESSON_TEXT: Record<string, (place: string) => string> = {
  "readiness.car_not_ready": (place) => `${place} confirms a car is ready only the afternoon before. If it has not by 15:00, move the pickup instead of sending a driver.`,
  "readiness.facts_disagree": (place) => `At ${place} the stock screen is right and old order notes are not. Pause the gig until the pickup place names the handover point.`,
  "readiness.release_document_missing": (place) => `${place} releases a car only after the signed release document is e-mailed to the workshop. Ask the customer for it a day ahead.`,
  "readiness.keys_or_access": (place) => `At ${place} the keys sit with stock control, not reception. Ask for the named key holder before the driver travels.`,
  "readiness.no_answer": (place) => `${place} does not answer the phone before 09:00 local time. Call again after nine before moving the slot.`,
}

/** Minutes from case shown to decision, per kind (made up, inside Track C's 4 to 30). */
const MINUTES: Record<string, [number, number]> = {
  no_answer: [4, 10], fee_requested: [4, 8], keys_or_access: [8, 20], car_not_ready: [10, 25],
  facts_disagree: [10, 25], facts_disagree_open_gig: [5, 14], release_document_missing: [12, 30], seller_hold: [15, 30],
}

/** Reasons people gave, per option (made up). Not every decision has one. */
const REASONS: Record<string, string[]> = {
  pause_gig: [
    "A driver could take the gig before the pickup place answers. Pausing costs nothing.",
    "Better no driver than a driver at the wrong door.",
    "The yard and the showroom say different things. Nobody goes until the pickup place names one.",
    "The gig can go out again in a minute once they confirm.",
  ],
  follow_pickup_place: ["The pickup place's own word is newer than the note.", "They confirmed it on the phone, that is enough."],
  ask_customer: ["Only the customer knows where the car is now.", "The customer set this up, they should say."],
  keep_slot_call_again: ["They usually answer after lunch.", "Too early to move anything."],
  move_pickup_next_day: ["They will not make it today, better to move it now than send a driver for nothing."],
  hold_driver_until_key_holder: ["No named person, no trip."],
  ask_customer_for_release: ["Only the customer can get the release."],
  accept_fee: ["Cheaper than another trip."],
}

/** The known kind for the fast-forward: people pause the gig when the details disagree while it is posted. */
const STORY_KIND = "facts_disagree_open_gig"
const STORY_PEOPLE: { id: string; count: number; countries: string[] }[] = [
  { id: "p-jonas", count: 9, countries: ["DE", "AT"] },
  { id: "p-mikko", count: 8, countries: ["FI", "DE"] },
  { id: "p-lea", count: 7, countries: ["DE", "FR"] },
  { id: "p-sofie", count: 6, countries: ["DK", "SE"] },
]

export type SeedResult = { people: number; decisions: number; records: number; lessons: number; rules: { id: string; status: string; when: string; then: string; matched: number; total: number }[] }

export async function seedControlRoom(opts: { wipeAll?: boolean } = {}): Promise<SeedResult> {
  const random = mulberry32(24102026)
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!
  function weighted<T extends string>(weights: Partial<Record<T, number>>): T {
    const entries = Object.entries(weights) as [T, number][]
    const total = entries.reduce((sum, [, w]) => sum + w, 0)
    let r = random() * total
    for (const [key, w] of entries) { r -= w; if (r <= 0) return key }
    return entries[entries.length - 1]![0]
  }
  function randomDate(fromIso: string, toIso = "2026-10-20T15:00:00Z", rnd = random) {
    const from = new Date(`${fromIso}T06:00:00Z`).getTime()
    const to = new Date(toIso).getTime()
    const at = new Date(from + rnd() * (to - from))
    // Office hours, Helsinki: 05:00-15:00 UTC, weekdays.
    at.setUTCHours(5 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0)
    const day = at.getUTCDay()
    if (day === 0) at.setUTCDate(at.getUTCDate() + 1)
    if (day === 6) at.setUTCDate(at.getUTCDate() - 1)
    return at.toISOString()
  }

  const world = await loadWorld()
  const firstChecks = computeOrderChecks(world, [])
  const derived = deriveReadinessCases(world, firstChecks)

  await crDb.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE cr_ops_people, cr_decisions, cr_case_records, cr_lessons, cr_trust_rules`)
    if (opts.wipeAll) await tx.execute(sql`TRUNCATE cr_cases, cr_calls, cr_agent_runs`)
    else await tx.delete(crCases).where(eq(crCases.source, "derived"))
  })
  void crTrustRules; void crLessons

  // People
  for (const profile of TEAM) {
    const { count: _count, from: _from, types: _types, countries: _countries, ...person } = profile
    await crDb.insert(crOpsPeople).values({ id: person.id, name: person.name, role: person.role, onShift: person.onShift, data: person })
  }

  // Places by country; today's pickup places get extra weight so counts point at them.
  const places = [...world.places.values()].filter((place) => place.country && place.site)
  const todays = new Set(world.orders.filter((order) => ["NEW", "WAITING_FOR_PICKUP"].includes(order.bundle.order.status)).map((order) => order.pickup.id))
  const byCountry = new Map<string, typeof places>()
  for (const place of places) byCountry.set(place.country, [...(byCountry.get(place.country) ?? []), place])
  const customersFor = (placeId: string) => world.orders.filter((order) => order.pickup.id === placeId).map((order) => order.customer.id)

  const decisions: DecisionRecord[] = []
  const kindOfDecision = new Map<string, string>()
  let n = 0
  // Same order of random draws as v3 (laterChanged, customer, onTime), so the history reads the same.
  type AddOpts = { onTime?: boolean; kindKey?: string; rnd?: () => number }
  const add = (personId: string, caseType: string, placeId: string, country: string, optionId: string, at: string, laterChanged = random() < 0.06, opts: AddOpts = {}) => {
    n++
    const id = `hist-${String(n).padStart(4, "0")}`
    const caseId = `hist-case-${String(n).padStart(4, "0")}`
    const customers = customersFor(placeId)
    const rnd = opts.rnd ?? random
    const customerId = customers.length ? customers[Math.floor(rnd() * customers.length)]! : null
    const onTime = opts.onTime ?? rnd() < 0.92
    decisions.push({
      id, caseId, personId, optionId, caseType, placeId, country, customerId,
      tookSuggestion: optionId === SUGGESTED[caseType], laterChanged, onTime, synthetic: true, at,
      data: { id, caseId, personId, optionId, at },
    })
    kindOfDecision.set(id, opts.kindKey ?? kindForType(caseType))
  }

  for (const profile of TEAM) {
    for (let i = 0; i < profile.count; i++) {
      const caseType = weighted(profile.types)
      const country = weighted(profile.countries)
      const pool = byCountry.get(country) ?? places
      const today = pool.filter((place) => todays.has(place.id))
      const place = today.length && random() < 0.5 ? pick(today) : pick(pool)
      add(profile.id, caseType, place.id, place.country, weighted(CHOICES[caseType]!), randomDate(profile.from))
    }
  }

  // The known kind (v4 fast-forward): the details disagree while the gig is posted.
  // 30 cases over pickup places in five countries, by four people; 29 paused the gig,
  // one followed the pickup place's word and had to be redone. The open case of this
  // kind today is left out of the places, so the proposal is plainly about the kind.
  const story = mulberry32(25102026)
  const storyCase = derived.find((c) => c.status === "waiting_for_person" && kindOf(c) === STORY_KIND)
  const avoid = new Set(derived.filter((c) => c.status === "waiting_for_person").map((c) => c.placeId))
  const storyPlaces = (country: string) => (byCountry.get(country) ?? []).filter((place) => !avoid.has(place.id)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3)
  let storyIndex = 0
  for (const person of STORY_PEOPLE) {
    for (let i = 0; i < person.count; i++) {
      storyIndex++
      const pool = storyPlaces(person.countries[i % person.countries.length]!)
      const place = pool[Math.floor(story() * pool.length)] ?? places[0]!
      const dissent = person.id === "p-sofie" && i === 2
      const late = (person.id === "p-jonas" && i === 4) || (person.id === "p-lea" && i === 1)
      add(person.id, "readiness.facts_disagree", place.id, place.country, dissent ? "follow_pickup_place" : "pause_gig",
        randomDate("2026-08-12", "2026-10-19T15:00:00Z", story), dissent, { onTime: !late, kindKey: STORY_KIND, rnd: story })
    }
  }
  void storyCase; void storyIndex

  // Lessons: one per case type, at the pickup place of a case open today when there is one.
  const lessons: Lesson[] = []
  const types = Object.keys(LESSON_TEXT)
  for (const [index, type] of types.entries()) {
    // No seeded lesson for missing release documents (was lesson-seed-3, an accepted lesson at
    // the pickup place of the live demo): the demo learns that lesson live, from a person's decision.
    if (type === "readiness.release_document_missing") continue
    const today = derived.find((c) => c.type === type && c.placeId)
    let fromHistory = decisions.filter((row) => row.caseType === type && (!today || row.placeId === today.placeId))
    if (!fromHistory.length && today?.placeId) {
      // Nobody has decided this type at today's pickup place yet: the person who handles this type most did once.
      const expert = [...TEAM].sort((a, b) => (b.types[type as CaseType & string] ?? 0) - (a.types[type as CaseType & string] ?? 0))[0]!
      const place = world.places.get(today.placeId)!
      add(expert.id, type, today.placeId, place.country, SUGGESTED[type]!, randomDate("2026-09-14"), false)
      fromHistory = decisions.slice(-1)
    }
    const source = fromHistory.sort((a, b) => b.at.localeCompare(a.at))[0] ?? decisions.find((row) => row.caseType === type)
    if (!source?.placeId) continue
    const place = world.places.get(source.placeId)
    if (!place) continue
    const proposed = type === "readiness.no_answer"
    lessons.push({
      id: `lesson-seed-${index + 1}`,
      scope: { caseType: type, placeId: source.placeId, country: place.country },
      text: LESSON_TEXT[type]!(place.name),
      fromDecisionIds: [source.id],
      status: proposed ? "proposed" : "accepted",
      reviewedBy: proposed ? undefined : "p-kaisa",
      createdAt: source.at,
    })
  }

  // One case record per made-up decision, in time order, each with the weight its
  // person had on that kind just before (their record on it so far).
  const extra = mulberry32(26102026)
  const names = new Map(TEAM.map((person) => [person.id, person.name]))
  const tally = new Map<string, { decided: number; held: number }>()
  const records: CaseRecord[] = []
  for (const row of [...decisions].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
    const kindKey = kindOfDecision.get(row.id)!
    const def = kindDef(kindKey)
    const place = row.placeId ? world.places.get(row.placeId) : undefined
    const key = `${row.personId}|${kindKey}`
    const before = tally.get(key) ?? { decided: 0, held: 0 }
    const [lo, hi] = MINUTES[kindKey] ?? [5, 20]
    const reasons = REASONS[row.optionId] ?? []
    const reason = reasons.length && (kindKey === STORY_KIND || extra() < 0.35) ? reasons[Math.floor(extra() * reasons.length)] : undefined
    const label = OPTION_TEXT[row.optionId]?.then ?? row.optionId
    const number = Number(row.id.slice(5))
    records.push({
      id: `rec-${row.caseId}`,
      caseId: row.caseId,
      decisionId: row.id,
      reference: `CD-41${String(1000 + number).padStart(4, "0")}`,
      kindKey,
      kindLabel: def.label,
      situation: {
        headline: `${def.label} at ${place?.name ?? "the pickup place"}.`,
        ...(place ? { place: place.name, placeId: place.id, country: place.country } : {}),
        facts: [],
        suggestion: { id: SUGGESTED[row.caseType] ?? row.optionId, label: OPTION_TEXT[SUGGESTED[row.caseType] ?? row.optionId]?.then ?? row.optionId },
        alternatives: [],
      },
      choice: { optionId: row.optionId, label, tookSuggestion: row.tookSuggestion, changes: OPTION_TEXT[row.optionId]?.customer ? ["customer_message"] : [] },
      ...(reason ? { reason } : {}),
      decidedBy: { personId: row.personId, name: names.get(row.personId) ?? row.personId },
      weight: { value: Math.round(personWeight(before) * 100) / 100, decided: before.decided, held: before.held },
      minutes: lo + Math.floor(extra() * (hi - lo + 1)),
      at: row.at,
      synthetic: true,
    })
    tally.set(key, { decided: before.decided + 1, held: before.held + (!row.laterChanged && row.onTime ? 1 : 0) })
  }

  for (let i = 0; i < decisions.length; i += 200) {
    await crDb.insert(crDecisions).values(decisions.slice(i, i + 200).map((row) => ({ ...row, at: new Date(row.at) })))
  }
  for (let i = 0; i < records.length; i += 200) {
    await crDb.insert(crCaseRecords).values(records.slice(i, i + 200).map((record) => ({
      id: record.id, caseId: record.caseId, decisionId: record.decisionId, kindKey: record.kindKey, personId: record.decidedBy.personId,
      optionId: record.choice.optionId, synthetic: true, at: new Date(record.at), data: record,
    })))
  }
  for (const lesson of lessons) await saveLesson(lesson)

  const rules = await refreshTrustRules()
  return {
    people: TEAM.length, decisions: decisions.length, records: records.length, lessons: lessons.length,
    rules: rules.map((rule) => ({ id: rule.id, status: rule.status, when: rule.when, then: rule.then, matched: rule.evidence.matched, total: rule.evidence.total })),
  }
}
