// Needs you grouped by time (N2's variants share this rule; each folder keeps its own copy so a
// variant can be adopted alone). The rows come sorted by decide-by, so groups keep that order.
import type { WorkRow } from "@/lib/control-room/types-v3"

export type RowTimes = Record<string, { text: string; now: boolean }>
export type TimeGroup = { key: string; title: string; rows: WorkRow[] }

/** The group a decide-by falls in, from the words the server already worked out ("12:25", "Tomorrow 07:00"). */
export function groupOf(t?: { text: string; now: boolean }): { key: string; title: string } {
  if (!t) return { key: "none", title: "No set time" }
  if (t.now) return { key: "hour", title: "Within the hour" }
  const today = /^(\d{1,2}):\d\d$/.exec(t.text)
  if (today) {
    const h = Number(today[1])
    if (h < 12) return { key: "morning", title: "This morning" }
    if (h < 17) return { key: "afternoon", title: "This afternoon" }
    return { key: "evening", title: "This evening" }
  }
  if (/^tomorrow/i.test(t.text)) return { key: "tomorrow", title: "Tomorrow" }
  return { key: "later", title: "Later" }
}

const ORDER = ["hour", "morning", "afternoon", "evening", "tomorrow", "later", "none"]

export function byTime(rows: WorkRow[], times: RowTimes): TimeGroup[] {
  const groups = new Map<string, TimeGroup>()
  for (const r of rows) {
    const g = groupOf(times[r.caseId])
    if (!groups.has(g.key)) groups.set(g.key, { ...g, rows: [] })
    groups.get(g.key)!.rows.push(r)
  }
  return [...groups.values()].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
}

/** Arrow keys, Home and End move focus between the links inside `root` (WAI-ARIA listbox keys). */
export function moveFocus(e: React.KeyboardEvent, root: HTMLElement | null, selector = "a") {
  if (!root || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) || e.metaKey || e.altKey || e.ctrlKey) return
  const links = [...root.querySelectorAll<HTMLElement>(selector)].filter((l) => l.offsetParent !== null)
  if (!links.length) return
  e.preventDefault()
  e.stopPropagation()
  const at = links.indexOf(document.activeElement as HTMLElement)
  const to =
    e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : at < 0 ? 0 : Math.min(links.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))
  links[to].focus()
  links[to].scrollIntoView({ block: "nearest" })
}
