"use client"

// map 05: One agent car pings at a time, in turn, instead of all breathing together.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by agent-at-work.css.
import "./agent-at-work.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-05", tag: true, agent: "turns" }

export function AgentAtWorkMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
