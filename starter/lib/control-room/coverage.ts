// Who can handle which kind of case, counted from past decisions. A count, never
// a score or a rank: we only say who has handled a kind of case often enough.

import { caseTypePhrase } from "./format"
import type { OpsPerson, TrackRecord } from "./types"

export const CAN_HANDLE_AT = 3 // decisions of this kind before we say a person can handle it

export interface CoverageRow {
  type: string
  label: string
  phrase: string // "release documents at German pickup places"
  canHandle: OpsPerson[]
  learning: { person: OpsPerson; decided: number }[]
  onlyOne: boolean
}

export function coverageRows(
  rows: { type: string; label: string; country?: string; phrase?: string }[],
  records: TrackRecord[],
  people: OpsPerson[],
): CoverageRow[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  return rows.map((row) => {
    const counts = new Map<string, number>()
    for (const r of records) {
      if (r.caseType !== row.type) continue
      if (row.country && r.country !== row.country) continue
      counts.set(r.personId, (counts.get(r.personId) ?? 0) + r.decided)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const canHandle = sorted.filter(([, n]) => n >= CAN_HANDLE_AT).map(([id]) => byId.get(id)).filter((p): p is OpsPerson => !!p)
    const learning = sorted
      .filter(([, n]) => n > 0 && n < CAN_HANDLE_AT)
      .map(([id, n]) => ({ person: byId.get(id)!, decided: n }))
      .filter((l) => !!l.person)
    return {
      type: row.type,
      label: row.label,
      phrase: row.phrase ?? caseTypePhrase(row.type),
      canHandle,
      learning,
      onlyOne: canHandle.length === 1,
    }
  })
}
