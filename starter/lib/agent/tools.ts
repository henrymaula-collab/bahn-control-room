// The Readiness agent's tools. Provider-agnostic: the same definitions and
// handlers serve the Anthropic API loop, the Claude Agent SDK (as an
// in-process MCP server) and the mock. Read tools register every fact they
// return (who said it, how, when). Write tools pass the authority gate.

import { z } from "zod"
import type { AgentStep, Call, Case, CaseReason, Change, Decision, Fact, Lesson, Option, OrderCheck } from "@/lib/control-room/types"
import type { RunClock } from "./clock"
import { fmtLocal, fmtRange, hoursBetween } from "./clock"
import type { Provider, Usage } from "./config"
import {
  activeAssignment, byId, conversationsFor, customer, driver, forOrder, LANGUAGE_NAMES, messagesFor, pickupPlace, placeLanguage, str,
  table, vehicleFor, vehicleLabel, type OrderRow, type Row,
} from "./data"
import { channelFrom, sourceKindFrom, type FactRegistry } from "./facts"
import { checkChanges, contactCheck, messageCommits, type TrustRule } from "./gate"
import { acceptedLessons, lessonOrigin, lessonStatement } from "./learning"
import { personName } from "./people"
import type { CallbackBrief } from "./prompt"
import { structured } from "./providers"
import { simulateCall } from "./sim/call"
import { messageDriver, messagePickupPlace } from "./sim/messages"
import type { AgentStore, Callback } from "./store"
import { shortId } from "./store"
import type { TraceWriter } from "./trace"

export interface RunContext {
  runId: string
  provider: Provider
  callModel: string
  order: OrderRow
  clock: RunClock
  registry: FactRegistry
  store: AgentStore
  usage: Usage
  trace: TraceWriter
  steps: AgentStep[]
  calls: Call[]
  lessonsUsed: Lesson[]
  /** What the store held when the run started (lessons, decisions, rules, earlier cases). */
  snap: { lessons: Lesson[]; decisions: Decision[]; trustRules: TrustRule[]; cases: Case[] }
  outcome?: { kind: "case_for_person" | "resolved" | "waiting"; caseId?: string; summary: string }
  callbackFor?: CallbackBrief
}

export interface ToolResult {
  content: string
  isError: boolean
  /** true when this tool ends the run (a case was proposed or the order resolved). */
  terminal?: boolean
}

const CASE_TYPES = [
  "readiness.car_not_ready",
  "readiness.facts_disagree",
  "readiness.no_answer",
  "readiness.release_document_missing",
  "readiness.fee_requested",
  "readiness.keys_or_access",
] as const

const REASONS = [
  "costs_extra_money", "moves_delivery_date", "needs_the_customer", "driver_safety", "facts_disagree", "pickup_place_not_answering", "car_not_ready", "papers_missing",
] as const

/**
 * Semantic option ids, shared with the foundation (lib/control-room/learning.ts
 * OPTION_TEXT). Trust rules and the learning loop match decisions on these.
 */
export const OPTION_KEYS = [
  "pause_gig", "follow_pickup_place", "keep_slot_call_again", "hold_driver_until_key_holder", "driver_waits",
  "release_driver", "accept_fee", "ask_customer", "ask_customer_for_release", "move_pickup_next_day", "other",
] as const

const changeShape = z.object({
  kind: z.enum(["date", "cost", "booking", "customer_message", "driver_message", "none"]),
  detail: z.string().describe("What changes, e.g. 'Pickup moves from Mon 26 Oct to Tue 27 Oct'. For a customer_message, the exact draft text."),
  amount_eur: z.number().nullable().describe("Amount in EUR for a cost change, else null"),
})

const draftShape = z.object({
  to: z.string().describe("Who receives it and how, e.g. 'Kovellin Automobilhandel, by email'"),
  language: z.string().describe("Two-letter language of the recipient (the customer's country)"),
  text: z.string().describe("The message in the recipient's language, ready to send"),
  translation: z.string().describe("The same message in English, or empty when it is already English"),
})

const optionShape = z.object({
  key: z.enum(OPTION_KEYS).describe("The kind of option, from Bahn's list; 'other' when none fits"),
  label: z.string().describe("Names the action, e.g. 'Ask the customer to move delivery to Tuesday'. Never 'Approve'."),
  effect: z.string().describe("What happens next, in one sentence, e.g. 'The agent sends your message and calls the pickup place back.'"),
  changes: z.array(changeShape),
  draft: draftShape.nullable().describe("For an option that sends a message (to the customer or the pickup place): the draft a person reads before sending. Else null."),
  why_choices: z.array(z.string()).describe("Three short reasons a person might choose this option, each written as a rule someone could reuse"),
})

const orderArg = z.string().describe("Order reference, e.g. CD-420516")

