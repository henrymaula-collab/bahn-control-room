// Read-only access to the seeded dataset for the agent's tools. It reads the
// same JSONL files the seed script loads, so it works without Postgres and
// follows any row a judge edits (reseed-safe: nothing here knows an order id).

import fs from "node:fs"
import path from "node:path"
import { paths } from "./config"

export type Row = Record<string, unknown> & { id: string }

const cache = new Map<string, Row[]>()

export function table(name: string): Row[] {
  const hit = cache.get(name)
  if (hit) return hit
  const file = path.join(paths.dataset(), `${name}.jsonl`)
  const rows = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Row)
    : []
  cache.set(name, rows)
  return rows
}

export function clearDataCache(): void {
  cache.clear()
}

export const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined)

export interface OrderRow extends Row {
  reference: string
  customer_id: string
  status: string
  display_lane: string
  readiness_status: string
  route_kind: string
  pickup_site_id?: string | null
  pickup_address_id?: string | null
  delivery_site_id?: string | null
  delivery_address_id?: string | null
  active_plan_id?: string | null
  customer_reference?: string
  created_at: string
}

export interface SiteRow extends Row {
  name: string
  city: string
  country: string
  timezone: string
  customer_id?: string
  kind?: string
  handover_mode?: string
  opening_hours?: Record<string, string | null | boolean>
  pickup_access_note?: string
  access_note?: string
  release_document_rule?: string
  requires_signed_release?: boolean
  advance_notice_minutes?: number
  pickup_contact_email?: string
  address_id?: string
}

/** Find an order by its reference (CD-420516) or id (ord-00516). */
export function findOrder(refOrId: string): OrderRow | undefined {
  const key = refOrId.trim().toUpperCase()
  return table("orders").find((o) => String(o.reference).toUpperCase() === key || String(o.id).toUpperCase() === key) as OrderRow | undefined
}

export function byId(name: string, id: string | null | undefined): Row | undefined {
  if (!id) return undefined
  return table(name).find((r) => r.id === id)
}

export function forOrder(name: string, orderId: string): Row[] {
  return table(name).filter((r) => r.order_id === orderId || (Array.isArray(r.order_ids) && (r.order_ids as string[]).includes(orderId)))
}

export function site(id: string | null | undefined): SiteRow | undefined {
  return byId("sites", id) as SiteRow | undefined
}

export function customer(id: string | null | undefined): Row | undefined {
  return byId("customers", id)
}

/** The pickup place of an order: its site, or the plain address when there is no managed site. */
export function pickupPlace(order: OrderRow): { site?: SiteRow; address?: Row } {
  const s = site(order.pickup_site_id)
  const address = byId("addresses", order.pickup_address_id ?? s?.address_id)
  return { site: s, address }
}

export function vehicleFor(order: OrderRow): Row | undefined {
  const items = forOrder("order_items", order.id)
  const primary = items.find((i) => i.role === "PRIMARY") ?? items[0]
  return byId("vehicles", str(primary?.vehicle_id))
}

export function vehicleLabel(v: Row | undefined): string {
  if (!v) return "the car"
  const reg = str(v.registration)
  return `${v.make} ${v.model}${v.model_year ? ` (${v.model_year})` : ""}${reg ? `, ${reg}` : ""}`
}

/** The driver currently assigned to the order, if any (cancelled assignments excluded). */
export function activeAssignment(orderId: string): Row | undefined {
  const rows = forOrder("work_assignments", orderId).filter((a) => !["CANCELLED"].includes(String(a.status)))
  return rows.find((a) => a.status !== "COMPLETED") ?? rows[0]
}

export function driver(id: string | null | undefined): Row | undefined {
  return byId("drivers", id)
}

/** Conversations that concern the order (filing order or related orders). */
export function conversationsFor(orderId: string): Row[] {
  return table("conversations").filter(
    (c) => c.order_id === orderId || (Array.isArray(c.related_order_ids) && (c.related_order_ids as string[]).includes(orderId)),
  )
}

export function messagesFor(conversationId: string): Row[] {
  return table("messages")
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => String(a.authored_at).localeCompare(String(b.authored_at)))
}

/** Language a pickup place speaks on the phone, from its country. */
export function placeLanguage(country: string | undefined): string {
  switch ((country ?? "").toUpperCase()) {
    case "DE":
    case "AT":
      return "de"
    case "FI":
      return "fi"
    case "DK":
      return "da"
    case "FR":
      return "fr"
    case "SE":
      return "sv"
    default:
      return "en"
  }
}

export const LANGUAGE_NAMES: Record<string, string> = { de: "German", fi: "Finnish", da: "Danish", fr: "French", sv: "Swedish", en: "English" }
