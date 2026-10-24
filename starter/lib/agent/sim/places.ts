// The simulated pickup place: who answers the phone and what they know.
// Their knowledge comes from the dataset (hours, access, release rule, what
// the place already told Bahn, missing papers) plus the small scenario file
// for the demo places. The agent never sees this; it has to ask.

import fs from "node:fs"
import { paths } from "../config"
import { byId, forOrder, messagesFor, conversationsFor, placeLanguage, pickupPlace, str, vehicleFor, type OrderRow } from "../data"

export interface TruthItem {
  id: string
  kind?: string // fee | not_ready | ready | release_procedure | papers_missing | hold | location | keys | hours | access
  en: string
  local?: Record<string, string>
  amountEur?: number
  readyAt?: string
  source: "dataset" | "scenario"
}

export interface PlacePersona {
  placeId?: string
  placeName: string
  city: string
  country: string
  language: string
  timeZone: string
  contactName: string
  role: string
  roleLocal?: string
  answers: boolean
  noAnswerNote?: string
  truths: TruthItem[]
}

interface ScenarioTruth { id: string; kind?: string; en: string; amountEur?: number; readyAt?: string; [lang: string]: unknown }
interface ScenarioPlace {
  contact?: { name: string; role: string; roleLocal?: Record<string, string> }
  answers?: boolean
  noAnswerNote?: string
  truths?: ScenarioTruth[]
  vehicles?: Record<string, ScenarioTruth[]>
}

let scenarioCache: Record<string, ScenarioPlace> | undefined

function scenarios(): Record<string, ScenarioPlace> {
  if (scenarioCache) return scenarioCache
  try {
    const raw = JSON.parse(fs.readFileSync(paths.scenarios(), "utf8")) as { places?: Record<string, ScenarioPlace> }
    scenarioCache = raw.places ?? {}
  } catch {
    scenarioCache = {}
  }
  return scenarioCache
}

function fromScenario(t: ScenarioTruth): TruthItem {
  const local: Record<string, string> = {}
  for (const [k, v] of Object.entries(t)) if (k.length === 2 && typeof v === "string" && k !== "en") local[k] = v
  return { id: t.id, kind: t.kind, en: t.en, local, amountEur: t.amountEur, readyAt: t.readyAt, source: "scenario" }
}

function hoursText(hours: Record<string, unknown> | undefined): string | undefined {
  if (!hours || Object.keys(hours).length === 0) return undefined
  const parts: string[] = []
  if (hours.mon_fri) parts.push(`Monday to Friday ${hours.mon_fri}`)
  if (hours.sat) parts.push(`Saturday ${hours.sat}`)
  if (hours.sun) parts.push(`Sunday ${hours.sun}`)
  else if ("sun" in hours) parts.push("closed on Sunday")
  if (hours.by_appointment || hours.appointment_required) parts.push("by appointment")
  return parts.length ? `We are open ${parts.join(", ")}.` : undefined
}

export function personaFor(order: OrderRow): PlacePersona {
  const { site, address } = pickupPlace(order)
  const country = site?.country ?? str(address?.country) ?? "FI"
  const language = placeLanguage(country)
  const sc = site ? scenarios()[site.id] : undefined
  const endpoint = forOrder("order_endpoint_details", order.id).find((e) => e.boundary === "PICKUP")
  const truths: TruthItem[] = []

  const hours = hoursText((site?.opening_hours ?? address?.opening_hours) as Record<string, unknown> | undefined)
  if (hours) truths.push({ id: "hours", kind: "hours", en: hours, source: "dataset" })
  const access = site?.pickup_access_note ?? str(address?.access_note)
  if (access) truths.push({ id: "access", kind: "access", en: access, source: "dataset" })
  if (site?.requires_signed_release) truths.push({ id: "signed_release", kind: "release_procedure", en: "A car only leaves with a signed release document for that car.", source: "dataset" })
  if (site?.release_document_rule) truths.push({ id: "release_rule", kind: "release_procedure", en: `${site.release_document_rule}.`, source: "dataset" })
  if (endpoint && endpoint.stated_by === "SITE_CONTACT" && str(endpoint.access_instruction)) {
    truths.push({ id: "said_before_access", kind: "access", en: String(endpoint.access_instruction), source: "dataset" })
  }
  // What this place already told Bahn about this order stays true on the phone.
  for (const conv of conversationsFor(order.id)) {
    for (const m of messagesFor(conv.id)) {
      if (m.author_type === "site_contact" && (!site || m.author_id === site.id)) {
        truths.push({ id: `said_${m.id}`, en: String(m.body), source: "dataset" })
      }
    }
  }
  const releaseDoc = forOrder("documents", order.id).find((d) => d.kind === "RELEASE_AUTHORITY")
  if (releaseDoc && releaseDoc.status !== "ACCEPTED" && releaseDoc.status !== "SIGNED") {
    truths.push({ id: "release_doc_status", kind: "papers_missing", en: "No signed release document for this car has reached us.", source: "dataset" })
  }

  // Scenario truths for the demo places (by place, and by car make and model).
  for (const t of sc?.truths ?? []) truths.push(fromScenario(t))
  const v = vehicleFor(order)
  const vKey = v ? `${v.make} ${v.model}` : ""
  for (const t of sc?.vehicles?.[vKey] ?? []) truths.push(fromScenario(t))

  const contactName = sc?.contact?.name ?? str(endpoint?.contact_name) ?? "the desk"
  const role = sc?.contact?.role ?? str(endpoint?.contact_role) ?? "site desk"
  return {
    placeId: site?.id,
    placeName: site?.name ?? str(address?.name) ?? "the pickup place",
    city: site?.city ?? str(address?.city) ?? "",
    country,
    language,
    timeZone: site?.timezone ?? str(address?.timezone) ?? "Europe/Helsinki",
    contactName,
    role,
    roleLocal: sc?.contact?.roleLocal?.[language],
    answers: sc?.answers ?? true,
    noAnswerNote: sc?.noAnswerNote,
    truths,
  }
}

export function customerName(order: OrderRow): string {
  return String(byId("customers", order.customer_id)?.name ?? "the customer")
}
