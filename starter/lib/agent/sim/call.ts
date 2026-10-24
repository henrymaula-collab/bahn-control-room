// A simulated phone call to a pickup place. Bahn's side is a model given the
// goal, the order and the lessons; the pickup place is a model persona with
// a hidden truth (sim/places.ts). The phone is fake, the conversation is not
// scripted (except in mock mode). The agent never waits for a person during
// a call: when something needs a decision it ends politely and promises to
// get back within the hour.

import type { Call, Fact, Lesson } from "@/lib/control-room/types"
import type { RunClock } from "../clock"
import { fmtRange } from "../clock"
import { guards, type Provider, type Usage } from "../config"
import { forOrder, LANGUAGE_NAMES, vehicleFor, vehicleLabel, type OrderRow } from "../data"
import type { FactRegistry } from "../facts"
import { structured } from "../providers"
import { shortId } from "../store"
import { PHRASES } from "./phrases"
import { personaFor, type PlacePersona, type TruthItem } from "./places"

export interface CallRequest {
  order: OrderRow
  goal: string
  language?: string
  provider: Provider
  model: string
  clock: RunClock
  registry: FactRegistry
  usage: Usage
  lessons: Lesson[]
  caseId?: string
  kind: "first" | "callback"
  decision?: string // for a callback: what the person decided, in plain words
}

export interface CallResult {
  call: Call
  facts: Fact[]
  summary: string
  needsDecision: boolean
  persona: PlacePersona
}

type Turn = Call["turns"][number]

const TURN_SCHEMA_AGENT = {
  type: "object",
  properties: {
    text: { type: "string", description: "What you say, in the call language" },
    translation: { type: "string", description: "The same sentence in English" },
    end_call: { type: "boolean", description: "true when this is your last sentence of the call" },
  },
  required: ["text", "translation", "end_call"],
  additionalProperties: false,
}

const TURN_SCHEMA_PLACE = {
  type: "object",
  properties: {
    text: { type: "string" },
    translation: { type: "string" },
    hang_up: { type: "boolean", description: "true when you say goodbye" },
  },
  required: ["text", "translation", "hang_up"],
  additionalProperties: false,
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string", description: "One plain English sentence of what the pickup place said, Bahn's words (order, pickup place, driver, customer, release document)" },
          turn: { type: "integer", description: "Index of the turn it was said in" },
          strength: { type: "string", enum: ["stated", "confirmed"] },
        },
        required: ["statement", "turn", "strength"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "One sentence: what the call established" },
    needs_decision: { type: "boolean", description: "true if something now needs a person's yes (a cost, a new date, the customer, a booking)" },
  },
  required: ["facts", "summary", "needs_decision"],
  additionalProperties: false,
}

function slotText(order: OrderRow, tz: string): string {
  const w = forOrder("time_windows", order.id).find((x) => x.purpose === "SELECTED_PICKUP_SLOT" && x.is_selected)
    ?? forOrder("time_windows", order.id).find((x) => x.purpose === "SELECTED_PICKUP_SLOT")
  return w ? fmtRange(String(w.start_at), String(w.end_at), tz) : "not set"
}

function transcriptText(turns: Turn[], persona: PlacePersona): string {
  return turns.map((t) => `${t.speaker === "agent" ? "Bahn" : persona.placeName}: ${t.text}`).join("\n")
}

function speakSeconds(text: string): number {
  return Math.max(2, text.split(/\s+/).length / 2.6) + 1
}

function callerSystem(req: CallRequest, persona: PlacePersona, lang: string): string {
  const car = vehicleLabel(vehicleFor(req.order))
  const lessons = req.lessons.map((l) => `- ${l.text}`).join("\n") || "- none"
  return [
    `You are Bahn's digital assistant on a phone call with a pickup place. Bahn delivers used cars for car dealers; one freelance driver drives each car.`,
    `Speak natural, spoken ${LANGUAGE_NAMES[lang] ?? lang}. One or two short sentences per turn.`,
    `Order ${req.order.reference}: ${car}. Pickup place: ${persona.placeName}, ${persona.city}. Selected pickup slot: ${slotText(req.order, persona.timeZone)} local time.`,
    `Your goal for this call: ${req.goal}`,
    req.decision ? `A Bahn person has decided: ${req.decision}. Tell the pickup place what this means for them and confirm the next step.` : "",
    `What Bahn already learned about this pickup place:\n${lessons}`,
    `Rules: say at the start that you are Bahn's digital assistant. Ask, listen, and repeat back what matters. Never agree to a cost, a new date, a booking or any change to the order on this call: if the pickup place asks for money or a change, say that a colleague decides and that Bahn will get back to them within the hour. Never share the customer's details. Do not offer to hold the line or wait: if they need to check something, ask them to send it to Bahn and end the call. End politely as soon as you have what you need, or when they cannot help.`,
    `Return JSON: text (what you say, in ${LANGUAGE_NAMES[lang] ?? lang}), translation (English), end_call.`,
  ].filter(Boolean).join("\n\n")
}

