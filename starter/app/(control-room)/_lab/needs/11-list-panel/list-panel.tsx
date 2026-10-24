"use client"

// needs 11: the list beside the card. "Other tasks ›" opens the whole queue as the side panel, in
// place of the situation, the way "Talk it through ›" opens the chat (Apple HIG: "use a panel if
// people need to repeatedly provide input and observe results"). It stays open while you move
// between cases, the one you are on highlighted (HIG lists: a list that drives navigation keeps its
// row selected). Closing it brings the situation back. Right after a decision the panel turns to the
// list by itself, the decided case marked, because the situation of a settled case is no longer the
// next thing to read; the card's own "Next case" stays the one default.

import Link from "next/link"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab, useLabPart } from "../../context"
import { Icon } from "../../../_ui/icons"
import { DecisionDone, type DoneProps } from "../../../_ui/question"
import { useNeedsYou, useOtherTasks, usePanel } from "../../../_ui/work-frame"
import { byTime, moveFocus, timeIn } from "./groups"
import "./list-panel.css"

type ListPanel = { open: boolean; setOpen: (o: boolean) => void }
const Ctx = createContext<ListPanel>({ open: false, setOpen: () => {} })
const OPENER = "n11-opener"

/** Part Around: the panel lives beside the card for as long as Your tasks is open, so it survives moves between cases. */
export function ListPanelAround({ children }: { children: React.ReactNode }) {
  const lab = useLab()
  const [open, setOpenRaw] = useState(lab.others)
  const { setOpen: setSide } = usePanel()
  const { rows, current, times, href } = useNeedsYou()
  const listRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => byTime(rows, times), [rows, times])

  const setOpen = (o: boolean) => {
    if (o) setSide(null) // a chat or a message open under it goes back to the situation
    setOpenRaw(o)
  }
  const value = useMemo(() => ({ open, setOpen }), [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // The case you are on stays in view, also after J / K.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" })
  }, [open, current])

  const close = () => {
    setOpenRaw(false)
    document.getElementById(OPENER)?.focus()
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <aside
        id="n11-panel"
        className={`panel lab-needs-11 n11-panel${open ? " open" : ""}`}
        aria-label="Your tasks"
        aria-hidden={!open}
        inert={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            close()
          } else moveFocus(e, listRef.current, "a.wrow")
        }}
      >
        <div className="panel-head n11-head">
          <h2 className="m strong">
            Your tasks <span className="n11-count num">{rows.length}</span>
          </h2>
          <button type="button" className="close" aria-label="Close the list" onClick={close}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="n11-list" ref={listRef}>
          {groups.map((g) => (
            <section key={g.key} className="n11-group" aria-label={g.title}>
              {groups.length > 1 && <h3 className="n11-group-head">{g.title}</h3>}
              <ul className="rows-list">
                {g.rows.map((r) => (
                  <Row key={r.caseId} r={r} here={r.caseId === current} decided={lab.decided && r.caseId === current} t={times[r.caseId]} href={href} group={g.key} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </Ctx.Provider>
  )
}

function Row({ r, here, decided, t, href, group }: { r: WorkRow; here: boolean; decided: boolean; t?: { text: string; now: boolean }; href: (id: string) => string; group: string }) {
  return (
    <li>
      <Link href={href(r.caseId)} className="wrow" aria-current={here ? "true" : undefined}>
        <span className="v">{r.vehicle}</span>
        <span className="p">{r.place}</span>
        {decided ? <span className="n11-decided">Decided</span> : t && <time className={t.now ? "now" : undefined}>{timeIn(t.text, group)}</time>}
      </Link>
    </li>
  )
}

/** Part Row: "Other tasks  36 ›", a row like Talk it through: it opens (or closes) the list panel. */
export function ListPanelRow() {
  const { rows, show } = useOtherTasks()
  const { open, setOpen } = useContext(Ctx)
  if (!show || rows.length === 0) return null
  return (
    <button
      id={OPENER}
      type="button"
      className="row-link lab-needs-11 n11-row-link"
      aria-expanded={open}
      aria-controls="n11-panel"
      onClick={() => setOpen(!open)}
    >
      <span className="m title">Other tasks</span>
      <span className="m n11-row-count num">{rows.length}</span>
      <span className="chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  )
}

/** Part Done: the decide slot's moment after a decision (today's DecisionDone), and the list opens beside it. */
export function ListPanelDone(props: DoneProps) {
  const { setOpen } = useContext(Ctx)
  const D = useLabPart("decide", "Done", DecisionDone)
  useEffect(() => setOpen(true), []) // eslint-disable-line react-hooks/exhaustive-deps
  return <D {...props} />
}
