import type { MapCar } from "@/lib/control-room/types-v3"

/**
 * Bahn's markets, for the Overview's pill switch. Ops work per country (Finland, Germany,
 * Denmark), so "where are my cars" is the first question. A car counts where it is now
 * (its position), so a car on the ferry counts only under All.
 */
export type RegionId = "all" | "FI" | "DE" | "DK" | "SE"
export type Bounds = [[number, number], [number, number]] // [[west, south], [east, north]]

export const REGIONS: { id: RegionId; label: string; where: string }[] = [
  { id: "all", label: "All", where: "across Europe" },
  { id: "FI", label: "Finland", where: "in Finland" },
  { id: "DE", label: "Germany", where: "in Germany" },
  { id: "DK", label: "Denmark", where: "in Denmark" },
  { id: "SE", label: "Sweden", where: "in Sweden" },
]

/** Rough land boxes, tested in this order, good enough for "where is the car now". */
function countryAt(lat: number, lng: number): RegionId | null {
  // Finland: east of the Gulf of Bothnia; in the far north, east of the Torne river.
  if (lat >= 59.6 && lng <= 31.6 && (lat <= 64.5 ? lng >= 20.5 : lng >= 24.15)) return "FI"
  // Denmark: north of the border at Flensburg, west of the Øresund.
  if (lat >= 54.8 && lat <= 57.9 && lng >= 8 && lng <= 12.65) return "DK"
  if (lat >= 55 && lat <= 69.1 && lng >= 10.5 && lng <= 24.2) return "SE"
  if (lat >= 47.2 && lat <= 55.1 && lng >= 5.8 && lng <= 15.1) return "DE"
  return null
}

/** The cars in a region, by where they are now. */
export function carsIn(cars: MapCar[], id: RegionId): MapCar[] {
  return id === "all" ? cars : cars.filter((c) => countryAt(c.position.lat, c.position.lng) === id)
}

/** Only the markets that have cars today, so the switch never offers an empty map. */
export function regionsWithCars(cars: MapCar[]) {
  return REGIONS.filter((r) => r.id === "all" || carsIn(cars, r.id).length > 0)
}

export function tally(cars: MapCar[]) {
  const needsPerson = cars.filter((c) => c.state === "needs_person").length
  const agentWorking = cars.filter((c) => c.state === "agent_working").length
  return { total: cars.length, onPlan: cars.length - needsPerson - agentWorking, agentWorking, needsPerson }
}

/** The bounds that frame these cars; null when there are none. */
export function boundsOf(cars: MapCar[]): Bounds | null {
  if (!cars.length) return null
  let w = 180, s = 90, e = -180, n = -90
  for (const c of cars) {
    w = Math.min(w, c.position.lng)
    e = Math.max(e, c.position.lng)
    s = Math.min(s, c.position.lat)
    n = Math.max(n, c.position.lat)
  }
  return [[w, s], [e, n]]
}