export const TOOL_SHAPES = {
  get_order: { order: orderArg },
  get_pickup_place: { order: orderArg },
  get_conversations: { order: orderArg },
  get_documents: { order: orderArg },
  get_time_windows: { order: orderArg },
  list_trust_rules: {},
  message_driver: { order: orderArg, text: z.string().describe("The message for the driver, in the language of the driver's chat. Asking needs no yes; never agree to a cost, date or booking.") },
  message_pickup_place: { order: orderArg, text: z.string().describe("A written question to the pickup place. Asking needs no yes; never agree to a cost, date or booking.") },
  call_pickup_place: {
    order: orderArg,
    goal: z.string().describe("What the call must find out, in one sentence"),
    language: z.string().describe("Two-letter language of the pickup place, e.g. de, fi, da, en"),
  },
  propose_case: {
    order: orderArg,
    type: z.enum(CASE_TYPES),
    headline: z.string().describe("One sentence: what is wrong, in Bahn's words"),
    reasons: z.array(z.enum(REASONS)),
    fact_ids: z.array(z.string()).describe("Ids of registered facts the person needs, most important first"),
    new_facts: z.array(z.object({
      statement: z.string().describe("A conclusion you drew, in one sentence"),
      basis_fact_ids: z.array(z.string()),
    })).describe("Your own conclusions, each resting on registered facts; shown as 'inferred by the agent'"),
    suggestion: optionShape,
    alternatives: z.array(optionShape),
    decide_by: z.string().describe("ISO time: the latest useful moment for the decision, or empty"),
    lesson_ids_used: z.array(z.string()).describe("Ids of accepted lessons you applied, or empty"),
  },
  resolve_without_person: {
    order: orderArg,
    type: z.enum(CASE_TYPES),
    summary: z.string().describe("One sentence: why nothing needs a person"),
    checks: z.array(z.object({ label: z.string(), ok: z.boolean(), fact_ids: z.array(z.string()) })),
    changes: z.array(changeShape).describe("Empty when nothing changes"),
    option_key: z.enum(OPTION_KEYS).describe("The option you take, from Bahn's list ('other' when nothing changes)"),
    trust_rule_id: z.string().describe("The trust rule (switched on) that covers this option and these changes, or empty"),
  },
  schedule_callback: {
    order: orderArg,
    due_at: z.string().describe("ISO time for the follow-up"),
    reason: z.string(),
  },
} as const

export type ToolName = keyof typeof TOOL_SHAPES

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  get_order: "Read the order: status, customer, car, pickup and delivery instructions (with who stated them and when), notes, open alerts, work items, the gig and driver. Registers each fact with its source.",
  get_pickup_place: "Look up the pickup place: hours, access, release document rule, its language, whether it is run by the customer, and the accepted lessons for it. Registers facts.",
  get_conversations: "Read every conversation about the order (customer, pickup place, driver, Bahn people) with time and channel. Registers each message as a fact.",
  get_documents: "Check the documents on the order (release document, CMR) and whether the pickup place needs a signed release document.",
  get_time_windows: "Check the pickup slot, availability and delivery promise, who set each one, and how many hours are left.",
  list_trust_rules: "List the trust rules for the Readiness desk. Only a rule that is on lets you make a change without a person.",
  message_driver: "Send the booked driver a question in the driver app (simulated reply). Asking needs no yes.",
  message_pickup_place: "Write to the pickup place (simulated reply). Asking needs no yes.",
  call_pickup_place: "Phone the pickup place in its language (simulated phone, real conversation). Returns the transcript with English translations and the facts the call produced. You never wait for a person during a call.",
  propose_case: "Bring a person ONE clear decision. Use only registered fact ids. The suggestion names the action and says what happens next. Ends your work on this order.",
  resolve_without_person: "Finish without a person: either nothing needs to change, or a trust rule that is on covers exactly these changes. The gate refuses anything else with 'needs a person'. Ends your work on this order.",
  schedule_callback: "Promise a follow-up (call again when nobody answered, or after a person decides).",
}

export const TOOL_NAMES = Object.keys(TOOL_SHAPES) as ToolName[]

// ---------- helpers ----------

const json = (v: unknown) => JSON.stringify(v, null, 1)
const ok = (v: unknown, terminal = false): ToolResult => ({ content: json(v), isError: false, terminal })
const fail = (message: string): ToolResult => ({ content: json({ error: message }), isError: true })

function factOut(f: Fact) {
  return { id: f.id, statement: f.statement, source: `${f.source.kind}${f.source.name ? `: ${f.source.name}` : ""}`, channel: f.source.channel ?? "record", at: f.source.at, strength: f.strength }
}

function deskTitle(id: string | undefined): string {
  const row = table("operators").find((o) => o.id === id)
  return String(row?.title ?? id ?? "Bahn")
}

function authorName(m: Row, order: OrderRow): string {
  const t = String(m.author_type)
  if (t === "customer") return String(customer(str(m.author_id))?.name ?? "Customer")
  if (t === "site_contact") return String(byId("sites", str(m.author_id))?.name ?? "Pickup place")
  if (t === "driver") return `Driver ${String(driver(str(m.author_id))?.display_name ?? "")}`.trim()
  if (t === "operator") return deskTitle(str(m.author_id))
  if (t === "handoff_contact") return "Handover contact"
  if (t === "agent") return "Bahn agent"
  void order
  return t
}

function step(ctx: RunContext, kind: AgentStep["kind"], summary: string, extra: Partial<AgentStep> = {}): AgentStep {
  const s: AgentStep = { at: ctx.clock.now(), kind, summary, ...extra }
  ctx.steps.push(s)
  return s
}

function sameOrder(ctx: RunContext, ref: string): boolean {
  const k = ref.trim().toUpperCase()
  return k === ctx.order.reference.toUpperCase() || k === ctx.order.id.toUpperCase()
}

function endpointStrength(e: Row): Fact["strength"] {
  if (e.last_confirmed_source === "MANAGED_SITE_PROFILE" || e.stated_by === "MANAGED_SITE_PROFILE") return "inferred"
  if (e.access_status === "CONFIRMED") return "confirmed"
  return "stated"
}

function siteFor(ctx: RunContext) {
  return pickupPlace(ctx.order)
}

function caseContext(ctx: RunContext, type: string) {
  const { site, address } = siteFor(ctx)
  return { caseType: type, placeId: site?.id, customerId: ctx.order.customer_id, country: site?.country ?? str(address?.country) }
}

function toChange(c: z.infer<typeof changeShape>): Change {
  return { kind: c.kind, detail: c.detail, ...(c.amount_eur !== null && c.amount_eur !== undefined ? { amountEur: c.amount_eur } : {}) }
}

/** A message draft for the case page ("Read the draft, in German"). Not in the shared contract yet: an optional field on Option. */
export interface Draft {
  to: string
  language: string
  text: string
  translation?: string
}
export type AgentOption = Option & { draft?: Draft; whyChoices?: string[] }

