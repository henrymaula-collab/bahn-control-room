"use client"

import { useEffect, useState } from "react"

/** The AI's pick for "Send to a colleague": who, and one line that is true from the data. */
export type ColleaguePick = {
  personId: string
  name: string
  avatar?: string
  /** For the card row's subline, a few words: "Jonas reads German". */
  short: string
  /** The panel's line under the name: "Reads German, the language at Calverona Hamburg." */
  reason: string
}

/** The card row's subline: the recommended colleague for this case, null while it loads or when nobody fits. */
export function useColleaguePick(caseId: string, personId: string): ColleaguePick | null {
  const [pick, setPick] = useState<ColleaguePick | null>(null)
  useEffect(() => {
    setPick(null)
  }, [caseId, personId])
  return pick
}

/**
 * Mount once in the card's rows. It renders nothing until the frame's panel is "colleague"
 * (usePanel().setOpen("colleague")), then shows the panel in the side slot.
 */
export function SendToColleague(_props: { caseId: string; personId: string }) {
  return null
}
