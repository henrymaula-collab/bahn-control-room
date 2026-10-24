"use client"

import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
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
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}