function toOptions(list: z.infer<typeof optionShape>[], ctx: RunContext): AgentOption[] {
  const seen = new Set<string>()
  const cust = customer(ctx.order.customer_id)
  return list.map((o) => {
    let id: string = o.key
    for (let n = 2; seen.has(id); n++) id = `${o.key}_${n}`
    seen.add(id)
    const msg = o.changes.find((c) => c.kind === "customer_message")
    const draft: Draft | undefined = o.draft
      ? { to: o.draft.to, language: o.draft.language, text: o.draft.text, ...(o.draft.translation && o.draft.language !== "en" ? { translation: o.draft.translation } : {}) }
      : msg
        ? { to: `${String(cust?.name ?? "The customer")}, by email`, language: "en", text: msg.detail }
        : undefined
    return { id, label: o.label, effect: o.effect, changes: o.changes.map(toChange), ...(draft ? { draft } : {}), ...(o.why_choices?.length ? { whyChoices: o.why_choices.slice(0, 3) } : {}) }
  })
}

/** One agent case per order (a new run replaces the agent's earlier view; the engine's derived case steps aside). */
const agentCaseId = (ctx: RunContext) => `case-${ctx.order.id}-agent`

const VAGUE_LABELS = /^(approve|ok|okay|yes|accept|confirm|proceed|continue)\.?$/i

// ---------- read tools ----------

function getOrder(ctx: RunContext): ToolResult {
  const o = ctx.order
  const r = ctx.registry
  const cust = customer(o.customer_id)
  const v = vehicleFor(o)
  const facts: Fact[] = []
  const tzOf = (e: Row) => String(byId("sites", str(e.site_id))?.timezone ?? byId("addresses", str(e.address_id))?.timezone ?? "Europe/Helsinki")

  for (const e of forOrder("order_endpoint_details", o.id)) {
    const which = e.boundary === "PICKUP" ? "Pickup" : "Delivery"
    const kind = sourceKindFrom(str(e.stated_by))
    const at = String(e.stated_at ?? e.last_confirmed_at ?? o.created_at)
    if (str(e.access_instruction)) {
      facts.push(r.add(`${which} instruction on the order: "${e.access_instruction}" (access ${String(e.access_status).toLowerCase().replace(/_/g, " ")}).`, { kind, name: str(e.stated_by)?.toLowerCase().replace(/_/g, " "), channel: "record", recordRef: `order_endpoint_details:${e.id}`, at }, endpointStrength(e)))
    }
    if (str(e.contact_name) || str(e.contact_role)) {
      facts.push(r.add(`${which} contact on the order: ${e.contact_name ?? "no name"}${e.contact_role ? `, ${e.contact_role}` : ""} (contact ${String(e.contact_status).toLowerCase()}).`, { kind, channel: "record", recordRef: `order_endpoint_details:${e.id}`, at }, e.contact_status === "CONFIRMED" ? endpointStrength(e) : "stated"))
    }
    void tzOf
  }
  for (const n of forOrder("order_notes", o.id)) {
    const who = n.author_type === "customer" ? String(cust?.name ?? "Customer") : deskTitle(str(n.author_id))
    facts.push(r.add(`${who} wrote in the order notes: "${n.body}"`, { kind: sourceKindFrom(str(n.author_type)), name: who, channel: "record", recordRef: `order_notes:${n.id}`, at: String(n.authored_at) }, "stated"))
  }
  for (const a of forOrder("alerts", o.id).filter((x) => x.status === "OPEN")) {
    facts.push(r.add(`Open alert (${String(a.signal).toLowerCase().replace(/_/g, " ")}): ${a.summary} An alert is a reason to look, not a diagnosis.`, { kind: "record", name: "Bahn alert", channel: "record", recordRef: `alerts:${a.id}`, at: String(a.triggered_at) }, "inferred"))
  }
  for (const w of forOrder("work_items", o.id).filter((x) => x.status === "OPEN")) {
    const due = str(w.due_at)
    facts.push(r.add(`Open work item for ${deskTitle(str(w.owner))}${due ? `, due ${fmtLocal(due, "Europe/Helsinki")} Helsinki time` : ""}: ${w.summary} Next action: ${w.next_action}`, { kind: "person", name: deskTitle(str(w.owner)), channel: "record", recordRef: `work_items:${w.id}`, at: String(w.opened_at) }, "stated"))
  }
  const offers = forOrder("market_offers", o.id)
  for (const off of offers.filter((x) => x.status === "PUBLISHED")) {
    facts.push(r.add(`The gig is published to drivers at EUR ${Math.round(Number(off.fee_cents) / 100)} since ${fmtLocal(String(off.published_at), "Europe/Helsinki")}; no driver has taken it.`, { kind: "record", channel: "record", recordRef: `market_offers:${off.id}`, at: String(off.published_at) }, "confirmed"))
  }
  const asg = activeAssignment(o.id)
  if (asg) {
    const d = driver(str(asg.driver_id))
    facts.push(r.add(`Driver ${d?.display_name ?? asg.driver_id} is booked on this gig (status ${String(asg.status).toLowerCase()}, fee EUR ${Math.round(Number(asg.fee_cents) / 100)}).`, { kind: "record", channel: "record", recordRef: `work_assignments:${asg.id}`, at: String(asg.accepted_at ?? o.created_at) }, "confirmed"))
  } else if (!offers.some((x) => x.status === "PUBLISHED")) {
    facts.push(r.add("No driver is booked and the gig is not published to drivers.", { kind: "record", channel: "record", recordRef: `orders:${o.id}`, at: String(o.updated_at ?? o.created_at) }, "confirmed"))
  }
  for (const sv of forOrder("site_visits", o.id)) {
    facts.push(r.add(`Driver visit at the pickup place at ${fmtLocal(String(sv.arrived_at), "Europe/Helsinki")}: ${String(sv.outcome).toLowerCase().replace(/_/g, " ")}.`, { kind: "driver_app", channel: "app", recordRef: `site_visits:${sv.id}`, at: String(sv.arrived_at) }, "stated"))
  }
  step(ctx, "read", "Read the order.", { factIds: facts.map((f) => f.id) })
  return ok({
    order: o.reference,
    status: o.status,
    lane: o.display_lane,
    readiness: o.readiness_status,
    route: o.route_kind,
    customer: { name: cust?.name, tier: cust?.account_tier, country: cust?.country, language: placeLanguage(str(cust?.country)), note: "The customer pays. Never contact them yourself; a person sends what you draft." },
    car: vehicleLabel(v),
    now: ctx.clock.now(),
    facts: facts.map(factOut),
  })
}

