// The base map: OpenFreeMap vector tiles (no key, OpenStreetMap data), restyled in
// Bahn's map colours (design/tokens.css --bx-map-*: birch land, teal-50 water) and
// muted the Airbnb way: labels only for countries and cities, no road names,
// shields or points of interest. "positron" and "liberty" are the raw styles, kept
// so the two can be compared (?map=positron or ?map=liberty on the Overview).

import type { StyleSpecification } from "maplibre-gl"

export type MapLook = "bahn" | "positron" | "liberty"

/** MapLibre finds its worker next to its own module, which a bundler moves. Serve a copy
 *  from public/ instead; keep the name in step with the pinned maplibre-gl version. */
export const WORKER_URL = "/maplibre/maplibre-gl-worker-6.13.0.mjs"

const URL: Record<MapLook, string> = {
  bahn: "https://tiles.openfreemap.org/styles/positron",
  positron: "https://tiles.openfreemap.org/styles/positron",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
}

const cache = new Map<MapLook, Promise<StyleSpecification>>()

export function loadStyle(look: MapLook): Promise<StyleSpecification> {
  if (!cache.has(look)) {
    cache.set(
      look,
      fetch(URL[look])
        .then((r) => r.json() as Promise<StyleSpecification>)
        .then((s) => (look === "bahn" ? bahn(s) : s)),
    )
  }
  return cache.get(look)!
}

const LAND = "#f5f3ec"
const WATER = "#d5ecf0"
const GREEN = "#e6ecdb"
const ROAD = "#fffef7"
const CASING = "#e7e3d9"
const BORDER = "#cdc6b8"
const LABEL = "#7a7262"
const HALO = "rgba(255, 254, 247, 0.9)"

const HIDE = /^(highway-name|highway-shield|road_shield|airport|label_other|label_village|label_state|waterway_line_label|railway|aeroway|building)/

// Cities where Bahn's cars are; at country zoom only these are named.
const MARKET = [
  "Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu", "Jyväskylä", "Lahti", "Kuopio", "Vaasa",
  "Hamburg", "Berlin", "Munich", "München", "Frankfurt", "Frankfurt am Main", "Cologne", "Köln", "Düsseldorf", "Stuttgart", "Bremen", "Hanover", "Hannover", "Leipzig",
  "Copenhagen", "København", "Aarhus", "Odense", "Aalborg", "Stockholm", "Gothenburg", "Göteborg", "Malmö", "Tallinn",
]
const NAME = ["coalesce", ["get", "name_en"], ["get", "name:latin"], ["get", "name"]]

type Layer = StyleSpecification["layers"][number]

function bahn(style: StyleSpecification): StyleSpecification {
  const s = structuredClone(style)
  const out: Layer[] = []
  for (const l of s.layers) {
    if (HIDE.test(l.id)) continue
    const paint = { ...(("paint" in l && l.paint) || {}) } as Record<string, unknown>
    const layout = { ...(("layout" in l && l.layout) || {}) } as Record<string, unknown>
    const id = l.id
    if (id === "background") paint["background-color"] = LAND
    else if (id === "water") paint["fill-color"] = WATER
    else if (id === "waterway") paint["line-color"] = WATER
    else if (id === "park" || id === "landcover_wood") {
      paint["fill-color"] = GREEN
      paint["fill-opacity"] = 0.7
    } else if (id === "landuse_residential") paint["fill-color"] = "#f1efe7"
    else if (/landcover_(ice|glacier)/.test(id)) paint["fill-color"] = "#fbfaf6"
    else if (/casing/.test(id)) paint["line-color"] = CASING
    else if (/(inner|minor|path|pier|subtle)/.test(id)) paint[l.type === "fill" ? "fill-color" : "line-color"] = /subtle/.test(id) ? CASING : ROAD
    else if (/^boundary/.test(id)) paint["line-color"] = BORDER
    if (l.type === "symbol") {
      paint["text-color"] = /water_name/.test(id) ? "#86aeb6" : /country/.test(id) ? "#b1a996" : LABEL
      paint["text-halo-color"] = HALO
      paint["text-halo-width"] = 1.4
      layout["text-field"] = NAME // one name, in English where there is one
    }
    const base = { ...l, paint, layout } as Layer
    if (id === "label_town") {
      out.push({ ...base, minzoom: 8 } as Layer)
    } else if (id === "label_city" || id === "label_city_capital") {
      const filter = (l as { filter?: unknown }).filter
      out.push({ ...base, maxzoom: 7, filter: ["all", filter, ["in", NAME, ["literal", MARKET]]] } as Layer)
      out.push({ ...base, id: `${id}_all`, minzoom: 7 } as Layer)
    } else out.push(base)
  }
  s.layers = out
  return s
}
