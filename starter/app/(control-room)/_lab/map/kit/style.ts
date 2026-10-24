// Map slot kit: base styles. "bahn" and "dark" are today's (map-style.ts); "paper" is Apple's muted
// map style (HIG Maps: "a desaturated version of the map ... great if you have a lot of
// information-rich content that you want to stand out") in Bahn's paper tones: no green parks,
// water a grey teal, labels one step lighter, so the only saturated colour is the cars.

import type { StyleSpecification } from "maplibre-gl"
import { loadStyle, type MapLook } from "../../../_ui/map-style"

export type KitLook = MapLook | "paper"

type Layer = StyleSpecification["layers"][number]

const PAPER = {
  land: "#f6f4ed", water: "#d8e1df", green: "#f6f4ed", road: "#fffef7", casing: "#e9e5db", border: "#cbc4b6",
  label: "#958c7b", halo: "rgba(255, 254, 247, 0.92)", waterLabel: "#a8b4b0", countryLabel: "#bab1a0", residential: "#f3f1ea", ice: "#fbfaf6",
}

const HIDE = /^(highway-name|highway-shield|road_shield|airport|label_other|label_village|label_state|waterway_line_label|railway|aeroway|building|poi)/
const MARKET = [
  "Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu", "Jyväskylä", "Lahti", "Kuopio", "Vaasa",
  "Hamburg", "Berlin", "Munich", "München", "Frankfurt", "Frankfurt am Main", "Cologne", "Köln", "Düsseldorf", "Stuttgart", "Bremen", "Hanover", "Hannover", "Leipzig",
  "Copenhagen", "København", "Aarhus", "Odense", "Aalborg", "Stockholm", "Gothenburg", "Göteborg", "Malmö", "Tallinn",
]
const NAME = ["coalesce", ["get", "name_en"], ["get", "name:latin"], ["get", "name"]]

const cache = new Map<KitLook, Promise<StyleSpecification>>()

export function kitStyle(look: KitLook): Promise<StyleSpecification> {
  if (look !== "paper") return loadStyle(look)
  if (!cache.has(look)) cache.set(look, loadStyle("positron").then((s) => paper(s)))
  return cache.get(look)!
}

function paper(style: StyleSpecification): StyleSpecification {
  const c = PAPER
  const s = structuredClone(style)
  const out: Layer[] = []
  for (const l of s.layers) {
    if (HIDE.test(l.id)) continue
    const paint = { ...(("paint" in l && l.paint) || {}) } as Record<string, unknown>
    const layout = { ...(("layout" in l && l.layout) || {}) } as Record<string, unknown>
    const id = l.id
    if (id === "background") paint["background-color"] = c.land
    else if (id === "water") paint["fill-color"] = c.water
    else if (id === "waterway") paint["line-color"] = c.water
    else if (id === "park" || id === "landcover_wood") {
      paint["fill-color"] = c.green
      paint["fill-opacity"] = 0
    } else if (id === "landuse_residential") paint["fill-color"] = c.residential
    else if (/landcover_(ice|glacier)/.test(id)) paint["fill-color"] = c.ice
    else if (/casing/.test(id)) paint["line-color"] = c.casing
    else if (/(inner|minor|path|pier|subtle)/.test(id)) paint[l.type === "fill" ? "fill-color" : "line-color"] = /subtle/.test(id) ? c.casing : c.road
    else if (/^boundary/.test(id)) {
      paint["line-color"] = c.border
      paint["line-opacity"] = 0.8
    }
    if (l.type === "symbol") {
      paint["text-color"] = /water_name/.test(id) ? c.waterLabel : /country/.test(id) ? c.countryLabel : c.label
      paint["text-halo-color"] = c.halo
      paint["text-halo-width"] = 1.4
      layout["text-field"] = NAME
    }
    const base = { ...l, paint, layout } as Layer
    if (id === "label_town") out.push({ ...base, minzoom: 8 } as Layer)
    else if (id === "label_city" || id === "label_city_capital") {
      const filter = (l as { filter?: unknown }).filter
      out.push({ ...base, maxzoom: 7, filter: ["all", filter, ["in", NAME, ["literal", MARKET]]] } as unknown as Layer)
      out.push({ ...base, id: `${id}_all`, minzoom: 7 } as Layer)
    } else out.push(base)
  }
  s.layers = out
  return s
}