function getPickupPlace(ctx: RunContext): ToolResult {
  const { site, address } = siteFor(ctx)
  const r = ctx.registry
  const facts: Fact[] = []
  const at = String(ctx.order.created_at)
  const country = site?.country ?? str(address?.country)
  if (site?.requires_signed_release) facts.push(r.add(`${site.name} needs a signed release document before a car leaves.`, { kind: "record", name: "Pickup place profile", channel: "record", recordRef: `sites:${site.id}`, at }, "confirmed"))
  if (site?.release_document_rule) facts.push(r.add(`${site.name} rule at handover: ${site.release_document_rule}.`, { kind: "record", name: "Pickup place profile", channel: "record", recordRef: `sites:${site.id}`, at }, "confirmed"))
  const access = site?.pickup_access_note ?? str(address?.access_note)
  if (access) facts.push(r.add(`Pickup place access note: "${access}"`, { kind: "record", name: "Pickup place profile", channel: "record", recordRef: site ? `sites:${site.id}` : `addresses:${address?.id}`, at }, "inferred"))

  const lessons = acceptedLessons(ctx.snap.lessons, { placeId: site?.id, customerId: ctx.order.customer_id, country })
  const lessonOut = lessons.map((l) => {
    const o = lessonOrigin(ctx.snap.decisions, l)
    const f = r.add(lessonStatement(ctx.snap.decisions, l), { kind: "person", name: `${o.who}, accepted lesson`, channel: "record", recordRef: `lessons:${l.id}`, at: o.at }, "confirmed")
    facts.push(f)
    return { lesson_id: l.id, case_type: l.scope.caseType, text: l.text, fact_id: f.id }
  })
  const earlier = ctx.snap.cases.filter((c) => c.placeId && c.placeId === site?.id && c.orderId !== ctx.order.id)
  const contact = contactCheck(ctx.order, site)
  step(ctx, "lookup", `Looked up the pickup place${lessons.length ? ` and ${lessons.length === 1 ? "1 accepted lesson" : `${lessons.length} accepted lessons`}` : ""}.`, { factIds: facts.map((f) => f.id) })
  return ok({
    name: site?.name ?? address?.name,
    kind: site?.kind ?? address?.kind,
    city: site?.city ?? address?.city,
    country,
    language: placeLanguage(country),
    language_name: LANGUAGE_NAMES[placeLanguage(country)],
    timezone: site?.timezone ?? address?.timezone,
    opening_hours: site?.opening_hours ?? address?.opening_hours,
    handover_mode: site?.handover_mode,
    advance_notice_minutes: site?.advance_notice_minutes,
    may_contact: contact.allowed ? "yes: pickup places may be asked without a yes" : contact.reason,
    accepted_lessons: lessonOut,
    earlier_cases_here: earlier.length,
    facts: facts.map(factOut),
  })
}

async function getConversations(ctx: RunContext): Promise<ToolResult> {
  const r = ctx.registry
  const convs = conversationsFor(ctx.order.id)
  const facts: Fact[] = []
  const toTranslate: { idx: number; text: string }[] = []
  const rows: { conv: Row; msgs: Row[] }[] = convs.map((c) => ({ conv: c, msgs: messagesFor(c.id) }))
  const flat = rows.flatMap((x) => x.msgs)
  flat.forEach((m, idx) => {
    if (m.language && m.language !== "en") toTranslate.push({ idx, text: String(m.body) })
  })
  const translations = new Map<number, string>()
  if (toTranslate.length && (ctx.provider === "api" || ctx.provider === "claude-code")) {
    try {
      const t = await structured<{ items: { idx: number; english: string }[] }>(
        {
          provider: ctx.provider,
          model: ctx.callModel,
          system: "Translate short business messages about car pickups into plain English. Keep names and references.",
          prompt: json(toTranslate),
          schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, english: { type: "string" } }, required: ["idx", "english"], additionalProperties: false } } }, required: ["items"], additionalProperties: false },
        },
        ctx.usage,
      )
      for (const it of t.items) translations.set(it.idx, it.english)
    } catch {
      // keep originals
    }
  }
  let i = 0
  const out = rows.map(({ conv, msgs }) => ({
    conversation: conv.id,
    category: conv.category,
    channel: conv.channel,
    status: conv.status,
    waiting_on: conv.waiting_on ?? null,
    next_check_at: conv.next_check_at ?? null,
    messages: msgs.map((m) => {
      const idx = i++
      const who = authorName(m, ctx.order)
      const en = translations.get(idx)
      const internal = m.visibility === "INTERNAL"
      const body = String(m.body)
      const statement = `${who}${internal ? " (internal note)" : ""}: "${body}"${en ? ` Translated: "${en}"` : ""}`
      const f = r.add(statement, { kind: sourceKindFrom(str(m.author_type)), name: who, channel: channelFrom(str(m.channel)), recordRef: `messages:${m.id}`, at: String(m.authored_at) }, "stated")
      facts.push(f)
      return { fact_id: f.id, at: m.authored_at, from: who, from_kind: f.source.kind, to: m.recipient_type, channel: m.channel, language: m.language, text: body, ...(en ? { translated: en } : {}) }
    }),
  }))
  step(ctx, "read", `Read ${convs.length === 1 ? "1 conversation" : `${convs.length} conversations`} (${flat.length} messages).`, { factIds: facts.map((f) => f.id) })
  return ok({ conversations: out, note: "A driver message is not a fresh location. A quote is not a booking." })
}

