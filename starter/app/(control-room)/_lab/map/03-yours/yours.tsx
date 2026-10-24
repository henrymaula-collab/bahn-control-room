"use client"

// map 03: The person's own cases are bigger with an ink ring; other red dots are smaller.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by yours.css.
import "./yours.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-03", tag: true }

export function YoursMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
