"use client"

// Sub-parts a variant renders inside itself, picked through the lab, so slots stay combinable:
// a card variant (?v=card:07) still shows decide:03's email preview with ?v=card:07,decide:03.
// On adoption into v4, replace each Slot* with today's component named beside it.

import { DecisionDone, type DoneProps, OptionsSheet, type OptionsSheetProps } from "../_ui/question"
import { SendPreview } from "../_ui/send-preview"
import { NeedsMenu } from "../_ui/shell"
import { NeedsRow } from "../_ui/work-case"
import { useLabExtra, useLabPart } from "./context"

type SendPreviewProps = React.ComponentProps<typeof SendPreview>

/** decide.SendPreview (today: _ui/send-preview.tsx SendPreview). */
export function SlotSendPreview(props: SendPreviewProps) {
  const C = useLabPart("decide", "SendPreview", SendPreview)
  return <C {...props} />
}

/** decide.Done, or needs.Done when the needs variant has one (today: _ui/question.tsx DecisionDone). */
export function SlotDone(props: DoneProps) {
  const NeedsDone = useLabExtra("needs", "Done") // a needs variant may own the moment after a decision
  const C = useLabPart("decide", "Done", DecisionDone)
  const D = NeedsDone ?? C
  return <D {...props} />
}

/** rows.OptionsSheet (today: _ui/question.tsx OptionsSheet). */
export function SlotOptionsSheet(props: OptionsSheetProps) {
  const C = useLabPart("rows", "OptionsSheet", OptionsSheet)
  return <C {...props} />
}

/** needs.Row, the Other tasks row (today: _ui/work-case.tsx NeedsRow -> OtherTasks). */
export const SlotNeedsRow = NeedsRow

/** needs.Menu, the side menu's Needs-you place (today: _ui/shell.tsx NeedsMenu, empty). */
export const SlotNeedsMenu = NeedsMenu