function getDocuments(ctx: RunContext): ToolResult {
  const r = ctx.registry
  const { site } = siteFor(ctx)
  const docs = forOrder("documents", ctx.order.id)
  const facts: Fact[] = docs.map((d) =>
    r.add(
      `${d.kind === "RELEASE_AUTHORITY" ? "Release document" : String(d.kind)} on the order: ${String(d.status).toLowerCase()}${d.required ? ", required" : ""}${d.signature_scope && d.signature_scope !== "NONE" ? `, signed for ${String(d.signature_scope).toLowerCase().replace(/_/g, " ")}` : ""}${Number(d.file_count) ? `, ${d.file_count} file(s)` : ", no file"}.`,
      { kind: "record", channel: "record", recordRef: `documents:${d.id}`, at: String(d.updated_at) },
      "confirmed",
    ),
  )
  if (site?.requires_signed_release && !docs.some((d) => d.kind === "RELEASE_AUTHORITY")) {
    facts.push(r.add(`No release document is on the order, and ${site.name} needs a signed one before the car leaves.`, { kind: "agent", name: "Readiness agent", channel: "record", recordRef: `documents:order=${ctx.order.id}`, at: ctx.clock.now() }, "inferred"))
  }
  step(ctx, "read", "Checked the documents.", { factIds: facts.map((f) => f.id) })
  return ok({ documents: docs.map((d) => ({ kind: d.kind, status: d.status, required: d.required, signature_scope: d.signature_scope, files: d.file_count })), facts: facts.map(factOut) })
}

function getTimeWindows(ctx: RunContext): ToolResult {
  const r = ctx.registry
  const now = ctx.clock.now()
  const wins = forOrder("time_windows", ctx.order.id)
  const facts: Fact[] = []
  const out = wins.map((w) => {
    const tz = String(w.timezone ?? "Europe/Helsinki")
    const purpose = String(w.purpose).toLowerCase().replace(/_/g, " ")
    const local = fmtRange(String(w.start_at), String(w.end_at), tz)
    const setBy = w.source === "CUSTOMER" ? "the customer" : w.source === "OPS" ? "Bahn ops" : String(w.source).toLowerCase()
    if (w.is_selected || w.purpose === "SELECTED_PICKUP_SLOT") {
      const label = w.is_selected ? `${purpose.charAt(0).toUpperCase()}${purpose.slice(1)}` : `Planned ${purpose.replace(/^selected /, "")} (not confirmed yet)`
      facts.push(r.add(`${label}: ${local} (${tz.split("/")[1]?.replace("_", " ")} time), set by ${setBy}.`, { kind: sourceKindFrom(String(w.source)), channel: "record", recordRef: `time_windows:${w.id}`, at: String(w.stated_at ?? ctx.order.created_at) }, w.is_selected ? "confirmed" : "stated"))
    }
    if (str(w.commitment_deadline_at)) {
      facts.push(r.add(`Commitment deadline agreed with the customer: ${fmtLocal(String(w.commitment_deadline_at), tz)}.`, { kind: "customer", channel: "record", recordRef: `time_windows:${w.id}`, at: String(w.stated_at ?? ctx.order.created_at) }, "confirmed"))
    }
    return { purpose: w.purpose, local, timezone: tz, start_at: w.start_at, end_at: w.end_at, selected: w.is_selected, set_by: setBy, hours_from_now: hoursBetween(now, String(w.start_at)) }
  })
  step(ctx, "read", "Checked the time windows.", { factIds: facts.map((f) => f.id) })
  return ok({ now, windows: out, facts: facts.map(factOut) })
}

function listTrustRules(ctx: RunContext): ToolResult {
  const rules = ctx.snap.trustRules.filter((t) => t.caseType.startsWith("readiness") && t.status !== "off")
  step(ctx, "lookup", rules.some((t) => t.status === "on") ? "Checked the trust rules." : "Checked the trust rules: none is on.")
  return ok({
    rules: rules.map((t) => ({ trust_rule_id: t.id, status: t.status, case_type: t.caseType, scope: { ...t.scope, ...(t.scope.placeId ? { pickup_place: byId("sites", t.scope.placeId)?.name ?? t.scope.placeId } : {}) }, this_order_matches_scope: !t.scope.placeId || t.scope.placeId === ctx.order.pickup_site_id, option_key: t.optionId ?? null, when: t.when, then: t.then, evidence: `${t.evidence.matched} of ${t.evidence.total}` })),
    note: "Only a rule with status 'on' lets you change something without a person. 'suggested' rules do not.",
  })
}

// ---------- asking ----------

async function msgDriver(ctx: RunContext, text: string): Promise<ToolResult> {
  const commits = messageCommits(text)
  if (commits) return fail(`Needs a person: ${commits}. Ask questions only; bring the change to a person with propose_case.`)
  const res = await messageDriver(ctx.order, text, { provider: ctx.provider, model: ctx.callModel, clock: ctx.clock, registry: ctx.registry, usage: ctx.usage })
  step(ctx, "ask", res.delivered ? `Asked the driver. ${res.reply ? `Reply: "${res.reply}"` : ""}`.trim() : "Wanted to ask the driver, but no driver is booked.", { factIds: res.facts.map((f) => f.id) })
  return ok({ delivered: res.delivered, reply: res.reply ?? null, note: res.note, facts: res.facts.map(factOut) })
}

