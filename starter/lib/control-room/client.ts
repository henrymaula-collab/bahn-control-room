// The one place the screens get their data from.
//
//   CR_DATA=fixtures (default)  typed fixtures in ./fixtures, no database needed
//   CR_DATA=api                 the foundation API under /api/cr/*
//
// Server-side only: pages and server actions call these functions. Switching the
// flag must not need any change in the screens.

import type { Decision, Lesson, TrustRule } from "./types"
import type { CaseDetail, DeskView, LeadView } from "./views"
import * as fixtures from "./fixtures"

export type DataSource = "fixtures" | "api"

export const dataSource = (): DataSource => (process.env.CR_DATA === "api" ? "api" : "fixtures")

const base = () => process.env.CR_API_BASE ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
  if (res.status === 404) return null as T
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}`)
  return (await res.json()) as T
}

export async function getDesk(personId: string, opts: { extraRows?: number } = {}): Promise<DeskView> {
  if (dataSource() === "api") return api<DeskView>(`/api/cr/desk?person=${encodeURIComponent(personId)}`)
  return fixtures.deskView(personId, opts)
}

export async function getCase(id: string, personId: string): Promise<CaseDetail | null> {
  if (dataSource() === "api") return api<CaseDetail | null>(`/api/cr/cases/${encodeURIComponent(id)}?person=${encodeURIComponent(personId)}`)
  return fixtures.caseDetail(id, personId)
}

export async function getLead(personId: string): Promise<LeadView> {
  if (dataSource() === "api") return api<LeadView>(`/api/cr/lead?person=${encodeURIComponent(personId)}`)
  return fixtures.leadView(personId)
}

/** Saves a decision. Upsert by id, so the "why" can follow in a second call. */
export async function postDecision(d: Omit<Decision, "at">): Promise<Decision> {
  if (dataSource() === "api") return api<Decision>(`/api/cr/decisions`, { method: "POST", body: JSON.stringify(d) })
  return fixtures.saveDecision(d)
}

export async function postTrustRule(id: string, status: TrustRule["status"], personId: string): Promise<TrustRule> {
  if (dataSource() === "api")
    return api<TrustRule>(`/api/cr/trust-rules/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ status, personId }) })
  return fixtures.setTrustRule(id, status, personId)
}

export async function postLessonReview(id: string, action: "accept" | "retire" | "edit", personId: string, text?: string): Promise<Lesson> {
  if (dataSource() === "api")
    return api<Lesson>(`/api/cr/lessons/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ action, personId, text }) })
  return fixtures.reviewLesson(id, action, personId, text)
}
