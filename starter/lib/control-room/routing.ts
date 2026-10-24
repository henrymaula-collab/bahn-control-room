// Routing: who should decide this case. An explainable rule, not a model.
//
// 1. Candidates are people on shift who sit on the case's desk. The shift
//    lead is only a candidate when nobody else is.
// 2. Nobody on shift with the desk: the case waits for the next shift
//    ("monday_queue") with a promise time, for the person with the best record.
// 3. One candidate: that person ("only_one_on_shift").
// 4. A small, deterministic share of cases goes to someone with few cases of
//    this type ("learning"), so know-how does not sit with one student.
// 5. Otherwise the candidates are ordered by plain counts, in this order:
//    handled at this pickup place, handled in this country, speaks the pickup
//    place's language, handled of this type anywhere, shortest queue. Every
//    count is decisions minus decisions that were later changed.
//
// `why` is one sentence with the count that decided it. A count, never a score
// or a rank (design/BAHN-VOCABULARY.md; EU AI Act Annex III).

import type { CaseType, OpsPerson, Routing } from "./types"
import { COUNTRY_LANGUAGE, COUNTRY_NAMES, DESK_TITLES, LANGUAGE_NAMES, MONTHS, caseTypeWords, plural } from "./vocab"

export type HistoryRow = {
  personId: string
  caseType: string
  placeId?: string | null
  country?: string | null
  laterChanged: boolean
  at: string
}

export type RouteInput = {
  caseId: string
  type: CaseType
  desk: string
  placeId?: string
  placeName?: string
  country?: string
  people: OpsPerson[]
  history: HistoryRow[]
  /** Open cases already routed to each person. */
  queueLengths?: Map<string, number>
  now: string
  /** Share of cases routed to learn, 0..1. Default 0.2 (one in five). */
  learningShare?: number
}

type Tally = { net: number; since: string | null }

function tally(rows: HistoryRow[]): Tally {
  let net = 0
  let since: string | null = null
  for (const row of rows) {
    if (!row.laterChanged) net++
    if (!since || row.at < since) since = row.at
  }
  return { net, since }
}

function sinceText(iso: string | null): string {
  if (!iso) return ""
  return ` since ${MONTHS[new Date(iso).getUTCMonth()]}`
}

/** Stable 0..99 bucket from a string, so the same case always routes the same way. */
export function bucket(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % 100
}

/** The next working morning, 08:00 Helsinki time, after `now`. */
export function nextShiftStart(now: string): { at: string; dayName: string } {
  const zone = "Europe/Helsinki"
  const date = new Date(now)
  for (let i = 1; i <= 7; i++) {
    const day = new Date(date.getTime() + i * 86_400_000)
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: zone }).format(day)
    if (weekday === "Saturday" || weekday === "Sunday") continue
    const ymd = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }).format(day)
    // 08:00 Helsinki is 05:00 or 06:00 UTC depending on summer time; read the offset for that day.
    const probe = new Date(`${ymd}T08:00:00Z`)
    const offsetName = new Intl.DateTimeFormat("en-GB", { timeZoneName: "shortOffset", timeZone: zone }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT+2"
    const offset = Number(offsetName.replace("GMT", "")) || 2
    const at = new Date(`${ymd}T08:00:00Z`).getTime() - offset * 3_600_000
    return { at: new Date(at).toISOString(), dayName: weekday }
  }
  return { at: now, dayName: "the next working day" }
}

export function routeCase(input: RouteInput): Routing {
  const { people, history, now, type, desk } = input
  const words = caseTypeWords(type)
  const deskTitle = DESK_TITLES[desk] ?? desk
  const withDesk = people.filter((person) => person.desks.includes(desk))
  const onShift = withDesk.filter((person) => person.onShift)
  const ops = onShift.filter((person) => person.role !== "shift_lead")
  const candidates = ops.length ? ops : onShift
  const language = input.country ? COUNTRY_LANGUAGE[input.country] : undefined
  const languageName = language ? LANGUAGE_NAMES[language] : undefined
  const queue = (id: string) => input.queueLengths?.get(id) ?? 0

  const stats = (person: OpsPerson) => {
    const mine = history.filter((row) => row.personId === person.id && row.caseType === type)
    return {
      person,
      place: tally(input.placeId ? mine.filter((row) => row.placeId === input.placeId) : []),
      country: tally(input.country ? mine.filter((row) => row.country === input.country) : []),
      type: tally(mine),
      speaks: !!language && person.languages.includes(language),
    }
  }

  if (!candidates.length) {
    const next = nextShiftStart(now)
    const best = withDesk.map(stats).sort((a, b) => b.type.net - a.type.net || a.person.id.localeCompare(b.person.id))[0]
    return {
      personId: best?.person.id ?? "",
      why: `Nobody on the ${deskTitle} is on shift. It waits for ${next.dayName} 08:00${best ? `, when ${best.person.name} is back` : ""}.`,
      mode: "monday_queue",
      at: next.at,
    }
  }

  const ranked = candidates.map(stats)
  if (ranked.length === 1) {
    return { personId: ranked[0]!.person.id, why: `Sent to you because you are the only one on the ${deskTitle} on shift.`, mode: "only_one_on_shift", at: now }
  }

  const share = input.learningShare ?? 0.2
  const learners = ranked.filter((entry) => entry.type.net < 3)
  if (learners.length && bucket(input.caseId) < share * 100) {
    const learner = [...learners].sort((a, b) => a.type.net - b.type.net || queue(a.person.id) - queue(b.person.id) || a.person.id.localeCompare(b.person.id))[0]!
    const mentor = [...ranked].filter((entry) => entry !== learner).sort((a, b) => b.type.net - a.type.net)[0]
    const so = learner.type.net === 0 ? `this is your first ${words.one}` : `you have handled ${plural(learner.type.net, words.one, words.many)} so far`
    return {
      personId: learner.person.id,
      why: `Sent to you to learn: ${so}.${mentor && mentor.type.net > 0 ? ` ${mentor.person.name} has handled ${mentor.type.net} and is on shift.` : ""}`,
      mode: "learning",
      at: now,
    }
  }

  ranked.sort((a, b) =>
    b.place.net - a.place.net
    || b.country.net - a.country.net
    || Number(b.speaks) - Number(a.speaks)
    || b.type.net - a.type.net
    || queue(a.person.id) - queue(b.person.id)
    || a.person.id.localeCompare(b.person.id))
  const best = ranked[0]!
  const speaks = best.speaks && input.country !== "FI" && languageName ? `, and you speak ${languageName}` : ""
  let why: string
  if (best.place.net > 0 && input.placeName) {
    why = `Sent to you because you have handled ${plural(best.place.net, words.one, words.many)} at ${input.placeName}${sinceText(best.place.since)}${speaks}.`
  } else if (best.country.net > 0 && input.country) {
    why = `Sent to you because you have handled ${plural(best.country.net, words.one, words.many)} in ${COUNTRY_NAMES[input.country] ?? input.country}${sinceText(best.country.since)}${speaks}.`
  } else if (best.speaks && languageName) {
    why = `Sent to you because you speak ${languageName}, the language of the pickup place.`
  } else if (best.type.net > 0) {
    why = `Sent to you because you have handled ${plural(best.type.net, words.one, words.many)}${sinceText(best.type.since)}.`
  } else {
    why = `Sent to you because you have the fewest open cases on the ${deskTitle}.`
  }
  return { personId: best.person.id, why, mode: "best_record", at: now }
}
