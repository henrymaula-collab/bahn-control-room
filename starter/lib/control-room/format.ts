// Human formats, one form each (Henry's rule 12): 24 h clock, day before month,
// "11:38" today, "Yesterday 23:41", "Mon 26 Oct 10:00" otherwise. One clock for the
// room (Helsinki); a pickup place's own time is added in words when it differs.

import type { Case, Fact, SourceKind } from "./types"

export const ROOM_TZ = "Europe/Helsinki"

const parts = (iso: string, tz: string) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  })
  const out: Record<string, string> = {}
  for (const p of f.formatToParts(new Date(iso))) out[p.type] = p.value
  return out
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "11:38" in the room clock (or another zone). */
export function clock(iso: string, tz = ROOM_TZ): string {
  const p = parts(iso, tz)
  return `${p.hour}:${p.minute}`
}

/** Calendar day key in a zone, for comparing days. */
export function dayKey(iso: string, tz = ROOM_TZ): string {
  const p = parts(iso, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** "Wed 21 Oct". */
export function day(iso: string, tz = ROOM_TZ): string {
  const p = parts(iso, tz)
  return `${p.weekday} ${Number(p.day)} ${MONTHS[Number(p.month) - 1]}`
}

/** "19 Oct" without the weekday, for the past. */
function shortDay(iso: string, tz = ROOM_TZ): string {
  const p = parts(iso, tz)
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}`
}

function dayDiff(iso: string, now: string, tz = ROOM_TZ): number {
  const a = Date.parse(`${dayKey(iso, tz)}T00:00:00Z`)
  const b = Date.parse(`${dayKey(now, tz)}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}

/** One form per distance: "11:38", "Yesterday 23:41", "Tomorrow 10:00", "Mon 26 Oct 10:00", "19 Oct 13:59".
 *  Pass mid = true inside a sentence ("Decide by tomorrow 10:00"). */
export function when(iso: string, now: string, tz = ROOM_TZ, mid = false): string {
  const d = dayDiff(iso, now, tz)
  const t = clock(iso, tz)
  if (d === 0) return t
  if (d === -1) return `${mid ? "yesterday" : "Yesterday"} ${t}`
  if (d === 1) return `${mid ? "tomorrow" : "Tomorrow"} ${t}`
  if (d > 1 && d < 14) return `${day(iso, tz)} ${t}`
  return `${shortDay(iso, tz)} ${t}`
}

/** A day without time: "today", "yesterday", "Mon 26 Oct", "19 Oct". */
export function onDay(iso: string, now: string, tz = ROOM_TZ): string {
  const d = dayDiff(iso, now, tz)
  if (d === 0) return "today"
  if (d === -1) return "yesterday"
  if (d === 1) return "tomorrow"
  if (d > 1 && d < 14) return day(iso, tz)
  return shortDay(iso, tz)
}

/** "Mon 26 Oct, 10:00–13:00", or "today, 10:00–13:00". */
export function range(start: string, end: string, now: string, tz = ROOM_TZ): string {
  const d = dayDiff(start, now, tz)
  const dayWord = d === 0 ? "Today" : d === 1 ? "Tomorrow" : day(start, tz)
  return `${dayWord}, ${clock(start, tz)}–${clock(end, tz)}`
}

const CITY_BY_TZ: Record<string, string> = {
  "Europe/Berlin": "Germany",
  "Europe/Copenhagen": "Denmark",
  "Europe/Stockholm": "Sweden",
  "Europe/Paris": "France",
  "Europe/Brussels": "Belgium",
  "Europe/Vienna": "Austria",
}

/** "(10:00–13:00 in Hamburg)" when the place keeps another clock, else "". */
export function localNote(start: string, end: string | undefined, tz: string, place?: string): string {
  if (!tz || tz === ROOM_TZ) return ""
  if (clock(start, tz) === clock(start, ROOM_TZ)) return ""
  const where = place ?? CITY_BY_TZ[tz] ?? tz.split("/")[1]
  const span = end ? `${clock(start, tz)}–${clock(end, tz)}` : clock(start, tz)
  return `(${span} in ${where})`
}

export function minutesUntil(iso: string, now: string): number {
  return Math.round((Date.parse(iso) - Date.parse(now)) / 60_000)
}

/** A case needs a person now when its decide-by time is within the hour, or already past. Rare on purpose. */
export const NOW_WINDOW_MINUTES = 60
export function needsPersonNow(c: Case, now: string): boolean {
  return c.status === "waiting_for_person" && !!c.decideBy && minutesUntil(c.decideBy, now) <= NOW_WINDOW_MINUTES
}

export function euro(amount: number): string {
  return `€${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(amount)}`
}

export function count(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n)
}

