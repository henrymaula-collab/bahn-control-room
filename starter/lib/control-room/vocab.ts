// Words the engine writes into visible strings. design/BAHN-VOCABULARY.md is
// the law: order, pickup place, gig, driver, customer, release document,
// person (never "human"), desk names as in dataset/data/operators.jsonl.

import type { CaseType } from "./types"

export const DESK_TITLES: Record<string, string> = {
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

/** Count phrases for routing sentences: "you have handled 6 {plural}". */
export const CASE_TYPE_WORDS: Record<string, { label: string; one: string; many: string }> = {
  "readiness.car_not_ready": { label: "Car not ready", one: "car that was not ready", many: "cars that were not ready" },
  "readiness.facts_disagree": { label: "Details disagree", one: "pickup where the details disagreed", many: "pickups where the details disagreed" },
  "readiness.no_answer": { label: "Pickup place not answering", one: "pickup place that did not answer", many: "pickup places that did not answer" },
  "readiness.release_document_missing": { label: "Release document missing", one: "missing release document", many: "missing release documents" },
  "readiness.fee_requested": { label: "Fee requested", one: "fee request from a pickup place", many: "fee requests from pickup places" },
  "readiness.keys_or_access": { label: "Keys or access", one: "key or access question", many: "key and access questions" },
}

export function caseTypeWords(type: CaseType) {
  return CASE_TYPE_WORDS[type] ?? { label: type, one: "case like this", many: "cases like this" }
}

export const LANGUAGE_NAMES: Record<string, string> = {
  fi: "Finnish", sv: "Swedish", en: "English", de: "German", da: "Danish", fr: "French",
}

/** The language a pickup place in this country answers the phone in. */
export const COUNTRY_LANGUAGE: Record<string, string> = {
  FI: "fi", DE: "de", AT: "de", DK: "da", SE: "sv", FR: "fr", NL: "en", BE: "fr",
}

export const COUNTRY_NAMES: Record<string, string> = {
  FI: "Finland", DE: "Germany", AT: "Austria", DK: "Denmark", SE: "Sweden", FR: "France", NL: "the Netherlands", BE: "Belgium",
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** "24 Oct" in Helsinki time, the way the portal writes short dates. */
export function shortDay(iso: string, zone = "Europe/Helsinki") {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: zone }).format(new Date(iso))
}

/** "Thu 22 Oct 11:00" in the place's own time. */
export function dayTime(iso: string, zone = "Europe/Helsinki") {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: zone }).format(date).replace(",", "")
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone }).format(date)
  return `${day} ${time}`
}
