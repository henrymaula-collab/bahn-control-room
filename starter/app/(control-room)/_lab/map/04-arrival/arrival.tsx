"use client"

// map 04: The arrival: the camera settles, green fades in, the agent's cars, then red drops in, yours pulse once.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by arrival.css.
import "./arrival.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-04", tag: true, intro: true }

export function ArrivalMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
