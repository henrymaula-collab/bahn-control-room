// The v3 screens' data: Overview, Work lists and a case with its extras.
// Same switch as client.ts: CR_DATA=fixtures reads ./fixtures/v3.ts, otherwise the
// engine's /api/cr/overview, /api/cr/work and /api/cr/cases/:id (branch engine-v3).
// Kept in its own file so the engine branch can change client.ts without a clash.

import { headers } from "next/headers"
import { dataSource, getCase } from "./client"
import * as v3 from "./fixtures/v3"
import type { CaseV3Extras, Overview, WorkLists } from "./types-v3"
import type { CaseDetail } from "./views"

/** A case as Work shows it: the existing detail plus why, the situation and one "what happens next" line. */
export type WorkCase = { detail: CaseDetail; extras: (CaseV3Extras & { next?: string }) | null }

async function api<T>(path: string): Promise<T | null> {
  const h = await headers()
  const host = h.get("host") ?? `127.0.0.1:${process.env.PORT ?? 3000}`
  const base = process.env.CR_API_BASE ?? `${h.get("x-forwarded-proto") ?? "http"}://${host}`
  const res = await fetch(`${base}${path}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`)
  return (await res.json()) as T
}

const engineId = (id: string) => (id.startsWith("p-") ? id : `p-${id}`)

export async function getOverview(personId: string): Promise<Overview> {
  if (dataSource() === "fixtures") return v3.overview(personId)
  const o = await api<Overview>(`/api/cr/overview?person=${encodeURIComponent(engineId(personId))}`)
  if (!o) throw new Error("No overview")
  return o
}

export async function getWork(personId: string, opts: { extraRows?: number } = {}): Promise<WorkLists> {
  if (dataSource() === "fixtures") return v3.workLists(personId, opts)
  const w = await api<WorkLists>(`/api/cr/work?person=${encodeURIComponent(engineId(personId))}`)
  return w ?? { needYou: [], agentWorking: [], doneToday: [] }
}

export async function getWorkCase(id: string, personId: string): Promise<WorkCase | null> {
  if (dataSource() === "fixtures") {
    const detail = await getCase(v3.baseCaseId(id), personId)
    return detail ? { detail, extras: v3.caseExtras(id) } : null
  }
  const detail = await getCase(id, personId)
  if (!detail) return null
  const raw = await api<Partial<CaseV3Extras>>(`/api/cr/cases/${encodeURIComponent(id)}`)
  const extras = raw?.situation ? { why: raw.why ?? [], situation: raw.situation, next: nextLine(detail.card.case.suggestion.effect) } : null
  return { detail, extras }
}

/** Until the engine sends its own line: the effect's second sentence, when there is one. */
function nextLine(effect: string): string | undefined {
  const rest = effect.split(/(?<=\.)\s+/).slice(1).join(" ").trim()
  return rest ? rest.replace(/^(When [^,]+, )?it /, (_m, when) => `${when ?? ""}the agent `) : undefined
}
