"use client"

// map 07: Apple's muted map in Bahn's paper tones; the map fades out under the panel.
// Same props as today's CarMap (kit/kit.tsx); the card is the kit's CardAsk, dressed by paper.css.
import "./paper.css"
import { KitMap, type CarMapProps, type KitOpts } from "../kit/kit"

const OPTS: KitOpts = { root: "lab-map-07", look: "paper", tag: true, fade: true, green: { radius: [2.5, 3.6, 5], opacity: 0.85 } }

export function PaperMap(p: CarMapProps) {
  return <KitMap {...p} opts={OPTS} />
}
