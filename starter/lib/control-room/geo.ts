// Static geocode table for the Overview map. The packet gives places a city and
// a country, never coordinates ("This packet does not provide map coordinates",
// dataset/SCHEMA.md), so every city in addresses, sites and ferry terminals has
// a fixed centre here. Nothing is looked up at runtime and nothing needs a key.
//
// Source: city-centre coordinates from each city's Wikipedia article (infobox
// coordinates, en.wikipedia.org/wiki/<City>), cross-checked against the GeoNames
// populated-place record (geonames.org), rounded to 4 decimals. `land` is the
// compass sector (degrees, clockwise from north) that stays on land near the
// centre, so offsets for coastal cities do not drop a place into the sea.
//
// Places inside a city are fictional, so a place sits at a fixed, deterministic
// offset from its city centre (by place id), and each car at a further small
// offset (by order id), so cars in one city do not stack on one pixel.

import type { LatLng } from "./types-v3"

type CityEntry = LatLng & { land?: [number, number] }

export const CITY_COORDS: Record<string, CityEntry> = {
  "AT:Graz": { lat: 47.0707, lng: 15.4395 },
  "AT:Vienna": { lat: 48.2082, lng: 16.3738 },
  "BE:Antwerp": { lat: 51.2194, lng: 4.4025 },
  "DE:Berlin": { lat: 52.52, lng: 13.405 },
  "DE:Cologne": { lat: 50.9375, lng: 6.9603 },
  "DE:Düsseldorf": { lat: 51.2277, lng: 6.7735 },
  "DE:Frankfurt": { lat: 50.1109, lng: 8.6821 },
  "DE:Hamburg": { lat: 53.5511, lng: 9.9937 },
  "DE:Leipzig": { lat: 51.3397, lng: 12.3731 },
  "DE:Munich": { lat: 48.1351, lng: 11.582 },
  "DE:Stuttgart": { lat: 48.7758, lng: 9.1829 },
  "DK:Aarhus": { lat: 56.1567, lng: 10.2108, land: [180, 360] },
  "DK:Copenhagen": { lat: 55.6761, lng: 12.5683, land: [200, 340] },
  "DK:Odense": { lat: 55.4038, lng: 10.4024 },
  "FI:Espoo": { lat: 60.2055, lng: 24.6559, land: [300, 420] },
  "FI:Helsinki": { lat: 60.1699, lng: 24.9384, land: [300, 420] },
  "FI:Lahti": { lat: 60.9827, lng: 25.6612, land: [90, 270] },
  "FI:Oulu": { lat: 65.0121, lng: 25.4651, land: [0, 180] },
  "FI:Seinäjoki": { lat: 62.7903, lng: 22.8403 },
  "FI:Tampere": { lat: 61.4978, lng: 23.761, land: [60, 120] },
  "FI:Turku": { lat: 60.4518, lng: 22.2666, land: [330, 480] },
  "FI:Vantaa": { lat: 60.2934, lng: 25.0378 },
  "FR:Lille": { lat: 50.6292, lng: 3.0573 },
  "FR:Lyon": { lat: 45.764, lng: 4.8357 },
  "FR:Marseille": { lat: 43.2965, lng: 5.3698, land: [0, 150] },
  "FR:Paris": { lat: 48.8566, lng: 2.3522 },
  "NL:Rotterdam": { lat: 51.9244, lng: 4.4777 },
  "SE:Gothenburg": { lat: 57.7089, lng: 11.9746, land: [20, 160] },
  "SE:Malmö": { lat: 55.605, lng: 13.0038, land: [0, 200] },
  "SE:Stockholm": { lat: 59.3293, lng: 18.0686, land: [270, 360] },
}

/** Capital-city fallback when a city is missing from the table (tests make sure the dataset never needs it). */
const COUNTRY_FALLBACK: Record<string, string> = {
  AT: "AT:Vienna", BE: "BE:Antwerp", DE: "DE:Berlin", DK: "DK:Copenhagen", FI: "FI:Helsinki",
  FR: "FR:Paris", NL: "NL:Rotterdam", SE: "SE:Stockholm",
}

export const cityKey = (city: string, country: string) => `${country}:${city}`

export function cityEntry(city: string, country: string): CityEntry | null {
  return CITY_COORDS[cityKey(city, country)] ?? CITY_COORDS[COUNTRY_FALLBACK[country] ?? ""] ?? null
}

/** Europe, generously: every position the room shows must fall inside this box. */
export const EUROPE = { minLat: 34, maxLat: 72, minLng: -25, maxLng: 45 }

