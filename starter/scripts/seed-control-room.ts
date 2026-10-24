// Seeds the control room's own tables: a made-up ops team, a made-up past of
// decisions (so routing has real counts to explain), a few reviewed lessons and
// the trust-rule suggestions that history supports.
//
// EVERYTHING HERE IS FICTION. The people, their languages, shifts and every
// past decision are invented for the demo. Only the pickup places and
// customers they point at come from the (also fictional) challenge dataset,
// read from the database at seed time, so counts point at real pickup places.
//
// Deterministic: a fixed RNG seed gives the same team and history every run.
// Run after `npm run db:seed`:  npm run db:seed:cr   (add -- --all to also
// clear agent cases, calls and runs).

import "dotenv/config"
import { eq, sql } from "drizzle-orm"
import { computeOrderChecks } from "../lib/control-room/checks"
import { closeCrDb, crDb } from "../lib/control-room/db"
import { deriveReadinessCases } from "../lib/control-room/readiness-cases"
import { crAgentRuns, crCalls, crCases, crDecisions, crLessons, crOpsPeople, crTrustRules } from "../lib/control-room/schema"
import { refreshTrustRules } from "../lib/control-room/service"
import { type DecisionRecord, saveLesson } from "../lib/control-room/store"
import type { CaseType, Lesson, OpsPerson } from "../lib/control-room/types"
import { loadWorld } from "../lib/control-room/world"

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
const random = mulberry32(24102026)
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!
function weighted<T extends string>(weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = random() * total
  for (const [key, w] of entries) { r -= w; if (r <= 0) return key }
  return entries[entries.length - 1]![0]
}

// ---- The made-up team -------------------------------------------------------
type Profile = OpsPerson & { count: number; from: string; types: Partial<Record<CaseType & string, number>>; countries: Record<string, number> }

