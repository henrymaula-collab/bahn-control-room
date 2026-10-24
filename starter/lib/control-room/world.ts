// Loads the whole seeded dataset into memory, once per call, and builds the
// starter's `Bundle` for every order so the engine can reuse the starter's
// pure reading layer (lib/present/attention.ts and friends).
//
// Nothing here is cached across calls on purpose: a judge can edit a JSONL
// row, run `npm run db:seed`, and the next request reads the new rows. The
// dataset is small (about 4,400 rows), so a full load takes a few hundred ms.

import { asc, eq } from "drizzle-orm"
import { Directory, snapshotNames } from "../present/actors"
import type { Bundle, MessageRow, PlaceRow, RelatedRow, SiteRow } from "../present/bundle"
import type { Row } from "../present/types"
import {
  addresses, alerts, conversations, customers, datasetMetadata, drivers, messages, operationalEvents, orderItems, orders,
  relatedRecords, sites, vehicles,
} from "../schema"
import { crDb } from "./db"

const iso = (value: Date | string | null | undefined): string => value instanceof Date ? value.toISOString() : value ? String(value) : ""

export type Place = {
  /** Managed site id when the place is a managed site, otherwise the address id. */
  id: string
  name: string
  city: string
  country: string
  timezone: string | null
  site: SiteRow | null
  address: PlaceRow | null
}

export type OrderWorld = {
  id: string
  reference: string
  bundle: Bundle
  customer: { id: string; name: string; country: string | null }
  pickup: Place
  delivery: Place
}

export type AssignmentRef = { orderId: string; row: RelatedRow }

export type World = {
  snapshotAt: string
  orders: OrderWorld[]
  byId: Map<string, OrderWorld>
  places: Map<string, Place>
  customers: Map<string, { id: string; name: string; country: string }>
  assignmentsByDriver: Map<string, AssignmentRef[]>
  operators: Row[]
  /** Shared reference data (city-to-terminal road estimates), keyed by id. */
  roadEstimates: Map<string, Record<string, unknown>>
}

function placeFor(addressId: string, siteId: string | null, addressMap: Map<string, PlaceRow>, siteMap: Map<string, SiteRow>): Place {
  const site = siteId ? siteMap.get(siteId) ?? null : null
  const address = addressMap.get(addressId) ?? null
  const tz = (site?.details.timezone ?? address?.details.timezone ?? null) as string | null
  return {
    id: site?.id ?? addressId,
    name: site?.name ?? address?.name ?? "Unknown place",
    city: site?.city ?? address?.city ?? "",
    country: site?.country ?? address?.country ?? "",
    timezone: typeof tz === "string" ? tz : null,
    site,
    address,
  }
}