export function inEurope(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && p.lat >= EUROPE.minLat && p.lat <= EUROPE.maxLat && p.lng >= EUROPE.minLng && p.lng <= EUROPE.maxLng
}

/** FNV-1a: a stable 32-bit hash, so the same id always lands on the same spot. */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Two numbers in [0, 1) from one id. */
function unit2(seed: string): [number, number] {
  const a = hash(seed)
  const b = hash(`${seed}#2`)
  return [a / 4294967296, b / 4294967296]
}

/** Move a point `km` kilometres on a compass bearing. Flat-earth maths is fine at city scale. */
export function offset(p: LatLng, km: number, bearingDeg: number): LatLng {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (km * Math.cos(rad)) / 111.32
  const dLng = (km * Math.sin(rad)) / (111.32 * Math.cos((p.lat * Math.PI) / 180))
  return { lat: round(p.lat + dLat), lng: round(p.lng + dLng) }
}

const round = (value: number) => Math.round(value * 1e5) / 1e5

/** A deterministic spot `minKm..maxKm` from `p`, inside the land sector when one is given. */
export function jitter(p: LatLng, seed: string, minKm: number, maxKm: number, land?: [number, number]): LatLng {
  const [u, v] = unit2(seed)
  const [from, to] = land ?? [0, 360]
  const bearing = (from + u * (to - from)) % 360
  return offset(p, minKm + v * (maxKm - minKm), bearing)
}

/** Where a place is: its city centre plus a fixed offset by place id (0.4 to 2.5 km). */
export function placePosition(place: { id: string; city: string; country: string }): LatLng | null {
  const entry = cityEntry(place.city, place.country)
  if (!entry) return null
  return jitter(entry, `place:${place.id}`, 0.4, 2.5, entry.land)
}

/** A car at a place: the place plus 40 to 350 m by order id. */
export function carAt(place: LatLng, orderId: string): LatLng {
  return jitter(place, `car:${orderId}`, 0.04, 0.35)
}

/** Ferry lanes between the terminal cities, so a car on board is drawn on the sea route and not
 * across Denmark or Sweden. Waypoints follow the usual Travemünde-Helsinki and Stockholm-Helsinki
 * routes on a Baltic chart (OpenSeaMap, openseamap.org), rounded to open water. */
const SEA_LANES: Record<string, LatLng[]> = {
  "DE:Hamburg>FI:Helsinki": [
    { lat: 53.96, lng: 10.87 }, { lat: 54.52, lng: 12.25 }, { lat: 55.45, lng: 15.6 }, { lat: 57.0, lng: 19.2 },
    { lat: 58.4, lng: 20.6 }, { lat: 59.45, lng: 22.6 }, { lat: 59.95, lng: 24.6 },
  ],
  "SE:Stockholm>FI:Helsinki": [
    { lat: 59.42, lng: 18.9 }, { lat: 59.85, lng: 19.7 }, { lat: 59.72, lng: 21.5 }, { lat: 59.7, lng: 23.0 }, { lat: 59.95, lng: 24.6 },
  ],
}

export function seaLane(from: { city: string; country: string }, to: { city: string; country: string }): LatLng[] {
  const there = SEA_LANES[`${cityKey(from.city, from.country)}>${cityKey(to.city, to.country)}`]
  if (there) return there.map((p) => ({ ...p }))
  const back = SEA_LANES[`${cityKey(to.city, to.country)}>${cityKey(from.city, from.country)}`]
  return back ? [...back].reverse().map((p) => ({ ...p })) : []
}

/** Great-circle distance in km. */
export function km(a: LatLng, b: LatLng): number {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** The point at fraction `t` (0..1) of the way along a route of straight legs. */
export function along(route: LatLng[], t: number): LatLng {
  if (!route.length) throw new Error("along() needs at least one point")
  if (route.length === 1) return { ...route[0]! }
  const f = Math.min(1, Math.max(0, t))
  const legs = route.slice(1).map((point, i) => km(route[i]!, point))
  const total = legs.reduce((sum, leg) => sum + leg, 0)
  if (total === 0) return { ...route[0]! }
  let left = f * total
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!
    if (left <= leg || i === legs.length - 1) {
      const k = leg === 0 ? 0 : Math.min(1, left / leg)
      const a = route[i]!
      const b = route[i + 1]!
      return { lat: round(a.lat + (b.lat - a.lat) * k), lng: round(a.lng + (b.lng - a.lng) * k) }
    }
    left -= leg
  }
  return { ...route[route.length - 1]! }
}