async function msgPlace(ctx: RunContext, text: string): Promise<ToolResult> {
  const commits = messageCommits(text)
  if (commits) return fail(`Needs a person: ${commits}. Ask questions only; bring the change to a person with propose_case.`)
  const { site } = siteFor(ctx)
  const gate = contactCheck(ctx.order, site)
  if (!gate.allowed) return fail(gate.reason)
  const res = await messagePickupPlace(ctx.order, text, { provider: ctx.provider, model: ctx.callModel, clock: ctx.clock, registry: ctx.registry, usage: ctx.usage })
  step(ctx, "message", res.reply ? `Wrote to the pickup place. They replied: "${res.translation ?? res.reply}"` : "Wrote to the pickup place. No reply yet.", { factIds: res.facts.map((f) => f.id) })
  return ok({ reply: res.reply ?? null, translation: res.translation ?? null, note: res.note, facts: res.facts.map(factOut) })
}

async function callPlace(ctx: RunContext, goal: string, language: string): Promise<ToolResult> {
  const { site } = siteFor(ctx)
  const gate = contactCheck(ctx.order, site)
  if (!gate.allowed) return fail(gate.reason)
  const lessons = acceptedLessons(ctx.snap.lessons, { placeId: site?.id, customerId: ctx.order.customer_id, country: site?.country })
  const res = await simulateCall({
    order: ctx.order,
    goal,
    language: language || undefined,
    provider: ctx.provider,
    model: ctx.callModel,
    clock: ctx.clock,
    registry: ctx.registry,
    usage: ctx.usage,
    lessons,
    kind: ctx.callbackFor ? "callback" : "first",
    caseId: ctx.callbackFor?.caseId,
    decision: ctx.callbackFor?.decisionText,
  })
  ctx.calls.push(res.call)
  await ctx.store.saveCall(res.call)
  ctx.trace.write({ type: "call", call: res.call })
  const langName = LANGUAGE_NAMES[res.call.language] ?? res.call.language
  step(ctx, "call", res.call.outcome === "answered" ? `Called ${res.persona.placeName} in ${langName}. ${res.summary}` : `Called ${res.persona.placeName}. Nobody answered.`, { factIds: res.facts.map((f) => f.id), callId: res.call.id })
  return ok({
    call_id: res.call.id,
    outcome: res.call.outcome,
    language: res.call.language,
    transcript: res.call.turns.map((t) => ({ speaker: t.speaker, text: t.text, ...(t.translation ? { translation: t.translation } : {}), at: t.at })),
    summary: res.summary,
    needs_decision: res.needsDecision,
    facts: res.facts.map(factOut),
  })
}

async function scheduleCallback(ctx: RunContext, dueAt: string, reason: string): Promise<ToolResult> {
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return fail("due_at must be an ISO time, e.g. 2026-10-21T10:00:00Z")
  if (due.getTime() < ctx.clock.date().getTime()) return fail(`due_at is in the past (now is ${ctx.clock.now()}).`)
  const { site } = siteFor(ctx)
  const cb: Callback = { id: shortId("cb"), orderId: ctx.order.id, placeId: site?.id, dueAt: due.toISOString(), reason, status: "scheduled", createdAt: ctx.clock.now(), createdByRunId: ctx.runId }
  await ctx.store.saveCallback(cb)
  ctx.trace.write({ type: "callback", callback: cb })
  step(ctx, "wait", `Will follow up at ${fmtLocal(cb.dueAt, site?.timezone ?? "Europe/Helsinki")} local time: ${reason}`)
  if (!ctx.outcome) ctx.outcome = { kind: "waiting", summary: reason }
  return ok({ callback_id: cb.id, due_at: cb.dueAt })
}

// ---------- deciding ----------

async function proposeCase(ctx: RunContext, a: z.infer<z.ZodObject<typeof TOOL_SHAPES.propose_case>>): Promise<ToolResult> {
  if (ctx.outcome?.kind === "case_for_person" || ctx.outcome?.kind === "resolved") return fail("This run already ended with a case or a resolution. One decision per order.")
  const unknown = [...a.fact_ids, ...a.new_facts.flatMap((n) => n.basis_fact_ids)].filter((id) => !ctx.registry.has(id))
  if (unknown.length) return fail(`Unknown fact ids: ${unknown.join(", ")}. Use only ids that a tool returned.`)
  if (a.fact_ids.length === 0) return fail("A case needs at least one registered fact.")
  for (const o of [a.suggestion, ...a.alternatives]) {
    if (VAGUE_LABELS.test(o.label.trim())) return fail(`Option label "${o.label}" does not name the action. Say what happens, e.g. "Ask the customer to move delivery to Tuesday".`)
  }
  const lessonIds = a.lesson_ids_used.filter(Boolean)
  const knownLessons = ctx.snap.lessons.filter((l) => l.status === "accepted")
  const badLesson = lessonIds.filter((id) => !knownLessons.some((l) => l.id === id))
  if (badLesson.length) return fail(`Unknown or not accepted lesson ids: ${badLesson.join(", ")}.`)
  const caseId = agentCaseId(ctx)
  const inferred = a.new_facts.map((n) => ctx.registry.add(n.statement, { kind: "agent", name: "Readiness agent", channel: "record", recordRef: `inferred_from:${n.basis_fact_ids.join(",")}`, at: ctx.clock.now() }, "inferred"))
  const facts = [...a.fact_ids.map((id) => ctx.registry.get(id)!), ...inferred]
  // The call keeps all its facts (Call.factIds). If the model cited none of them, bring the call's facts along.
  const callFactIds = ctx.calls.flatMap((c) => c.factIds)
  if (callFactIds.length && !a.fact_ids.some((id) => callFactIds.includes(id))) {
    for (const id of callFactIds) if (!facts.some((f) => f.id === id)) facts.push(ctx.registry.get(id)!)
  }
  const used = knownLessons.filter((l) => lessonIds.includes(l.id))
  ctx.lessonsUsed = used
  for (const l of used) {
    const statement = lessonStatement(ctx.snap.decisions, l)
    if (!facts.some((f) => f.statement === statement)) {
      const o = lessonOrigin(ctx.snap.decisions, l)
      facts.push(ctx.registry.add(statement, { kind: "person", name: `${o.who}, accepted lesson`, channel: "record", recordRef: `lessons:${l.id}`, at: o.at }, "confirmed"))
    }
  }
  const { site } = siteFor(ctx)
  const decideBy = a.decide_by && !Number.isNaN(new Date(a.decide_by).getTime()) ? new Date(a.decide_by).toISOString() : undefined
  step(ctx, "propose", "Brought a person one decision.")
  for (const c of ctx.calls) c.caseId = c.caseId ?? caseId
  const theCase: Case = {
    id: caseId,
    orderId: ctx.order.id,
    desk: "ops-readiness",
    type: a.type,
    headline: a.headline,
    ...(decideBy ? { decideBy } : {}),
    reasons: a.reasons as CaseReason[],
    facts,
    agentSteps: [...ctx.steps],
    suggestion: toOptions([a.suggestion, ...a.alternatives], ctx)[0],
    alternatives: toOptions([a.suggestion, ...a.alternatives], ctx).slice(1),
    status: "waiting_for_person",
    placeId: site?.id,
    customerId: ctx.order.customer_id,
    ...(used.length ? { lessonIdsUsed: used.map((l) => l.id) } : {}),
    createdAt: ctx.clock.now(),
  }
  await ctx.store.saveCase(theCase)
  for (const c of ctx.calls) await ctx.store.saveCall(c)
  ctx.trace.write({ type: "case", case: theCase })
  for (const l of used) ctx.trace.write({ type: "lesson", lesson: l })
  const check: OrderCheck = { orderId: ctx.order.id, state: "needs_person", checkedAt: ctx.clock.now(), checks: [], caseId }
  await ctx.store.saveOrderCheck(check)
  ctx.outcome = { kind: "case_for_person", caseId, summary: a.headline }
  return ok({ case_id: caseId, status: theCase.status, note: "The case waits in the right person's queue. Write a two-sentence handover and stop." }, true)
}

