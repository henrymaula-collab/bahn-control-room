"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { WorkLists, WorkRow } from "@/lib/control-room/types-v3"
import { useLab, useLabExtra } from "../_lab/context"
import { keepQuery } from "../_lab/slots"
import { lookOf, lookQuery } from "../tasks/look"
import { Icon } from "./icons"

/** Shown next to each row: the decide-by time, red only within the hour. Worked out on the server. */
export type RowTime = Record<string, { text: string; now: boolean }>

/**
 * One side panel at a time: the situation (always there by default), the conversation with the
 * agent, or the message about to be sent. Closing the chat or the message brings the situation back.
 */
export type PanelKind = "situation" | "chat" | "email"
type Panel = {
  open: PanelKind | null
  /** null closes what is open and shows the case's default panel again. */
  setOpen: (o: PanelKind | null) => void
  /** Called by each case: its default panel ("situation", or null when it has none). */
  reset: (base: PanelKind | null) => void
  slot: HTMLDivElement | null
}
const PanelContext = createContext<Panel>({ open: null, setOpen: () => {}, reset: () => {}, slot: null })
export const usePanel = () => useContext(PanelContext)

/** The person's other Needs-you cases, for the card's "Other tasks" row (Henry, 24 Oct 21:45: the
 *  side menu keeps only "Your tasks N"). Off in ?tasks=switcher and ?tasks=column, which show the list. */
type Others = { rows: WorkRow[]; times: RowTime; href: (id: string) => string; show: boolean }
const OthersContext = createContext<Others>({ rows: [], times: {}, href: (id) => `/tasks/${id}`, show: false })
export const useOtherTasks = () => useContext(OthersContext)

/** Needs you as the frame knows it, for the lab's `needs` parts: every row, where you are, the neighbours. */
export type NeedsYou = { rows: WorkRow[]; current: string; index: number; prev?: WorkRow; next?: WorkRow; times: RowTime; href: (id: string) => string; look: string }
const NeedsContext = createContext<NeedsYou>({ rows: [], current: "", index: -1, times: {}, href: (id) => `/tasks/${id}`, look: "menu" })
export const useNeedsYou = () => useContext(NeedsContext)

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (!!el.closest("input, textarea, select, [contenteditable], dialog") || el.isContentEditable)
}

/** Your tasks: the chosen case, the situation beside it, and the Needs you list where the look puts it. */
export function WorkFrame({ lists, times, children }: { lists: WorkLists; times: RowTime; children: React.ReactNode }) {
  const path = usePathname() ?? "/tasks"
  const params = useSearchParams()
  const router = useRouter()
  const look = lookOf(params?.get("tasks"))
  const query = lookQuery(look)
  // The lab's ?v= and ?many= travel with every move between cases (none: exactly v4's query).
  const keep = keepQuery(params, query)
  const href = useCallback((id: string) => `/tasks/${id}${keep}`, [keep])
  const lab = useLab()
  const Top = useLabExtra("needs", "Top")
  const Around = useLabExtra("needs", "Around")
  const current = decodeURIComponent(path.split("/")[2] ?? "")
  const [base, setBase] = useState<PanelKind | null>("situation")
  // Lab ?panel=: the panel open on the first case (chat, email, situation or none).
  const labPanel = lab.panel === "none" ? null : lab.panel
  const [open, setOpenRaw] = useState<PanelKind | null>(lab.panel ? labPanel! : "situation")
  // It stays on the case the page opened on (a ref, not a one-shot: dev StrictMode runs effects twice).
  const firstCase = useRef(current)
  const here = useRef(current)
  here.current = current
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const rows = lists.needYou
  const index = rows.findIndex((r) => r.caseId === current)
  const prev = index > 0 ? rows[index - 1] : undefined
  const next = index >= 0 ? rows[index + 1] : rows[0]

  const setOpen = useCallback((o: PanelKind | null) => setOpenRaw(o ?? base), [base])
  const reset = useCallback(
    (b: PanelKind | null) => {
      setBase(b)
      setOpenRaw(lab.panel && here.current === firstCase.current ? (labPanel ?? null) : b)
    },
    [lab.panel, labPanel],
  )

  // Keyboard: J and K walk Needs you; arrows move between rows, Enter opens; Escape closes the chat or the message.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      if (e.key === "Escape" && open && open !== base) {
        e.preventDefault()
        setOpenRaw(base)
        return
      }
      if (e.key === "j" && next && index >= 0) router.push(href(next.caseId))
      if (e.key === "k" && prev) router.push(href(prev.caseId))
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a.wrow") ?? [])]
        if (!links.length) return
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
  }, [router, href, next, prev, index, open, base])

  const panel = useMemo(() => ({ open, setOpen, reset, slot }), [open, setOpen, reset, slot])
  const others = useMemo(
    () => ({ rows: rows.filter((r) => r.caseId !== current), times, href, show: look === "menu" }),
    [rows, current, times, href, look],
  )
  const needs = useMemo(
    () => ({ rows, current, index, prev, next, times, href, look }),
    [rows, current, index, prev, next, times, href, look],
  )
  // The panel's room is kept from the first paint, so the card does not jump when it slides in.
  const withPanel = !!current && !!open
  const detail = (
    <div className="detail">
      {look === "switcher" && <Switcher rows={rows} index={index} next={next} times={times} href={href} />}
      {Top && <Top />}
      {children}
    </div>
  )

  return (
    <PanelContext.Provider value={panel}>
      <OthersContext.Provider value={others}>
        <NeedsContext.Provider value={needs}>
          <div className={`work look-${look}${withPanel ? " has-panel" : ""}`}>
            {look === "column" && (
              <div className="list" ref={listRef}>
                <Rows rows={rows} current={current} times={times} href={href} />
              </div>
            )}
            {Around ? <Around>{detail}</Around> : detail}
            <div ref={setSlot} style={{ display: "contents" }} />
          </div>
        </NeedsContext.Provider>
      </OthersContext.Provider>
    </PanelContext.Provider>
  )
}

export function Rows({ rows, current, times, href, role }: { rows: WorkRow[]; current: string; times: RowTime; href: (id: string) => string; role?: "menu" }) {
  if (!rows.length) return null
  return (
    <ul className="rows-list" role={role}>
      {rows.map((r) => {
        const t = times[r.caseId]
        return (
          <li key={r.caseId} role={role ? "none" : undefined}>
            <Link href={href(r.caseId)} className="wrow" role={role ? "menuitem" : undefined} aria-current={r.caseId === current ? "true" : undefined}>
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

/** `?tasks=switcher`: the case's car opens Needs you as a menu; where you are in it; the next one. */
function Switcher({
  rows,
  index,
  next,
  times,
  href,
}: {
  rows: WorkRow[]
  index: number
  next?: WorkRow
  times: RowTime
  href: (id: string) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = index >= 0 ? rows[index] : undefined

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    // Escape closes the menu before anything else on the page hears it.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false))
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [open])

  if (!rows.length) return null
  return (
    <div className="detail-inner switcher" ref={ref}>
      <button type="button" className="switch-car" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{current ? current.vehicle : "Needs you"}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {current && (
        <span className="switch-at">
          {index + 1} of {rows.length}
        </span>
      )}
      {next && (
        <Link href={href(next.caseId)} className="switch-next">
          Next
          <Icon name="chevron-right" size={18} />
        </Link>
      )}
      {open && (
        <div className="switch-menu" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <Rows rows={rows} current={current?.caseId ?? ""} times={times} href={href} role="menu" />
        </div>
      )}
    </div>
  )
}
