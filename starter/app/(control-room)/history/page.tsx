import "./history.css"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { dataSource } from "@/lib/control-room/client"
import type { HistoryView as View } from "@/lib/control-room/history"
import { currentPersonId } from "../_ui/session"
import { type HistoryState, HistoryView } from "./history-view"

export const metadata: Metadata = { title: "History" }
export const dynamic = "force-dynamic"

/** Reads GET /api/cr/history on this app's own host (as lib/control-room/client.ts does). */
async function load(personId: string): Promise<View | null> {
  if (dataSource() === "fixtures") return null
  const h = await headers()
  const base = process.env.CR_API_BASE ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? `127.0.0.1:${process.env.PORT ?? 3000}`}`
  // A shift lead gets everyone's rows at once, so the person filter works without a reload.
  const ask = async (scope: string) => fetch(`${base}/api/cr/history?person=${encodeURIComponent(personId)}&scope=${scope}`, { cache: "no-store" })
  const res = await ask("everyone")
  if (!res.ok) return null
  return (await res.json()) as View
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? undefined

/** History: every case this person finished, grouped by day the way Finder groups files. */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [personId, params] = await Promise.all([currentPersonId(), searchParams])
  const view = await load(personId)
  if (!view) {
    return (
      <section className="hist hist-none">
        <h1 className="hist-title">History</h1>
        <p className="hist-quiet">History needs the database (CR_DATA=api).</p>
      </section>
    )
  }
  const initial: HistoryState = {
    q: one(params.q) ?? "",
    range: one(params.range) ?? "all",
    kind: one(params.kind) ?? "all",
    who: one(params.who) ?? "me",
    sort: one(params.sort) ?? "when",
    dir: one(params.dir) === "asc" ? "asc" : "desc",
    open: one(params.open) ?? null,
  }
  // Remount when the person changes, so filters never carry over between people.
  return <HistoryView key={view.person.id} view={view} initial={initial} />
}
