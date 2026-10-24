"use client"

// needs 14: two modes, as Stripe Radar's review queue has them: a list view to scan and a detailed
// view to decide. "Other tasks ›" turns the card column into the whole queue, one count line on top
// (the ops exception queue's counts, said as a sentence), a quiet table grouped by time, the case
// you were on highlighted. A row opens its card; Escape or "Back" returns to the card you left. One
// button starts with the most urgent (Queues' "Start review").

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLab } from "../../context"
import { Icon } from "../../../_ui/icons"
import { useNeedsYou, useOtherTasks, usePanel } from "../../../_ui/work-frame"
import { byTime, moveFocus } from "./groups"
import "./queue-overview.css"

type Mode = { list: boolean; setList: (on: boolean) => void }
const Ctx = createContext<Mode>({ list: false, setList: () => {} })
const OPENER = "n14-opener"

/** Part Around: holds the mode for as long as Your tasks is open, and draws the list view in the card's place. */
export function QueueOverviewAround({ children }: { children: React.ReactNode }) {
  const lab = useLab()
  const [list, setList] = useState(lab.others)
  const { reset } = usePanel()
  const { rows, current, times, href } = useNeedsYou()
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const was = useRef(list)
  const groups = useMemo(() => byTime(rows, times), [rows, times])
  const here = rows.find((r) => r.caseId === current)
  const soon = rows.filter((r) => times[r.caseId]?.now).length
  const first = rows.find((r) => r.caseId !== current || !lab.decided)

  // The list takes the whole width; back on the card, the situation returns beside it.
  useEffect(() => {
    if (list) reset(null)
    else if (was.current) reset("situation")
    was.current = list
  }, [list, reset])

  // A move to another case (a row, J / K) shows that case's card.
  const at = useRef(current)
  useEffect(() => {
    if (at.current !== current) setList(false)
    at.current = current
  }, [current])

  // The case you came from is in view and has focus, so the arrows start there.
  useEffect(() => {
    if (!list) return
    const el = box.current?.querySelector<HTMLElement>('a[aria-current="true"]') ?? box.current?.querySelector<HTMLElement>("a.n14-row")
    el?.scrollIntoView({ block: "nearest" })
    el?.focus({ preventScroll: true })
  }, [list])

  const back = () => {
    setList(false)
    requestAnimationFrame(() => document.getElementById(OPENER)?.focus())
  }
  const value = useMemo(() => ({ list, setList }), [list])

  return (
    <Ctx.Provider value={value}>
      <div className={`lab-needs-14 n14${list ? " is-list" : ""}`}>
        {children}
        {list && (
          <section
            className="n14-view"
            aria-label="Your tasks"
            ref={box}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                back()
              } else moveFocus(e, box.current, "a.n14-row")
            }}
          >
            <div className="n14-inner">
              <header className="n14-top">
                <div>
                  <h1 className="n14-title">Your tasks</h1>
                  <p className="n14-sum">
                    {rows.length} {rows.length === 1 ? "task needs" : "tasks need"} you.{soon > 0 ? ` ${soon} within the hour.` : ""}
                  </p>
                </div>
                <div className="n14-actions">
                  {here && (
                    <button type="button" className="btn btn-plain n14-back" onClick={back} aria-keyshortcuts="Escape">
                      <Icon name="chevron-left" size={18} />
                      Back to the {here.vehicle}
                    </button>
                  )}
                  {first && (
                    <button type="button" className="btn btn-primary n14-start" onClick={() => (first.caseId === current ? back() : router.push(href(first.caseId)))}>
                      Start with the most urgent
                    </button>
                  )}
                </div>
              </header>
              <div className="n14-cols" aria-hidden="true">
                <span>Car</span>
                <span>Pickup place</span>
                <span>Decide by</span>
              </div>
              {groups.map((g) => (
                <section key={g.key} className="n14-group" aria-label={g.title}>
                  <h2 className="n14-group-head">
                    {g.title} <span className="num">{g.rows.length}</span>
                  </h2>
                  <ul className="n14-rows">
                    {g.rows.map((r) => {
                      const t = times[r.caseId]
                      const mine = r.caseId === current
                      return (
                        <li key={r.caseId}>
                          <Link href={href(r.caseId)} className="n14-row" aria-current={mine ? "true" : undefined} onClick={() => mine && back()}>
                            <span className="n14-car">{r.vehicle}</span>
                            <span className="n14-place">{r.place}</span>
                            {mine && lab.decided ? (
                              <span className="n14-time">Decided</span>
                            ) : (
                              <time className={t?.now ? "n14-time n14-now" : "n14-time"}>{t?.text ?? "No set time"}</time>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        )}
      </div>
    </Ctx.Provider>
  )
}

/** Part Row: "Other tasks  36 ›" switches the column to the list view. */
export function QueueOverviewRow() {
  const { rows, show } = useOtherTasks()
  const { setList } = useContext(Ctx)
  if (!show || rows.length === 0) return null
  return (
    <button id={OPENER} type="button" className="row-link lab-needs-14 n14-row-link" onClick={() => setList(true)}>
      <span className="m title">Other tasks</span>
      <span className="m n14-count num">{rows.length}</span>
      <span className="chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  )
}