const KIND_NAME: Record<SourceKind, string> = {
  customer: "Customer",
  pickup_place: "Pickup place",
  driver: "Driver",
  driver_app: "Driver app",
  person: "Bahn",
  agent: "Readiness agent",
  record: "Order record",
}

const CHANNEL: Record<string, string> = {
  call: "on the phone",
  message: "in a message",
  email: "by email",
  app: "in the driver app",
  record: "on record",
}

/** "Calverona Hamburg, branch desk, on the phone, 11:38". Who, how, when. */
export function sourceLine(f: Fact, now: string): string {
  const who = f.source.name ?? KIND_NAME[f.source.kind]
  const how = f.source.channel ? CHANNEL[f.source.channel] : undefined
  return [who, how, when(f.source.at, now, ROOM_TZ, true)].filter(Boolean).join(", ")
}

/** How strong a fact is, in words (never a percentage). */
export function strengthWords(s: Fact["strength"]): string {
  switch (s) {
    case "confirmed":
      return "Confirmed"
    case "stated":
      return "Not checked yet"
    case "inferred":
      return "Worked out by the agent, not confirmed"
    case "stale":
      return "May be out of date"
  }
}

/** Case types in Bahn's words, for headings and coverage. */
export function caseTypeLabel(type: string): string {
  const map: Record<string, string> = {
    "readiness.car_not_ready": "Car not ready",
    "readiness.facts_disagree": "Facts disagree",
    "readiness.no_answer": "Pickup place not answering",
    "readiness.release_document_missing": "Release document missing",
    "readiness.fee_requested": "Storage fee asked",
    "readiness.keys_or_access": "Keys or access unclear",
  }
  return map[type] ?? type.split(".").pop()!.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

/** Bahn's gate words for why the agent stopped. */
export function reasonWords(r: Case["reasons"][number]): string {
  const map: Record<string, string> = {
    costs_extra_money: "it costs extra money",
    moves_delivery_date: "it moves a delivery date",
    needs_the_customer: "it needs the customer",
    driver_safety: "it is about driver safety",
    facts_disagree: "the facts disagree",
    pickup_place_not_answering: "the pickup place is not answering",
    car_not_ready: "the car is not ready",
    papers_missing: "papers are missing",
  }
  return map[r] ?? r
}

/** Language names for "In German." lines. */
export function languageName(code: string): string {
  const map: Record<string, string> = { de: "German", fi: "Finnish", sv: "Swedish", da: "Danish", en: "English", fr: "French" }
  return map[code] ?? code
}

/** Desk ids to Bahn's desk titles (dataset operators.jsonl). */
const DESK_TITLES: Record<string, string> = {
  "ops-support": "Support desk",
  "ops-readiness": "Readiness desk",
  "ops-planning": "Transport planning",
  "ops-dispatch": "Driver marketplace",
  "ops-import": "Import operations",
  "ops-travel": "Driver travel",
  "ops-shift": "Shift lead",
  "ops-intake": "Order intake",
  "ops-evidence": "Handover evidence",
  "ops-finance": "Cancellation and payment review",
  "ops-expenses": "Driver expense review",
}

export function deskTitle(deskId?: string): string {
  return (deskId && DESK_TITLES[deskId]) || "Ops"
}

// Lower-case the first word only when it is a common word, never a name ("Arvellumio ...").
const COMMON_FIRST = new Set(["a", "an", "the", "accept", "ask", "pay", "move", "keep", "send", "tell", "book", "withdraw", "pause", "hold", "release", "wait", "when", "if", "any"])
export function lcFirst(s: string): string {
  const first = s.split(/\s+/)[0] ?? ""
  return COMMON_FIRST.has(first.toLowerCase()) ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

/** A trust rule as one sentence: "When a pickup place in Germany asks for a storage fee up to €50, accept the fee and confirm the pickup." */
export function ruleSentence(r: { when: string; then: string }): string {
  const then = lcFirst(r.then.replace(/\.$/, ""))
  const w = r.when.replace(/\.$/, "")
  const at = w.match(/^At ([^,]+), (.+)$/)
  if (at) return `At ${at[1]}, when ${lcFirst(at[2])}, ${then}.`
  if (/^when /i.test(w)) return `When ${w.slice(5)}, ${then}.`
  return `When ${lcFirst(w)}, ${then}.`
}

/** How a kind of case reads inside a sentence: "Only Jonas handles missing release documents." */
export function caseTypePhrase(type: string): string {
  const map: Record<string, string> = {
    "readiness.car_not_ready": "cars that are not ready",
    "readiness.facts_disagree": "cases where the details disagree",
    "readiness.no_answer": "pickup places that do not answer",
    "readiness.release_document_missing": "missing release documents",
    "readiness.fee_requested": "fee requests",
    "readiness.keys_or_access": "key and access questions",
  }
  return map[type] ?? caseTypeLabel(type).toLowerCase()
}