async function resolve(ctx: RunContext, a: z.infer<z.ZodObject<typeof TOOL_SHAPES.resolve_without_person>>): Promise<ToolResult> {
  if (ctx.outcome?.kind === "case_for_person" || ctx.outcome?.kind === "resolved") return fail("This run already ended with a case or a resolution.")
  const unknown = a.checks.flatMap((c) => c.fact_ids).filter((id) => !ctx.registry.has(id))
  if (unknown.length) return fail(`Unknown fact ids: ${unknown.join(", ")}. Use only ids that a tool returned.`)
  if (a.checks.some((c) => !c.ok)) return fail("Needs a person: a check is not ok, so this order is not fine. Bring a person the decision with propose_case.")
  const changes = a.changes.map(toChange)
  if (ctx.callbackFor) return carryOut(ctx, a, changes)
  const gate = checkChanges(changes, caseContext(ctx, a.type), ctx.snap.trustRules, a.trust_rule_id || undefined, a.option_key === "other" ? undefined : a.option_key)
  if (!gate.allowed) return fail(gate.reason)
  const now = ctx.clock.now()
  const checks = a.checks.map((c) => ({ label: c.label, ok: c.ok, source: c.fact_ids.map((id) => ctx.registry.get(id)?.source.name ?? ctx.registry.get(id)?.source.kind).filter(Boolean).join(", ") || "agent", at: now }))
  const realChanges = changes.filter((c) => c.kind !== "none")
  let caseId: string | undefined
  if (gate.rule) {
    const { site } = siteFor(ctx)
    caseId = agentCaseId(ctx)
    const ruleFact = ctx.registry.add(`Handled by the agent under trust rule ${gate.rule.id} (${gate.rule.changedBy ? `turned on by ${personName(gate.rule.changedBy)}` : "on"}): "${gate.rule.when}" -> "${gate.rule.then}". Evidence: the agent would have decided like people did in ${gate.rule.evidence.matched} of ${gate.rule.evidence.total} cases.`, { kind: "agent", name: "Readiness agent", channel: "record", recordRef: `trust_rules:${gate.rule.id}`, at: now }, "confirmed")
    const factIds = [...new Set([...a.checks.flatMap((c) => c.fact_ids), ...ctx.calls.flatMap((c) => c.factIds)])]
    const facts = [...factIds.map((id) => ctx.registry.get(id)!).filter(Boolean), ruleFact]
    const label = realChanges.map((c) => c.detail).join("; ") || gate.rule.then
    step(ctx, "message", `Confirmed with the pickup place under trust rule ${gate.rule.id}: ${label}.`)
    for (const c of ctx.calls) c.caseId = c.caseId ?? caseId
    const theCase: Case = {
      id: caseId,
      orderId: ctx.order.id,
      desk: "ops-readiness",
      type: a.type,
      headline: a.summary,
      reasons: realChanges.some((c) => c.kind === "cost") ? ["costs_extra_money"] : [],
      facts,
      agentSteps: [...ctx.steps],
      suggestion: { id: a.option_key, label: gate.rule.then, effect: `Handled by the agent under trust rule ${gate.rule.id}. ${a.summary}`, changes },
      alternatives: [],
      status: "handled_by_agent",
      placeId: site?.id,
      customerId: ctx.order.customer_id,
      createdAt: now,
    }
    await ctx.store.saveCase(theCase)
    for (const c of ctx.calls) await ctx.store.saveCall(c)
    ctx.trace.write({ type: "case", case: theCase })
    ctx.trace.write({ type: "trust_rule", rule: gate.rule })
  } else {
    step(ctx, "read", `Checked and found nothing that needs a person: ${a.summary}`)
  }
  const check: OrderCheck = { orderId: ctx.order.id, state: "checked_quiet", checkedAt: now, checks, ...(caseId ? { caseId } : {}) }
  await ctx.store.saveOrderCheck(check)
  ctx.trace.write({ type: "order_check", check })
  ctx.outcome = { kind: "resolved", caseId, summary: a.summary }
  return ok({ resolved: true, ...(caseId ? { case_id: caseId, handled_under_rule: gate.rule?.id } : {}), note: gate.note }, true)
}

