// The order of Your tasks and what "next case" means. Shared by the dock (track N), the card's
// "Next case" after a decision (track C) and the chat's receipt (track T), so all three open the
// same case. Pure: no React, no server imports, safe on both sides.
//
// Rule: Your tasks is the person's Needs-you cases, most urgent first (decide-by, earliest first;
// no decide-by last; ties by case id), exactly getWork()'s needYou order. The next case is the
// first row that comes after the open case in that order. When the open case has just left the
// list (decided, or sent to a colleague), "after" still uses its own decide-by and id, so the case
// that followed it opens. After the last one it wraps to the first row left. No rows: no next case.

export type Orderable = { caseId: string; decideBy?: string | null }

const key = (r: Orderable) => `${r.decideBy ?? "9999"}|${r.caseId}`

/** The same order getWork() sorts needYou in. */
export const byTaskOrder = (a: Orderable, b: Orderable) => key(a).localeCompare(key(b))

/** The case to open after `current` (a row, or a bare case id when its decide-by is unknown). */
export function nextCase<T extends Orderable>(rows: T[], current: Orderable | string | undefined): T | undefined {
  const others = typeof current === "string" ? rows.filter((r) => r.caseId !== current) : rows.filter((r) => r.caseId !== current?.caseId)
  if (!others.length) return undefined
  if (!current) return others[0]
  const at = typeof current === "string" ? rows.find((r) => r.caseId === current) : current
  if (!at) return others[0]
  const k = key(at)
  return others.find((r) => key(r) > k) ?? others[0]
}

/** The case before `current` in the same order, for the dock's ‹ (no wrap). */
export function previousCase<T extends Orderable>(rows: T[], current: Orderable | string | undefined): T | undefined {
  if (!current) return undefined
  const at = typeof current === "string" ? rows.find((r) => r.caseId === current) : current
  if (!at) return undefined
  const k = key(at)
  return [...rows].reverse().find((r) => r.caseId !== at.caseId && key(r) < k)
}
