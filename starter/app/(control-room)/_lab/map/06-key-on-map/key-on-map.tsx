"use client"

// map 06: The key moves onto the map as three switches with counts.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardWhy, dressed by key-on-map.css.
import "./key-on-map.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-06", tag: true, legend: true }

export function KeyOnMapMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