export async function loadWorld(): Promise<World> {
  const db = crDb
  const [metadata] = await db.select().from(datasetMetadata).limit(1)
  const [orderRows, customerRows, siteRows, addressRows, driverRows, itemRows, alertRows, threadRows, messageRows, eventRows, relatedRows] = await Promise.all([
    db.select().from(orders).orderBy(asc(orders.reference)),
    db.select().from(customers),
    db.select().from(sites),
    db.select().from(addresses),
    db.select().from(drivers),
    db.select({ item: orderItems, vehicle: vehicles }).from(orderItems).innerJoin(vehicles, eq(orderItems.vehicleId, vehicles.id)),
    db.select().from(alerts),
    db.select().from(conversations),
    db.select().from(messages).orderBy(asc(messages.authoredAt)),
    db.select().from(operationalEvents).orderBy(asc(operationalEvents.recordedAt)),
    db.select().from(relatedRecords),
  ])
  const snapshotAt = metadata?.snapshotAt ? metadata.snapshotAt.toISOString() : new Date().toISOString()

  const addressMap = new Map<string, PlaceRow>(addressRows.map((row) => [row.id, {
    id: row.id, name: row.name, city: row.city, country: row.country, managedSiteId: row.managedSiteId, details: row.details,
  }]))
  const siteMap = new Map<string, SiteRow>(siteRows.map((row) => [row.id, {
    id: row.id, name: row.name, city: row.city, country: row.country, kind: row.kind, details: row.details,
  }]))
  const shared = (collection: string) => relatedRows.filter((row) => row.collection === collection)
  const operators = shared("operators").map((row) => ({ id: row.id, ...row.details }))
  const agents = shared("agents").map((row) => ({ id: row.id, ...row.details }))
  const inbox: RelatedRow[] = shared("support_inbox_threads").map((row) => ({ id: row.id, details: row.details }))
  const endpointRows = shared("order_endpoint_details")

  const dir = new Directory({
    drivers: driverRows.map((row) => ({ id: row.id, displayName: row.displayName, homeCity: row.homeCity, homeCountry: row.homeCountry })),
    operators: operators as Row[],
    agents: agents as Row[],
    customers: customerRows.map((row) => ({ id: row.id, name: row.name })),
    sites: siteRows.map((row) => ({ id: row.id, name: row.name })),
    endpointDetails: endpointRows.map((row) => ({ id: row.id, ...row.details })),
    snapshots: snapshotNames(messageRows.map((row) => ({ details: row.details }))),
  })

  // Group everything by order once.
  const relatedByOrder = new Map<string, Record<string, RelatedRow[]>>()
  for (const row of relatedRows) {
    const ids = new Set<string>()
    if (row.orderId) ids.add(row.orderId)
    // A bundle offer covers several orders; file it under each member.
    if (row.collection === "market_offers" && Array.isArray(row.details.order_ids)) {
      for (const id of row.details.order_ids) if (typeof id === "string") ids.add(id)
    }
    for (const orderId of ids) {
      const byCollection = relatedByOrder.get(orderId) ?? {}
      ;(byCollection[row.collection] ??= []).push({ id: row.id, details: row.details })
      relatedByOrder.set(orderId, byCollection)
    }
  }
  const threadsByOrder = new Map<string, (typeof conversations.$inferSelect)[]>()
  for (const thread of threadRows) {
    const related = Array.isArray(thread.details.related_order_ids) ? thread.details.related_order_ids : []
    const ids = new Set([thread.orderId, ...related.filter((value): value is string => typeof value === "string")])
    for (const orderId of ids) {
      const list = threadsByOrder.get(orderId) ?? []
      if (!list.some((known) => known.id === thread.id)) list.push(thread)
      threadsByOrder.set(orderId, list)
    }
  }
  const messagesByThread = new Map<string, (typeof messages.$inferSelect)[]>()
  for (const message of messageRows) {
    const list = messagesByThread.get(message.conversationId) ?? []
    list.push(message)
    messagesByThread.set(message.conversationId, list)
  }
  const groupBy = <T extends { orderId: string }>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const item of items) {
      const list = map.get(item.orderId) ?? []
      list.push(item)
      map.set(item.orderId, list)
    }
    return map
  }
  const alertsByOrder = groupBy(alertRows)
  const eventsByOrder = groupBy(eventRows)
  const itemsByOrder = new Map<string, typeof itemRows>()
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.item.orderId) ?? []
    list.push(row)
    itemsByOrder.set(row.item.orderId, list)
  }
  const customerMap = new Map(customerRows.map((row) => [row.id, row]))
  const refs = new Map(orderRows.map((row) => [row.id, row.reference]))

  const places = new Map<string, Place>()
  const worldOrders: OrderWorld[] = orderRows.map((order) => {
    const threads = (threadsByOrder.get(order.id) ?? []).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    const orderMessages: MessageRow[] = threads.flatMap((thread) => messagesByThread.get(thread.id) ?? [])
      .sort((a, b) => a.authoredAt.getTime() - b.authoredAt.getTime())
      .map((message) => ({
        id: message.id, orderId: message.orderId, conversationId: message.conversationId, authorType: message.authorType,
        body: message.body, authoredAt: iso(message.authoredAt), details: message.details,
      }))
    const related = relatedByOrder.get(order.id) ?? {}
    const inboxThreads = inbox.filter((thread) => {
      const candidates = Array.isArray(thread.details.candidate_order_ids) ? thread.details.candidate_order_ids : []
      const linked = Array.isArray(thread.details.linked_order_ids) ? thread.details.linked_order_ids : []
      return candidates.includes(order.id) || linked.includes(order.id)
    })
    const customer = customerMap.get(order.customerId)
    const bundle: Bundle = {
      snapshotAt,
      order: {
        id: order.id, reference: order.reference, lane: order.displayLane, status: order.status, routeKind: order.routeKind,
        createdAt: iso(order.createdAt), updatedAt: iso(order.updatedAt), details: order.details,
        pickupAddressId: order.pickupAddressId, deliveryAddressId: order.deliveryAddressId,
        pickupSiteId: order.pickupSiteId, deliverySiteId: order.deliverySiteId,
      },
      customer: { id: order.customerId, name: customer?.name ?? "Unknown customer", tier: customer?.accountTier ?? null, country: customer?.country ?? null },
      items: (itemsByOrder.get(order.id) ?? []).map(({ item, vehicle }) => ({
        id: item.id, role: item.role, details: item.details,
        vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.modelYear, fuel: vehicle.fuel, registration: vehicle.registration, vin: vehicle.syntheticVin },
      })),
      alerts: (alertsByOrder.get(order.id) ?? []).map((alert) => ({
        id: alert.id, status: alert.status, severity: alert.severity, signal: alert.signal, summary: alert.summary,
        triggeredAt: iso(alert.triggeredAt), details: alert.details,
      })),
      conversations: threads.map((thread) => ({
        id: thread.id, orderId: thread.orderId, status: thread.status, category: thread.category, channel: thread.channel,
        updatedAt: iso(thread.updatedAt), details: thread.details,
      })),
      messages: orderMessages,
      events: (eventsByOrder.get(order.id) ?? []).map((event) => ({
        id: event.id, orderId: event.orderId, command: event.command, targetType: event.targetType, targetId: event.targetId,
        recordedAt: iso(event.recordedAt), details: event.details,
      })).reverse(),
      related,
      places: addressMap,
      sites: siteMap,
      dir,
      inboxThreads,
      bundleOrderRefs: Object.fromEntries(refs),
    }
    const pickup = placeFor(order.pickupAddressId, order.pickupSiteId, addressMap, siteMap)
    const delivery = placeFor(order.deliveryAddressId, order.deliverySiteId, addressMap, siteMap)
    places.set(pickup.id, pickup)
    places.set(delivery.id, delivery)
    return {
      id: order.id, reference: order.reference, bundle,
      customer: { id: order.customerId, name: customer?.name ?? "Unknown customer", country: customer?.country ?? null },
      pickup, delivery,
    }
  })
  // Every managed site is a place, even with no order today (history can point at it).
  for (const site of siteMap.values()) {
    if (!places.has(site.id)) {
      const addressId = typeof site.details.address_id === "string" ? site.details.address_id : ""
      places.set(site.id, placeFor(addressId, site.id, addressMap, siteMap))
    }
  }

  const assignmentsByDriver = new Map<string, AssignmentRef[]>()
  for (const row of relatedRows) {
    if (row.collection !== "work_assignments" || !row.orderId) continue
    const driverId = typeof row.details.driver_id === "string" ? row.details.driver_id : null
    if (!driverId) continue
    const list = assignmentsByDriver.get(driverId) ?? []
    list.push({ orderId: row.orderId, row: { id: row.id, details: row.details } })
    assignmentsByDriver.set(driverId, list)
  }

  return {
    snapshotAt,
    orders: worldOrders,
    byId: new Map(worldOrders.map((order) => [order.id, order])),
    places,
    customers: new Map(customerRows.map((row) => [row.id, { id: row.id, name: row.name, country: row.country }])),
    assignmentsByDriver,
    operators: operators as Row[],
    roadEstimates: new Map(shared("terminal_road_estimates").map((row) => [row.id, row.details])),
  }
}

/** The control room's clock. The dataset is a snapshot, so by default "now" is the snapshot time
 * (Wed 21 Oct 2026 12:00 Helsinki). Set CR_CLOCK=real to use the wall clock instead. */
export function worldNow(world: Pick<World, "snapshotAt">): string {
  return process.env.CR_CLOCK === "real" ? new Date().toISOString() : world.snapshotAt
}

export function hoursFrom(nowIso: string, value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return null
  return (t - new Date(nowIso).getTime()) / 3_600_000
}
