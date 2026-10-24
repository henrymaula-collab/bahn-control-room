// The baseline depth (lib/depth) inside the chat tools' answers: each read
// tool returns the dataset's own records as before, plus what the baseline
// adds for that question (the thread, the call and the note, the documents,
// the pickup place's people and hours, the earlier pickups there). Everything
// in full: no slicing, so an answer can name, quote and translate.

import type { CaseDepth } from "@/lib/depth/types"
import type { ChatCaseContext } from "./context"
import { day, dayTime } from "./words"

const when = (iso: string) => `${dayTime(iso)} Helsinki time`

const notesOut = (d: CaseDepth) => d.notes.map((n) => ({ when: when(n.at), by: n.by, text: n.text }))

const contactOut = (c: CaseDepth["place"]["contacts"][number]) => ({ name: c.name, role: c.role, phone: c.phone, email: c.email, speaks: c.language })

export function depthCalls(d: CaseDepth) {
  return d.calls.map((c) => ({
    started: when(c.startedAt),
    by: c.by,
    with: c.with,
    language: c.language,
    outcome: c.outcome.replace(/_/g, " "),
    minutes: c.minutes,
    turns: c.turns.map((t) => ({ speaker: t.speaker === "bahn" ? "Bahn, Readiness desk" : d.place.name, text: t.text, ...(t.english ? { english: t.english } : {}) })),
  }))
}

/** Adds the baseline to one tool's JSON answer. Unknown shapes and errors pass through untouched. */
export function withDepth(name: string, content: string, ctx: ChatCaseContext): string {
  const d = ctx.depth
  if (!d) return content
  let out: Record<string, unknown>
  try {
    out = JSON.parse(content) as Record<string, unknown>
  } catch {
    return content
  }
  if (!out || typeof out !== "object" || "error" in out) return content
  switch (name) {
    case "get_order":
      out.car_details = { colour: d.car.colour, mileage_km: d.car.mileageKm, keys: d.car.keys, condition: d.car.condition }
      out.customer_contact = { company: ctx.order.customer, ...contactOut(d.customerContact) }
      out.internal_notes = notesOut(d)
      break
    case "get_pickup_place": {
      const hours = out.opening_hours
      if (!hours || (typeof hours === "object" && !Object.keys(hours as object).length)) out.opening_hours = d.place.openingHours
      out.hours_source = d.place.hoursSource
      out.phone = d.place.phone
      out.email = d.place.email
      out.who_answers_the_phone = d.place.answersThePhone
      out.contacts = d.place.contacts.map(contactOut)
      out.handover_routine = d.place.handoverRoutine
      out.good_to_know = d.place.quirks
      break
    }
    case "get_conversations": {
      if (d.messages.length) {
        const list = Array.isArray(out.conversations) ? (out.conversations as unknown[]) : []
        list.push({
          conversation: `email thread on ${d.reference}`,
          category: "pickup_readiness",
          channel: "email",
          status: "OPEN",
          messages: d.messages.map((m) => ({ when: when(m.at), from: m.from, to: m.to, channel: m.channel, language: m.language, text: m.text, ...(m.english ? { english: m.english } : {}) })),
        })
        out.conversations = list
      }
      out.note = `${typeof out.note === "string" ? `${out.note} ` : ""}Quote what people wrote, and give the English when it is in another language.`
      break
    }
    case "get_documents":
      out.other_documents = d.documents.map((x) => ({ document: x.name, status: x.status, detail: x.detail }))
      break
    case "get_calls":
      out.desk_calls = depthCalls(d)
      out.internal_notes = notesOut(d)
      break
    case "get_place_history":
      out.earlier_pickups_here = d.earlierPickups.map((p) => ({ when: day(p.when), order: p.reference, car: p.car, driver: p.driver, handed_over_by: p.handedOverBy, how_it_went: p.outcome }))
      out.contacts = d.place.contacts.map(contactOut)
      break
  }
  return JSON.stringify(out)
}

/** One line for the case context: what the records hold beyond the summary, so the model looks it up. */
export function depthLine(ctx: ChatCaseContext): string {
  const d = ctx.depth
  if (!d) return ""
  const latest = d.messages[d.messages.length - 1]
  const parts = [
    d.messages.length ? `${d.messages.length} emails in the order's thread (latest from ${latest!.from}, ${when(latest!.at)}): get_conversations` : "",
    d.calls.length ? `${d.calls.length === 1 ? "a call" : `${d.calls.length} calls`} by the Readiness desk and an internal note: get_calls` : "",
    `the documents beyond the release document (registration, service history, handover protocol, keys): get_documents`,
    `the pickup place's contacts with phone numbers, who answers, hours and routine: get_pickup_place`,
    `the car's colour, mileage and condition, and the customer's contact person: get_order`,
    `${d.earlierPickups.length} earlier pickups at ${d.place.name} and how they went: get_place_history`,
  ].filter(Boolean)
  return `# On file beyond this summary\n${parts.map((p) => `- ${p}`).join("\n")}`
}
