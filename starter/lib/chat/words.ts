// Small text helpers for the chat, in Bahn's words (design/BAHN-VOCABULARY.md).

import type { CaseReason, Fact } from "@/lib/control-room/types"

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Helsinki" })
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Helsinki" })

/** "Sat 24 Oct" (Helsinki). */
export const day = (iso: string) => DAY.format(new Date(iso)).replace(",", "")
/** "Sat 24 Oct 14:05" (Helsinki). */
export const dayTime = (iso: string) => `${day(iso)} ${TIME.format(new Date(iso))}`

/**
 * The control room's one time zone for the chat: the people sit in Helsinki. Every tool answer gives
 * times this way, labelled the same, so the model never converts (a UTC 08:58 once came out as 10:58).
 */
export const PERSON_ZONE_LABEL = "Helsinki time"
export const stamp = (iso: string) => `${dayTime(iso)} ${PERSON_ZONE_LABEL}`

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/

/** Every timestamp in a tool's JSON answer, in the person's zone with its label. A place's own "local" range keeps its zone, renamed so it reads as local. */
export function inPersonZone(v: unknown): unknown {
  if (typeof v === "string") return ISO_TIME.test(v) && !Number.isNaN(Date.parse(v)) ? stamp(v) : v
  if (Array.isArray(v)) return v.map(inPersonZone)
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k === "local" ? "local_time_at_the_place" : k, inPersonZone(x)]))
  return v
}

/** Sentence starters that may go lower case mid-sentence; anything else (a place, a person, a dealer) keeps its capital. */
const COMMON = new Set(
  ("the a an ask move keep pause go hold release accept call wait send book cancel tell check let write pay follow confirm find get take use try " +
    "you it its this that these those nobody nothing no not only if when there we they our driver drivers customer pickup delivery order gig seller car " +
    "mark rebook offer give put leave stop agree change choose decide email message drafts draft agent people someone everyone").split(" "),
)

