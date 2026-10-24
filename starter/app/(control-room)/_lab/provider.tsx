"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"
import { LabContext, type MenuNeeds } from "./context"
import { REGISTRY } from "./registry"
import { labStateOf } from "./slots"

/** Around the whole control room (layout.tsx): the registry and this URL's lab state. */
export function LabProvider({ needs, children }: { needs: MenuNeeds; children: React.ReactNode }) {
  const params = useSearchParams()
  const search = params?.toString() ?? ""
  const value = useMemo(() => {
    const q = new URLSearchParams(search)
    return { state: labStateOf((k) => q.get(k)), registry: REGISTRY, needs }
  }, [search, needs])
  useEffect(() => void markMapsIdle(), [])
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

/**
 * For the shot pipeline: every MapLibre map (today's and any variant's, they share one module)
 * writes data-lab-idle="1" on its container when it has painted all its tiles ("idle"), and "0"
 * while it loads or moves. Only a data attribute: nothing on screen changes.
 */
async function markMapsIdle() {
  const ml = await import("maplibre-gl")
  const proto = ml.Map.prototype as unknown as { fire: (e: unknown, p?: unknown) => unknown; __labIdle?: boolean }
  if (proto.__labIdle) return
  proto.__labIdle = true
  const fire = proto.fire
  proto.fire = function (this: { getContainer?: () => HTMLElement }, event: unknown, props?: unknown) {
    const type = typeof event === "string" ? event : (event as { type?: string })?.type
    const box = type ? this.getContainer?.() : undefined
    if (box && (type === "idle" || type === "dataloading" || type === "movestart")) box.dataset.labIdle = type === "idle" ? "1" : "0"
    return fire.call(this, event, props)
  }
}
