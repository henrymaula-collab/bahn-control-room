"use client"

// Night lab, client side: which variant each slot shows and the photographable state, from the
// URL. Today's components call useLabPart at each mount point; with no ?v= it returns today's
// component itself, so the page is pixel-identical to v4. No imports of components here (the
// registry comes in through LabProvider), so there are no import cycles.

import { createContext, useContext } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { labStateOf, type LabState, type Slot } from "./slots"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = React.ComponentType<any>
export type Variant = { slug: string; title: string; parts: Record<string, AnyComponent> }
export type SlotRegistry = Record<string, Variant> // "00", "07", ...
export type Registry = Record<Slot, SlotRegistry>

/** Needs you for the side menu (the layout's rows, ?many= padded; the decide-by words worked out on the server). */
export type MenuNeeds = { rows: WorkRow[]; times: Record<string, { text: string; now: boolean }> }

type Lab = { state: LabState; registry: Registry | null; needs: MenuNeeds }
const EMPTY: Lab = { state: labStateOf(() => null), registry: null, needs: { rows: [], times: {} } }
export const LabContext = createContext<Lab>(EMPTY)

/** The lab params of this page (see slots.ts LabState). */
export const useLab = () => useContext(LabContext).state

/** Needs you as the layout has it, for parts outside Your tasks' frame (the side menu). */
export const useMenuNeeds = () => useContext(LabContext).needs

/** The variant ?v= picks for a slot, or undefined (today). */
export function useVariant(slot: Slot): Variant | undefined {
  const { state, registry } = useContext(LabContext)
  const nn = state.v[slot]
  return nn && nn !== "00" ? registry?.[slot]?.[nn] : undefined
}

/**
 * The component for one mount point: the picked variant's part, or today's. A variant that does
 * not define this part leaves today's in place.
 */
export function useLabPart<C extends AnyComponent>(slot: Slot, part: string, Today: C): C {
  const v = useVariant(slot)
  return ((v?.parts[part] as C | undefined) ?? Today) as C
}

/** A mount point that is empty today (needs `Top`, `Around`, `Menu`): the variant's part or null. */
export function useLabExtra(slot: Slot, part: string): AnyComponent | null {
  return useVariant(slot)?.parts[part] ?? null
}
