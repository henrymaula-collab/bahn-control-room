// The one place the screens get their data from.
//
//   CR_DATA=api (default)   the foundation engine through /api/cr/* (needs the seeded database)
//   CR_DATA=fixtures        typed fixtures in ./fixtures, no database needed (design work, screenshots)
//
// Server-side only: pages and server actions call these functions. Switching the
// flag must not need any change in the screens.

import { headers } from "next/headers"
import { apiCase, apiDecide, apiDesk, apiLead, resolvePerson } from "./api-adapter"
import type { Decision, Lesson, OpsPerson, TrustRule } from "./types"
import type { CaseDetail, DeskView, LeadView } from "./views"
import * as fixtures from "./fixtures"

export type DataSource = "fixtures" | "api"

export const dataSource = (): DataSource => (process.env.CR_DATA === "fixtures" ? "fixtures" : "api")

/** The API lives in the same app: use this request's own host unless CR_API_BASE says otherwise. */
async function base(): Promise<string> {
  if (process.env.CR_API_BASE) return process.env.CR_API_BASE
  const h = await headers()
  const host = h.get("host") ?? `127.0.0.1:${process.env.PORT ?? 3000}`
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${await base()}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
  if (res.status === 404) return null as T
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}`)
  return (await res.json()) as T
}

export async function getDesk(personId: string, opts: { extraRows?: number } = {}): Promise<DeskView> {
  if (dataSource() === "api") return apiDesk(api, personId)
  return fixtures.deskView(personId, opts)
}

export async function getCase(id: string, personId: string): Promise<CaseDetail | null> {
  if (dataSource() === "api") return apiCase(api, id, personId)
  return fixtures.caseDetail(id, personId)
}

export async function getLead(personId: string): Promise<LeadView> {
  if (dataSource() === "api") return apiLead(api, personId)
  return fixtures.leadView(personId)
}

/** Saves a decision, once, with the "why" when the person gave one. */
export async function postDecision(d: Omit<Decision, "at">): Promise<Decision> {
  if (dataSource() === "api") return apiDecide(api, { ...d, personId: await apiPersonId(d.personId) })
  return fixtures.saveDecision(d)
}

export async function postTrustRule(id: string, status: TrustRule["status"], personId: string): Promise<TrustRule> {
  if (dataSource() === "api")
    return api<TrustRule>(`/api/cr/trust-rules/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ status, personId: await apiPersonId(personId) }) })
  return fixtures.setTrustRule(id, status, personId)
}

export async function postLessonReview(id: string, action: "accept" | "retire" | "edit", personId: string, text?: string): Promise<Lesson> {
  if (dataSource() === "api")
    return api<Lesson>(`/api/cr/lessons/${encodeURIComponent(id)}/review`, {
      method: "POST",
      // The API takes accept: true | false; an edit is an accept with new text.
      body: JSON.stringify({ accept: action !== "retire", personId: await apiPersonId(personId), text }),
    })
  return fixtures.reviewLesson(id, action, personId, text)
}

/** The engine's person id for a cookie value ("aino" or "p-aino"). */
async function apiPersonId(id: string): Promise<string> {
  const people = await api<OpsPerson[]>("/api/cr/people")
  return resolvePerson(people, id).id
}