/** After a person's yes: the decided changes go through, the case is done. */
async function carryOut(ctx: RunContext, a: z.infer<z.ZodObject<typeof TOOL_SHAPES.resolve_without_person>>, changes: Change[]): Promise<ToolResult> {
  const brief = ctx.callbackFor!
  const approved = new Set(brief.changes.map((c) => c.kind))
  const extra = changes.filter((c) => c.kind !== "none" && !approved.has(c.kind))
  if (extra.length) return fail(`Needs a person: the person approved ${[...approved].join(", ") || "no change"}, not ${extra.map((c) => c.kind).join(", ")}. Bring the new change to a person with propose_case.`)
  const existing = ctx.snap.cases.find((c) => c.id === brief.caseId)
  const now = ctx.clock.now()
  // The why stays with the decision (case record, History); the step names what was carried out.
  step(ctx, "message", `Carried out the decision: ${brief.decisionText.replace(/\. Why: [\s\S]*$/, ".")}`)
  if (existing) {
    const callFacts = ctx.calls.flatMap((c) => c.factIds).map((id) => ctx.registry.get(id)).filter((f): f is Fact => Boolean(f))
    const updated: Case = {
      ...existing,
      status: "done",
      facts: [...existing.facts, ...callFacts.filter((f) => !existing.facts.some((e) => e.id === f.id))],
      agentSteps: [...existing.agentSteps, ...ctx.steps],
    }
    for (const c of ctx.calls) c.caseId = existing.id
    await ctx.store.saveCase(updated)
    for (const c of ctx.calls) await ctx.store.saveCall(c)
    ctx.trace.write({ type: "case", case: updated })
  }
  ctx.outcome = { kind: "resolved", caseId: brief.caseId, summary: a.summary }
  return ok({ resolved: true, case_id: brief.caseId, status: "done", note: "The person's yes covered these changes." }, true)
}

// ---------- dispatcher ----------

export async function executeTool(ctx: RunContext, name: string, rawInput: unknown): Promise<ToolResult> {
  const t0 = ctx.clock.now()
  const shape = (TOOL_SHAPES as Record<string, z.ZodRawShape>)[name]
  ctx.trace.step("tool_call", JSON.stringify(rawInput ?? {}), t0, name)
  let result: ToolResult
  if (!shape) {
    result = fail(`Unknown tool ${name}. Tools: ${TOOL_NAMES.join(", ")}.`)
  } else {
    const parsed = z.object(shape).safeParse(rawInput ?? {})
    if (!parsed.success) {
      result = fail(`Invalid input for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`)
    } else {
      const a = parsed.data as Record<string, unknown>
      if (typeof a.order === "string" && !sameOrder(ctx, a.order)) {
        result = fail(`This run is about ${ctx.order.reference}. Work on one order per run.`)
      } else {
        try {
          result = await dispatch(ctx, name as ToolName, a)
        } catch (e) {
          result = fail(`Tool failed: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  }
  // Reading and asking take time in the real world; keep the clock honest.
  if (!["call_pickup_place", "message_pickup_place", "message_driver"].includes(name)) ctx.clock.advance(4)
  ctx.trace.step("tool_result", result.content, ctx.clock.now(), name)
  return result
}

async function dispatch(ctx: RunContext, name: ToolName, a: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_order":
      return getOrder(ctx)
    case "get_pickup_place":
      return getPickupPlace(ctx)
    case "get_conversations":
      return getConversations(ctx)
    case "get_documents":
      return getDocuments(ctx)
    case "get_time_windows":
      return getTimeWindows(ctx)
    case "list_trust_rules":
      return listTrustRules(ctx)
    case "message_driver":
      return msgDriver(ctx, String(a.text))
    case "message_pickup_place":
      return msgPlace(ctx, String(a.text))
    case "call_pickup_place":
      return callPlace(ctx, String(a.goal), String(a.language ?? ""))
    case "schedule_callback":
      return scheduleCallback(ctx, String(a.due_at), String(a.reason))
    case "propose_case":
      return proposeCase(ctx, a as z.infer<z.ZodObject<typeof TOOL_SHAPES.propose_case>>)
    case "resolve_without_person":
      return resolve(ctx, a as z.infer<z.ZodObject<typeof TOOL_SHAPES.resolve_without_person>>)
  }
}

/** JSON Schema for the Anthropic API tool list (strict, no extra properties). */
export function apiToolDefinitions(): { name: string; description: string; input_schema: Record<string, unknown>; strict: boolean }[] {
  return TOOL_NAMES.map((name) => {
    const schema = z.toJSONSchema(z.object(TOOL_SHAPES[name] as z.ZodRawShape)) as Record<string, unknown>
    delete schema.$schema
    // Strict mode compiles a grammar per tool; the two big decision tools exceed the API's grammar size,
    // so they run unstrict and executeTool() validates every input with zod instead.
    const big = name === "propose_case" || name === "resolve_without_person"
    return { name, description: TOOL_DESCRIPTIONS[name], input_schema: closeObjects(schema), strict: !big }
  })
}

function closeObjects(s: Record<string, unknown>): Record<string, unknown> {
  if (s.type === "object") {
    s.additionalProperties = false
    const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>
    s.properties = props
    s.required = Object.keys(props)
    for (const k of Object.keys(props)) props[k] = closeObjects(props[k])
  }
  if (s.type === "array" && s.items && typeof s.items === "object") s.items = closeObjects(s.items as Record<string, unknown>)
  if (Array.isArray(s.anyOf)) s.anyOf = (s.anyOf as Record<string, unknown>[]).map(closeObjects)
  return s
}

export type { Option, Change }