const TEAM: Profile[] = [
  { id: "p-aino", name: "Aino", role: "ops", desks: ["ops-readiness", "ops-support"], languages: ["fi", "sv", "en"], onShift: true, count: 70, from: "2026-08-03",
    types: { "readiness.car_not_ready": 3, "readiness.no_answer": 3, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2 }, countries: { FI: 6, SE: 1 } },
  { id: "p-mikko", name: "Mikko", role: "ops", desks: ["ops-readiness", "ops-import"], languages: ["fi", "en"], onShift: true, count: 55, from: "2026-08-10",
    types: { "readiness.facts_disagree": 3, "readiness.keys_or_access": 3, "readiness.no_answer": 1, "readiness.car_not_ready": 1 }, countries: { FI: 4, DE: 1, AT: 1 } },
  { id: "p-sofie", name: "Sofie", role: "ops", desks: ["ops-readiness", "ops-support"], languages: ["da", "en", "sv"], onShift: true, count: 45, from: "2026-08-17",
    types: { "readiness.car_not_ready": 2, "readiness.no_answer": 2, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2, "readiness.fee_requested": 1 }, countries: { DK: 5, SE: 2 } },
  { id: "p-jonas", name: "Jonas", role: "ops", desks: ["ops-readiness", "ops-import"], languages: ["de", "en"], onShift: true, count: 60, from: "2026-08-03",
    types: { "readiness.release_document_missing": 4, "readiness.facts_disagree": 2, "readiness.keys_or_access": 2, "readiness.car_not_ready": 1, "readiness.fee_requested": 1 }, countries: { DE: 5, AT: 2, FR: 1 } },
  { id: "p-lea", name: "Lea", role: "ops", desks: ["ops-support", "ops-readiness"], languages: ["de", "en", "fr"], onShift: false, count: 40, from: "2026-08-24",
    types: { "readiness.facts_disagree": 2, "readiness.no_answer": 2, "readiness.car_not_ready": 2, "readiness.fee_requested": 1 }, countries: { DE: 3, FR: 3, NL: 1, BE: 1 } },
  { id: "p-emil", name: "Emil", role: "ops", desks: ["ops-import", "ops-readiness"], languages: ["da", "de", "en"], onShift: true, count: 6, from: "2026-10-05",
    types: { "readiness.no_answer": 2, "readiness.car_not_ready": 1 }, countries: { DK: 2, DE: 1 } },
  { id: "p-kaisa", name: "Kaisa", role: "shift_lead", desks: ["ops-shift", "ops-readiness"], languages: ["fi", "sv", "en", "de"], onShift: true, count: 25, from: "2026-08-03",
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

function randomDate(fromIso: string, toIso = "2026-10-20T15:00:00Z") {
  const from = new Date(`${fromIso}T06:00:00Z`).getTime()
  const to = new Date(toIso).getTime()
  const at = new Date(from + random() * (to - from))
  // Office hours, Helsinki: 05:00-15:00 UTC, weekdays.
  at.setUTCHours(5 + Math.floor(random() * 10), Math.floor(random() * 60), 0, 0)
  const day = at.getUTCDay()
  if (day === 0) at.setUTCDate(at.getUTCDate() + 1)
  if (day === 6) at.setUTCDate(at.getUTCDate() - 1)
  return at.toISOString()
}

async function main() {
  const wipeAll = process.argv.includes("--all")
  const world = await loadWorld()
  const firstChecks = computeOrderChecks(world, [])
  const derived = deriveReadinessCases(world, firstChecks)

  await crDb.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE cr_ops_people, cr_decisions, cr_lessons, cr_trust_rules`)
    if (wipeAll) await tx.execute(sql`TRUNCATE cr_cases, cr_calls, cr_agent_runs`)
    else await tx.delete(crCases).where(eq(crCases.source, "derived"))
  })
  void crCalls; void crAgentRuns; void crTrustRules; void crLessons

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
  let n = 0
  const add = (personId: string, caseType: string, placeId: string, country: string, optionId: string, at: string, laterChanged = random() < 0.06) => {
    n++
    const id = `hist-${String(n).padStart(4, "0")}`
    const caseId = `hist-case-${String(n).padStart(4, "0")}`
    const customers = customersFor(placeId)
    decisions.push({
      id, caseId, personId, optionId, caseType, placeId, country, customerId: customers.length ? pick(customers) : null,
      tookSuggestion: optionId === SUGGESTED[caseType], laterChanged, onTime: random() < 0.92, synthetic: true, at,
      data: { id, caseId, personId, optionId, at },
    })
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

  // One clear trust-rule story: at the pickup place of today's first waiting case
  // whose suggestion changes something (but messages no customer), people chose
  // that suggestion 13 times in 14.
  const story = derived
    .filter((c) => c.status === "waiting_for_person"
      && c.suggestion.changes.some((change) => change.kind !== "none")
      && !c.suggestion.changes.some((change) => change.kind === "customer_message"))
    .sort((a, b) => (world.byId.get(a.orderId)?.reference ?? "").localeCompare(world.byId.get(b.orderId)?.reference ?? ""))[0]
  if (story?.placeId) {
    const place = world.places.get(story.placeId)!
    const deciders = TEAM.filter((p) => p.desks.includes("ops-readiness") && p.count > 20 && p.languages.some((l) => ({ FI: "fi", DE: "de", AT: "de", DK: "da" } as Record<string, string>)[place.country] === l))
    const people = deciders.length ? deciders : TEAM.filter((p) => p.count > 20)
    // Clear earlier random rows for this exact group so the evidence reads cleanly.
    for (let i = decisions.length - 1; i >= 0; i--) if (decisions[i]!.caseType === story.type && decisions[i]!.placeId === story.placeId) decisions.splice(i, 1)
    for (let i = 0; i < 14; i++) {
      const option = i === 6 ? story.alternatives[0]!.id : story.suggestion.id
      add(pick(people).id, story.type, story.placeId, place.country, option, randomDate("2026-08-05"), false)
    }
  }

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
  for (let i = 0; i < decisions.length; i += 200) {
    await crDb.insert(crDecisions).values(decisions.slice(i, i + 200).map((row) => ({ ...row, at: new Date(row.at) })))
  }
  for (const lesson of lessons) await saveLesson(lesson)

  const rules = await refreshTrustRules()
  console.log(`Seeded ${TEAM.length} made-up people, ${decisions.length} made-up past decisions, ${lessons.length} lessons, ${rules.length} trust-rule suggestion(s).`)
  for (const rule of rules) console.log(`  ${rule.status}: ${rule.when} -> ${rule.then} (${rule.evidence.matched} of ${rule.evidence.total})`)
  await closeCrDb()
}

main().catch(async (error) => {
  console.error(error)
  await closeCrDb()
  process.exit(1)
})
