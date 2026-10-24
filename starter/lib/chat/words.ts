// Small text helpers for the chat, in Bahn's words (design/BAHN-VOCABULARY.md).

import type { CaseReason, Fact } from "@/lib/control-room/types"

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Helsinki" })
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Helsinki" })

/** "Sat 24 Oct" (Helsinki). */
export const day = (iso: string) => DAY.format(new Date(iso)).replace(",", "")
/** "Sat 24 Oct 14:05" (Helsinki). */
export const dayTime = (iso: string) => `${day(iso)} ${TIME.format(new Date(iso))}`

export const lc = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
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
  const raw = f.source.name?.trim()
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

export function restsOn(facts: Fact[]): string | undefined {
  const picked = rankFacts(facts).slice(0, 2)
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
