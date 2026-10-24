"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { WorkLists, WorkRow } from "@/lib/control-room/types-v3"
import { Icon } from "./icons"

type ListKey = keyof WorkLists
const TABS: { key: ListKey; label: string }[] = [
  { key: "needYou", label: "Needs you" },
  { key: "agentWorking", label: "Agent working" },
  { key: "doneToday", label: "Done today" },
]

/** Shown next to each row: the decide-by time, red only within the hour. Worked out on the server. */
export type RowTime = Record<string, { text: string; now: boolean }>

type Panel = { open: boolean; setOpen: (o: boolean) => void; slot: HTMLDivElement | null }
const PanelContext = createContext<Panel>({ open: false, setOpen: () => {}, slot: null })
export const usePanel = () => useContext(PanelContext)

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (!!el.closest("input, textarea, select, [contenteditable], dialog") || el.isContentEditable)
}

/** Work: the quiet list on the left, the chosen case on the right, the situation panel over the list. */
export function WorkFrame({ lists, times, children }: { lists: WorkLists; times: RowTime; children: React.ReactNode }) {
  const path = usePathname() ?? "/work"
  const router = useRouter()
  const current = decodeURIComponent(path.split("/")[2] ?? "")
  const home: ListKey = (TABS.find((t) => lists[t.key].some((r) => r.caseId === current))?.key ?? "needYou") as ListKey
  const [tab, setTab] = useState<ListKey>(home)
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Opening another case shows the list it belongs to.
  useEffect(() => setTab(home), [home])

  const rows = lists[home]
  const index = rows.findIndex((r) => r.caseId === current)
  const prev = index > 0 ? rows[index - 1] : undefined
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : undefined

  // Keyboard: J and K walk the list the case is in; arrows move between rows, Enter opens; Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      if (e.key === "Escape" && open) {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === "j" && next) router.push(`/work/${next.caseId}`)
      if (e.key === "k" && prev) router.push(`/work/${prev.caseId}`)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a.wrow") ?? [])]
        if (!links.length || open) return
        e.preventDefault()
        const at = links.indexOf(document.activeElement as HTMLAnchorElement)
        const from = at >= 0 ? at : Math.max(0, links.findIndex((l) => l.getAttribute("aria-current") === "true"))
        const to = at < 0 ? from : Math.min(links.length - 1, Math.max(0, from + (e.key === "ArrowDown" ? 1 : -1)))
        links[to].focus()
        links[to].scrollIntoView({ block: "nearest" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, next, prev, open])

  const panel = useMemo(() => ({ open, setOpen, slot }), [open, slot])

  return (
    <PanelContext.Provider value={panel}>
      <div className={`work${open ? " with-panel" : ""}`}>
        <div className="list" ref={listRef} aria-hidden={open || undefined}>
          <div className="tabs" role="tablist" aria-label="Work">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
                <span className="num">{lists[t.key].length}</span>
              </button>
            ))}
          </div>
          <Rows rows={lists[tab]} current={current} times={tab === "needYou" ? times : {}} empty={emptyWords(tab)} />
        </div>
        <div className="detail">
          {index >= 0 && rows.length > 1 && (
            <nav className="walk" aria-label="Walk the list">
              <span className="pos num">
                {index + 1} of {rows.length}
              </span>
              <WalkLink row={prev} icon="chevron-up" label="Previous case (K)" />
              <WalkLink row={next} icon="chevron-down" label="Next case (J)" />
            </nav>
          )}
          {children}
        </div>
        <div ref={setSlot} style={{ display: "contents" }} />
      </div>
    </PanelContext.Provider>
  )
}

function WalkLink({ row, icon, label }: { row?: WorkRow; icon: "chevron-up" | "chevron-down"; label: string }) {
  if (!row)
    return (
      <span aria-disabled="true" role="link" aria-label={label}>
        <Icon name={icon} size={18} />
      </span>
    )
  return (
    <Link href={`/work/${row.caseId}`} aria-label={label} title={label}>
      <Icon name={icon} size={18} />
    </Link>
  )
}

function Rows({ rows, current, times, empty }: { rows: WorkRow[]; current: string; times: RowTime; empty?: string }) {
  if (!rows.length) return empty ? <p className="list-empty">{empty}</p> : null
  return (
    <ul className="rows-list">
      {rows.map((r) => {
        const t = times[r.caseId]
        return (
          <li key={r.caseId}>
            <Link href={`/work/${r.caseId}`} className="wrow" aria-current={r.caseId === current ? "true" : undefined}>
              <span className="v">{r.vehicle}</span>
              <span className="p">{r.place}</span>
              {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// An empty Needs you is said once, on the right; the tab's 0 is enough here.
const emptyWords = (tab: ListKey) =>
  tab === "needYou" ? undefined : tab === "agentWorking" ? "The agent is not on anything for your desk." : "Nothing decided yet today."