export const lc = (s: string) => {
  const first = /^[A-Z][a-z]*/.exec(s)?.[0]
  return first && COMMON.has(first.toLowerCase()) ? s.charAt(0).toLowerCase() + s.slice(1) : s
}
export const sentence = (s: string) => {
  const t = s.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "Aino", "Aino and Mikko", "Aino, Mikko and Sofie". */
export function names(list: string[]): string {
  const u = [...new Set(list)]
  if (u.length <= 1) return u[0] ?? ""
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`
}

/** Why the decision needs a person: Bahn's three gates, plus safety. */
const REASON_WORDS: Partial<Record<CaseReason, string>> = {
  needs_the_customer: "only the customer can settle it",
  costs_extra_money: "it costs extra money",
  moves_delivery_date: "the delivery date would move",
  driver_safety: "it is a safety call",
}

export function needsYou(reasons: CaseReason[]): string | undefined {
  const parts = reasons.map((r) => REASON_WORDS[r]).filter((x): x is string => !!x)
  if (!parts.length) return undefined
  return `It comes to you because ${names(parts)}.`
}

const WHO: Record<Fact["source"]["kind"], string> = {
  customer: "the customer",
  pickup_place: "the pickup place",
  driver: "the driver",
  driver_app: "the driver app",
  person: "a Bahn colleague",
  agent: "the agent",
  record: "the order",
}

/** Where a fact comes from, in a phrase: "what Calverona Hamburg said on the call on Wed 21 Oct". */
export function sourcePhrase(f: Fact): string {
  const raw = f.source.name?.split(",")[0]?.trim()
  const who = raw && !/^[a-z_ ]+$/.test(raw) ? raw : WHO[f.source.kind]
  const when = f.source.at ? ` on ${day(f.source.at)}` : ""
  switch (f.source.channel) {
    case "call":
      return `what ${who} said on the call${when}`
    case "email":
      return `the email from ${who}${when}`
    case "message":
      return `the message from ${who}${when}`
    case "app":
      return `the driver app${when}`
    default:
      return f.source.kind === "record" ? "the order record" : `what ${who} stated${when}`
  }
}

/** The one or two facts a suggestion rests on: people's own words first, then records. */
const WHO_RANK: Record<Fact["source"]["kind"], number> = { pickup_place: 0, driver: 1, driver_app: 1, customer: 2, person: 3, record: 4, agent: 5 }
const CHANNEL_RANK = (c: Fact["source"]["channel"]) => (c === "call" ? 0 : c === "email" || c === "message" || c === "app" ? 1 : 2)

/** Facts people stated, strongest first: the pickup place's own words weigh most, a call more than a message; records last. */
export function rankFacts(facts: Fact[]): Fact[] {
  return facts
    .filter((f) => f.source.kind !== "agent" && f.strength !== "stale")
    .sort((a, b) => CHANNEL_RANK(a.source.channel) - CHANNEL_RANK(b.source.channel) || WHO_RANK[a.source.kind] - WHO_RANK[b.source.kind])
}

export function restsOn(facts: Fact[], max = 2): string | undefined {
  const picked = rankFacts(facts).slice(0, max)
  const phrases = [...new Set(picked.map(sourcePhrase))]
  return phrases.length ? names(phrases) : undefined
}

/** "chose to ask the customer ..." or "chose another way: ..." */
export function chosePhrase(choice: string): string {
  if (/^another way/i.test(choice)) return `chose another way`
  if (/^[A-Z][a-z]+ /.test(choice)) return `chose to ${lc(choice)}`
  return `chose: ${choice}`
}

/** Words the chat must never say (Henry's rules and Bahn's vocabulary). */
export const BANNED_WORDS = /\b(ticket|tickets|human|humans|escalate|escalated|escalation|AI|bot|chatbot|assistant)\b/

/** The larger budget for an answer the person explicitly asked to be detailed. */
export const DETAIL_WORDS = { text: 140, voice: 70 } as const

/**
 * The person explicitly asks for detail: the exact words, everything, a list, the contact.
 * English, Swedish, Finnish, German and Danish, typed or said.
 */
const DETAIL = new RegExp(
  [
    // English
    String.raw`\b(exact(ly)?|precise(ly)?|word for word|verbatim|in (full|detail)|full (text|story|details?|picture|thread|transcript)|all the details|every(thing| detail)|the whole (thread|email|message|call|story)|quote|read (me |it |out |back )?(the )?(email|message|mail|thread|call|transcript|it)|walk me through|tell me (more|everything|all)|give me (the )?(details|specifics|everything)|more detail|details?\b.*\?|what did (\w+ ){1,3}(write|say|send|reply|answer|tell)|what does (the|their|his|her) (email|message|mail|note) say|list (the|all|every|them)|which documents|who is the contact|contact (person|details|number)|phone number|how (do|can) (i|we) reach)`,
    // Swedish
    String.raw`\b(exakt|ordagrant|berätta (allt|mer)|alla detaljer|i detalj|läs upp|vad (skrev|sa) (de|han|hon)|vem är kontakt|kontaktperson|telefonnummer|lista (alla|dokumenten)|vilka dokument)`,
    // Finnish
    String.raw`(tarkalleen|tarkasti|sanasta sanaan|kerro kaikki|kaikki yksityiskohdat|yksityiskohtaisesti|lue (minulle|se|viesti)|mitä (he|hän|se|myyjä|asiakas) (kirjoitti|sanoi)|kuka on yhteyshenkilö|yhteyshenkilö|puhelinnumero|luettele|listaa|mitkä dokumentit|mitkä paperit)`,
    // German
    String.raw`\b(genau|wortwörtlich|wörtlich|alles erzählen|alle details|im detail|einzelheiten|vorlesen|lies (mir )?vor|was hat .{1,30} geschrieben|wer ist (der|die) ansprechpartner|ansprechpartner(in)?|telefonnummer|liste|auflisten|welche dokumente|welche unterlagen)`,
    // Danish
    String.raw`\b(præcis|ordret|fortæl (alt|mere)|alle detaljer|i detaljer|læs (det )?op|hvad skrev|hvem er kontakt|kontaktperson|telefonnummer|hvilke dokumenter)`,
  ].join("|"),
  "i",
)

export function asksForDetail(text: string): boolean {
  return DETAIL.test(text)
}
