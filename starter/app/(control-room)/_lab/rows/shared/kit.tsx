"use client"

// Slot `rows`, shared by variants 01 to 08. Adopting a variant: copy its folder and this one.

import { useLab } from "../../context"
import type { CaseRowsListProps } from "../../../_ui/work-case"
import type { OptionsSheetProps } from "../../../_ui/question"

export type { CaseRowsListProps, OptionsSheetProps }

/** A needs variant is chosen (?v=needs:nn): it owns Other tasks, so a rows variant renders <NeedsRow /> there. */
export function useNeedsVariant(): boolean {
  const v = useLab().v.needs
  return !!v && v !== "00"
}

/** "Seller hold on the car" from the facts, as one short line: the first fact's value, then the second's, lower case. */
export function whyLine(why: { label: string; value: string }[]): string {
  const [a, b] = why
  if (!a) return ""
  return b ? `${a.value}, ${b.label.toLowerCase()} ${b.value.charAt(0).toLowerCase()}${b.value.slice(1)}` : a.value
}

/** The sentences of a text (its lines, split at . ! ?). */
const sentences = (s: string) => s.split("\n").flatMap((line) => line.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean)

/** The first sentence of a text. */
export const firstSentence = (s: string) => sentences(s)[0] ?? ""

/** The opener's sentence worth a preview: what makes this case new, or what the suggestion rests on; else the first. */
export function openerLine(s: string): string {
  const all = sentences(s)
  return all.find((x) => /^(This has not happened|Nobody|It rests on|Last time|.* decided (it|this) )/.test(x)) ?? all[0] ?? ""
}
