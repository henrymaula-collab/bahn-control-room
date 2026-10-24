"use client"

// map 01: Red dots with a soft halo; hover names the car; the open one gets an ink ring.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by halo.css.
import "./halo.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-01", tag: true }

export function HaloMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
