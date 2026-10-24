"use client"

// map 08: A click flies to the car; its card docks bottom right with previous and next.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardWhy, dressed by fly-to.css.
import "./fly-to.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-08", tag: true, fly: true, card: "dock", controls: "top-right" }

export function FlyToMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