function placeSystem(persona: PlacePersona, lang: string): string {
  const facts = persona.truths.map((t) => `- ${t.en}${t.local?.[lang] ? ` (you might say: "${t.local[lang]}")` : ""}`).join("\n")
  return [
    `You are ${persona.contactName}, ${persona.role} at ${persona.placeName} in ${persona.city}. This is a simulated phone call for a demo; stay in character.`,
    `A caller from Bahn, a car delivery company, phones about collecting a car. Speak natural, spoken ${LANGUAGE_NAMES[lang] ?? lang}, one or two short sentences, like a busy but helpful person at a car dealer.`,
    `What you know (only this; never invent other facts; if asked something else, say you would have to check):\n${facts || "- The car is ready for the booked slot."}`,
    `When the caller asks whether the car is ready or what is needed, mention any problem the driver would run into (a fee, the car not being ready, a missing release document, a hold, a different place to collect it). You are not the customer and do not speak for them.`,
    `Return JSON: text (in ${LANGUAGE_NAMES[lang] ?? lang}), translation (English), hang_up (true when you say goodbye).`,
  ].join("\n\n")
}

async function liveCall(req: CallRequest, persona: PlacePersona, lang: string, callId: string): Promise<{ turns: Turn[] }> {
  const turns: Turn[] = []
  const push = (speaker: Turn["speaker"], text: string, translation: string) => {
    const at = req.clock.advance(speakSeconds(text))
    turns.push({ speaker, text, translation: lang === "en" ? undefined : translation, at })
  }
  const placeSys = placeSystem(persona, lang)
  const callerSys = callerSystem(req, persona, lang)
  const first = await structured<{ text: string; translation: string; hang_up: boolean }>(
    { provider: req.provider, model: req.model, system: placeSys, prompt: "The phone rings and you pick up. Answer it.", schema: TURN_SCHEMA_PLACE, effort: "low" },
    req.usage,
  )
  push("pickup_place", first.text, first.translation)
  let ended = false
  for (let i = 0; i < guards.maxCallTurns && !ended; i++) {
    const a = await structured<{ text: string; translation: string; end_call: boolean }>(
      { provider: req.provider, model: req.model, system: callerSys, prompt: `Call so far:\n${transcriptText(turns, persona)}\n\nYour turn (Bahn).`, schema: TURN_SCHEMA_AGENT, effort: "low" },
      req.usage,
    )
    push("agent", a.text, a.translation)
    const p = await structured<{ text: string; translation: string; hang_up: boolean }>(
      { provider: req.provider, model: req.model, system: placeSys, prompt: `Call so far:\n${transcriptText(turns, persona)}\n\nYour turn (${persona.placeName}).`, schema: TURN_SCHEMA_PLACE, effort: "low" },
      req.usage,
    )
    push("pickup_place", p.text, p.translation)
    ended = a.end_call || p.hang_up
  }
  void callId
  return { turns }
}

/** Which truths the persona says on a mock call, in a sensible order. */
function mockTruths(persona: PlacePersona, req: CallRequest): TruthItem[] {
  const scenario = persona.truths.filter((t) => t.source === "scenario")
  const order = ["location", "checking", "hold", "not_ready", "ready", "papers_missing", "release_procedure", "fee", "keys"]
  const rank = (t: TruthItem) => (t.kind ? order.indexOf(t.kind) : 99)
  if (scenario.length) {
    const sorted = [...scenario].sort((a, b) => rank(a) - rank(b))
    if (req.kind === "callback") return sorted.filter((t) => t.kind === "release_procedure" || t.kind === "ready").slice(0, 1)
    return sorted
  }
  return persona.truths.filter((t) => t.kind === "access" || t.kind === "papers_missing").slice(0, 2)
}

