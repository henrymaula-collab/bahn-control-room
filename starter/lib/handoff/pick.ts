// Who to send a case to when you cannot handle it (Henry, 25 Oct: "Send to a colleague, in case
// you can't handle it at all"; the AI recommends the person). An explainable rule, like routing
// (lib/control-room/routing.ts), with counts from the same decisions:
//
// 1. Colleagues are people on shift who sit on the case's desk, not the sender. The shift lead
//    only when nobody else is.
// 2. They are ordered by plain facts, in this order: reads the pickup place's language (when the
//    sender does not, the likely reason a case gets passed on), handled this kind at this pickup
//    place, in this country, anywhere, fewest open tasks. Every count is decisions minus decisions
//    later changed.
// 3. The first is the pick. Its line names the fact that put it first, so it is always true.
//
// A count, never a score or a rank (design/BAHN-VOCABULARY.md).

import type { Case, OpsPerson } from "@/lib/control-room/types"
import { COUNTRY_LANGUAGE, COUNTRY_NAMES, LANGUAGE_NAMES, caseTypeWords, plural } from "@/lib/control-room/vocab"

export type Colleague = {
  personId: string
  name: string
  avatar?: string
  /** For the card row's subline: "Jonas reads German". */
  short: string
  /** One line under the name in the panel: "Reads German, the language at Calverona Hamburg." */
  reason: string
  /** Open tasks waiting for this person now. */
  open: number
}

export type PickInput = {
  c: Pick<Case, "id" | "type" | "desk" | "placeId" | "status" | "routedTo">
  from: OpsPerson
  people: OpsPerson[]
  /** Every case in the room, for open-task counts. */
  cases: Pick<Case, "status" | "routedTo">[]
  decisions: { personId: string; caseType: string; placeId?: string | null; country?: string | null; laterChanged: boolean }[]
  place?: { name: string; country?: string }
}

const tasks = (n: number) => (n === 0 ? "no open tasks" : n === 1 ? "1 open task" : `${n} open tasks`)
const cap = (s: string) => s.replace(/^./, (ch) => ch.toUpperCase())

export function colleaguesFor(input: PickInput): Colleague[] {
  const { c, from, people, place } = input
  const words = caseTypeWords(c.type)
  const withDesk = people.filter((p) => p.id !== from.id && p.onShift && p.desks.includes(c.desk))
  const ops = withDesk.filter((p) => p.role !== "shift_lead")
  const candidates = ops.length ? ops : withDesk
  const language = place?.country ? COUNTRY_LANGUAGE[place.country] : undefined
  const languageName = language ? LANGUAGE_NAMES[language] : undefined
  // Language only counts when the sender lacks it: then it is the likely reason to pass the case on.
  const languageMatters = !!language && !from.languages.includes(language)
  const open = (id: string) => input.cases.filter((x) => x.status === "waiting_for_person" && x.routedTo?.personId === id).length

  const stats = candidates.map((p) => {
    const mine = input.decisions.filter((d) => d.personId === p.id && d.caseType === c.type && !d.laterChanged)
    return {
      p,
      speaks: languageMatters && p.languages.includes(language!),
      atPlace: c.placeId ? mine.filter((d) => d.placeId === c.placeId).length : 0,
      inCountry: place?.country ? mine.filter((d) => d.country === place.country).length : 0,
      ofType: mine.length,
      open: open(p.id),
    }
  })
  stats.sort(
    (a, b) =>
      Number(b.speaks) - Number(a.speaks) ||
      b.atPlace - a.atPlace ||
      b.inCountry - a.inCountry ||
      b.ofType - a.ofType ||
      a.open - b.open ||
      a.p.id.localeCompare(b.p.id),
  )

  return stats.map((s, i) => {
    const name = s.p.name
    let short: string
    let reason: string
    if (s.speaks && languageName) {
      short = `${name} reads ${languageName}`
      reason = `Reads ${languageName}, the language at ${place?.name ?? "the pickup place"}`
    } else if (s.atPlace > 0 && place) {
      short = `${name} has handled ${s.atPlace} at ${place.name}`
      reason = `Has handled ${plural(s.atPlace, words.one, words.many)} at ${place.name}`
    } else if (s.inCountry > 0 && place?.country) {
      const country = COUNTRY_NAMES[place.country] ?? place.country
      short = `${name} has handled ${s.inCountry} in ${country}`
      reason = `Has handled ${plural(s.inCountry, words.one, words.many)} in ${country}`
    } else if (s.ofType > 0) {
      short = `${name} has handled ${s.ofType} like it`
      reason = `Has handled ${plural(s.ofType, words.one, words.many)}`
    } else {
      short = `${name} has ${tasks(s.open)}`
      reason = cap(i === 0 && stats.length > 1 ? `${tasks(s.open)}, the fewest on the desk` : tasks(s.open))
    }
    return { personId: s.p.id, name, ...(s.p.avatar ? { avatar: s.p.avatar } : {}), short, reason: `${reason}.`, open: s.open }
  })
}
