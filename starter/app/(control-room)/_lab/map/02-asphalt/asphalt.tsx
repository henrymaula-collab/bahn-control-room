"use client"

// map 02: Bahn's asphalt map: red glows, green dims, the card in asphalt.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by asphalt.css.
import "./asphalt.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-02", look: "dark", tag: true, green: { color: "#29af77", stroke: "#12110e", radius: [2.6, 3.6, 5], opacity: 0.78 } }

export function AsphaltMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