function mockCall(req: CallRequest, persona: PlacePersona, lang: string): { turns: Turn[]; spoken: TruthItem[] } {
  const truths = mockTruths(persona, req)
  // Mock mode has no translator: speak the place's language only when every line has a local version.
  const useLang = req.kind === "first" && lang !== "en" && PHRASES[lang] && truths.length > 0 && truths.every((t) => t.local?.[lang]) ? lang : "en"
  const P = PHRASES[useLang]
  const E = PHRASES.en
  const car = vehicleLabel(vehicleFor(req.order))
  const turns: Turn[] = []
  const push = (speaker: Turn["speaker"], text: string, en: string) => {
    const at = req.clock.advance(speakSeconds(text))
    turns.push({ speaker, text, translation: useLang === "en" ? undefined : en, at })
  }
  const role = persona.roleLocal && useLang !== "en" ? persona.roleLocal : persona.role
  push("pickup_place", P.greeting(persona.placeName, role, persona.contactName), E.greeting(persona.placeName, persona.role, persona.contactName))
  if (req.kind === "callback") {
    push("agent", P.callbackIntro(req.order.reference), E.callbackIntro(req.order.reference))
    push("agent", req.decision ?? E.ack, req.decision ?? E.ack)
  } else {
    push("agent", P.intro(req.order.reference, car), E.intro(req.order.reference, car))
    const releaseGoal = /release document|freigabe|luovutus/i.test(req.goal)
    push("agent", releaseGoal ? P.askRelease : P.askReady, releaseGoal ? E.askRelease : E.askReady)
  }
  const spoken: TruthItem[] = []
  for (const t of truths) {
    push("pickup_place", useLang === "en" ? t.en : t.local![useLang], t.en)
    spoken.push(t)
    if (t !== truths[truths.length - 1]) push("agent", P.ack, E.ack)
  }
  if (truths.length === 0) push("pickup_place", P.nothingElse, E.nothingElse)
  const needs = req.kind === "first" && spoken.some((t) => ["fee", "not_ready", "hold", "papers_missing", "checking"].includes(t.kind ?? ""))
  push("agent", needs ? P.closeDecision : P.closeOk, needs ? E.closeDecision : E.closeOk)
  push("pickup_place", P.bye, E.bye)
  return { turns, spoken }
}

export async function simulateCall(req: CallRequest): Promise<CallResult> {
  const persona = personaFor(req.order)
  const lang = req.language ?? persona.language
  const callId = shortId("call")
  const startedAt = req.clock.now()
  const sourceName = `${persona.placeName}, ${persona.contactName} (${persona.role})`

  if (!persona.answers && req.kind === "first") {
    req.clock.advance(45)
    const fact = req.registry.add(
      `Called ${persona.placeName}. Nobody answered.${persona.noAnswerNote ? ` ${persona.noAnswerNote}` : ""}`,
      { kind: "agent", name: "Readiness agent", channel: "call", recordRef: `calls:${callId}`, at: startedAt },
      "confirmed",
    )
    const call: Call = { id: callId, caseId: req.caseId, orderId: req.order.id, placeId: persona.placeId, language: lang, startedAt, outcome: "no_answer", turns: [], factIds: [fact.id] }
    return { call, facts: [fact], summary: `No answer at ${persona.placeName}.`, needsDecision: false, persona }
  }

  let turns: Turn[]
  let facts: Fact[] = []
  let summary: string
  let needsDecision: boolean
  if (req.provider === "mock") {
    const m = mockCall(req, persona, lang)
    turns = m.turns
    const language = turns.some((t) => t.translation) ? lang : "en"
    for (const t of m.spoken) {
      const idx = turns.findIndex((x) => x.speaker === "pickup_place" && (x.translation ?? x.text) === t.en)
      facts.push(req.registry.add(t.en, { kind: "pickup_place", name: sourceName, channel: "call", recordRef: `calls:${callId}`, at: turns[Math.max(0, idx)]?.at ?? startedAt }, "stated"))
    }
    summary = m.spoken.length ? m.spoken.map((t) => t.en).join(" ") : "The pickup place had nothing to add."
    needsDecision = req.kind === "first" && m.spoken.some((t) => ["fee", "not_ready", "hold", "papers_missing", "checking"].includes(t.kind ?? ""))
    const call: Call = { id: callId, caseId: req.caseId, orderId: req.order.id, placeId: persona.placeId, language, startedAt, outcome: "answered", turns, factIds: facts.map((f) => f.id) }
    return { call, facts, summary, needsDecision, persona }
  }

  const live = await liveCall(req, persona, lang, callId)
  turns = live.turns
  const transcript = turns.map((t, i) => `${i} ${t.speaker === "agent" ? "Bahn" : persona.placeName}: ${t.translation ?? t.text}`).join("\n")
  const extracted = await structured<{ facts: { statement: string; turn: number; strength: "stated" | "confirmed" }[]; summary: string; needs_decision: boolean }>(
    {
      provider: req.provider,
      model: req.model,
      system: "You turn a phone call transcript into facts for a car delivery control room. Only what the pickup place said, never what Bahn said. Plain English, one fact per sentence, no speculation.",
      prompt: `Pickup place: ${persona.placeName}. Goal of the call: ${req.goal}\n\nTranscript (English):\n${transcript}`,
      schema: EXTRACT_SCHEMA,
      effort: "low",
    },
    req.usage,
  )
  facts = extracted.facts.map((f) =>
    req.registry.add(f.statement, { kind: "pickup_place", name: sourceName, channel: "call", recordRef: `calls:${callId}`, at: turns[Math.min(Math.max(f.turn, 0), turns.length - 1)]?.at ?? startedAt }, f.strength),
  )
  summary = extracted.summary
  needsDecision = extracted.needs_decision
  const call: Call = { id: callId, caseId: req.caseId, orderId: req.order.id, placeId: persona.placeId, language: lang, startedAt, outcome: "answered", turns, factIds: facts.map((f) => f.id) }
  return { call, facts, summary, needsDecision, persona }
}
