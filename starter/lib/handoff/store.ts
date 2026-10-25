// Send to a colleague: the reads and writes. A hand-off moves the case to the colleague's Your tasks
// (its routedTo), and is kept on the case itself (`data.handoffs`), so no schema change is needed:
// History reads it from there (lib/handoff/history.ts), and Undo takes the last one back.

import { type EngineState, buildState } from "@/lib/control-room/service"
import { saveCase } from "@/lib/control-room/store"
import { clock } from "@/lib/control-room/format"
import type { Case } from "@/lib/control-room/types"
import { findPerson, vehicleName } from "@/lib/control-room/v3"
import { type Colleague, colleaguesFor } from "./pick"

export type HandoffEntry = { from: string; to: string; note?: string; at: string; before: Case["routedTo"] }
export type WithHandoffs = Case & { handoffs?: HandoffEntry[] }

export type Handoff = {
  caseId: string
  reference: string
  vehicle: string
  from: { id: string; name: string }
  to: { id: string; name: string }
  note?: string
  at: string
}

const NOTE_MAX = 280

/** The colleagues for a case, the recommended one first. Empty when the case is not this person's to pass on. */
export async function colleagues(caseId: string, personId: string, given?: EngineState): Promise<{ pick: Colleague | null; others: Colleague[] } | null> {
  const state = given ?? (await buildState())
  const c = state.cases.find((x) => x.id === caseId)
  const from = findPerson(state.people, personId)
  if (!c || !from) return null
  const place = c.placeId ? state.world.places.get(c.placeId) : undefined
  const list = colleaguesFor({
    c,
    from,
    people: state.people,
    cases: state.cases,
    decisions: state.decisions,
    place: place ? { name: place.name, country: place.country } : undefined,
    passedOn: ((c as WithHandoffs).handoffs ?? []).map((h) => h.from),
  })
  return { pick: list[0] ?? null, others: list.slice(1) }
}

/** Send a waiting case on. The colleague sees it in Your tasks with "<from> sent it to you at 12:06". */
export async function sendToColleague(input: { caseId: string; from: string; to: string; note?: string }) {
  const state = await buildState()
  const c = state.cases.find((x) => x.id === input.caseId) as WithHandoffs | undefined
  if (!c) return { error: "Case not found", status: 404 as const }
  const from = findPerson(state.people, input.from)
  const to = findPerson(state.people, input.to)
  if (!from || !to) return { error: "Person not found", status: 404 as const }
  if (from.id === to.id) return { error: "Pick a colleague, not yourself", status: 400 as const }
  if (c.status !== "waiting_for_person" || c.routedTo?.personId !== from.id) return { error: "This case is not waiting for you", status: 409 as const }
  const note = input.note?.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || undefined
  const at = new Date().toISOString()
  const updated: WithHandoffs = {
    ...c,
    routedTo: {
      personId: to.id,
      why: note ? `${from.name} sent it to you at ${clock(at)}: "${note}"` : `${from.name} sent it to you at ${clock(at)}.`,
      mode: c.routedTo?.mode ?? "best_record",
      at,
    },
    handoffs: [...(c.handoffs ?? []), { from: from.id, to: to.id, ...(note ? { note } : {}), at, before: c.routedTo }],
  }
  await saveCase(updated, state.derivedIds.has(c.id) ? "derived" : "agent")
  return { case: updated, handoff: toHandoff(state, updated, updated.handoffs!.at(-1)!) }
}

/** Undo the last hand-off of a case, while the colleague has not decided it yet. */
export async function undoHandoff(input: { caseId: string; personId: string }) {
  const state = await buildState()
  const c = state.cases.find((x) => x.id === input.caseId) as WithHandoffs | undefined
  if (!c) return { error: "Case not found", status: 404 as const }
  const last = c.handoffs?.at(-1)
  const person = findPerson(state.people, input.personId)
  if (!last || !person || last.from !== person.id) return { error: "Nothing to undo", status: 409 as const }
  if (c.status !== "waiting_for_person" || c.routedTo?.personId !== last.to) return { error: "The colleague already took it on", status: 409 as const }
  const updated: WithHandoffs = { ...c, routedTo: last.before, handoffs: c.handoffs!.slice(0, -1) }
  await saveCase(updated, state.derivedIds.has(c.id) ? "derived" : "agent")
  return { case: updated }
}

function toHandoff(state: EngineState, c: WithHandoffs, h: HandoffEntry): Handoff {
  const name = (id: string) => state.people.find((p) => p.id === id)?.name ?? id
  const order = state.world.byId.get(c.orderId)
  return {
    caseId: c.id,
    reference: order?.reference ?? "",
    vehicle: vehicleName(order),
    from: { id: h.from, name: name(h.from) },
    to: { id: h.to, name: name(h.to) },
    ...(h.note ? { note: h.note } : {}),
    at: h.at,
  }
}

/** Every hand-off in the room, newest first. */
export function handoffsIn(state: EngineState): Handoff[] {
  const out: Handoff[] = []
  for (const c of state.cases as WithHandoffs[]) for (const h of c.handoffs ?? []) out.push(toHandoff(state, c, h))
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export async function listHandoffs(given?: EngineState): Promise<Handoff[]> {
  return handoffsIn(given ?? (await buildState()))
}
