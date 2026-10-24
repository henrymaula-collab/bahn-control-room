"use client"

// needs 13: Other tasks bundled by pickup place (HEY Bundles: "no matter how many emails they send
// you, they'll only take up a single row"; Lightfield groups tasks by company). The cars waiting at
// the place you are on come first, "Also at Calverona", because one call to the branch can settle
// them together. Every other place with several cars is one row that opens, in deadline order, so
// the most urgent stays on top. Private addresses are not one place and never bundle.

import Link from "next/link"
import { useEffect, useRef } from "react"
import type { WorkRow } from "@/lib/control-room/types-v3"
import { useLab } from "../../context"
import { Icon } from "../../../_ui/icons"
import { useNeedsYou, useOtherTasks } from "../../../_ui/work-frame"
import { moveFocus, type RowTimes } from "./groups"
import "./place-bundles.css"

const NOT_A_PLACE = /^(private|third-party|customer-supplied)/i

/** Scroll the card column just enough to show the opened list, never past its own row. */
function reveal(el: HTMLElement | null, smooth: boolean) {
  const box = el?.closest<HTMLElement>(".detail")
  if (!el || !box) return
  requestAnimationFrame(() => {
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const by = Math.min(r.top - b.top - 16, r.bottom - b.bottom + 24)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (by > 0) box.scrollBy({ top: by, behavior: smooth && !still ? "smooth" : "auto" })
  })
}

type Entry = { kind: "row"; row: WorkRow } | { kind: "bundle"; place: string; rows: WorkRow[] }

/** Deadline order kept: a place with several cars takes the spot of its most urgent car. */
function bundle(rows: WorkRow[]): Entry[] {
  const count = new Map<string, number>()
  for (const r of rows) if (!NOT_A_PLACE.test(r.place)) count.set(r.place, (count.get(r.place) ?? 0) + 1)
  const out: Entry[] = []
  const seen = new Map<string, Entry & { kind: "bundle" }>()
  for (const r of rows) {
    if ((count.get(r.place) ?? 0) < 2) out.push({ kind: "row", row: r })
    else if (seen.has(r.place)) seen.get(r.place)!.rows.push(r)
    else {
      const b = { kind: "bundle" as const, place: r.place, rows: [r] }
      seen.set(r.place, b)
      out.push(b)
    }
  }
  return out
}

function Time({ r, times }: { r: WorkRow; times: RowTimes }) {
  const t = times[r.caseId]
  return t ? <time className={t.now ? "now" : undefined}>{t.text}</time> : <span />
}

export function PlaceBundles() {
  const { rows, times, href, show } = useOtherTasks()
  const { rows: all, index } = useNeedsYou()
  const lab = useLab()
  const ref = useRef<HTMLDetailsElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lab.others) reveal(ref.current, false)
  }, [lab.others])

  if (!show || rows.length === 0) return null
  const here = index >= 0 ? all[index]?.place : undefined
  const same = here && !NOT_A_PLACE.test(here) ? rows.filter((r) => r.place === here) : []
  const rest = bundle(rows.filter((r) => !same.includes(r)))
  const few = rows.length <= 5 // a handful: the bundles open, so the cars show too

  return (
    <details ref={ref} className="row others lab-needs-13" open={lab.others || undefined} onToggle={(e) => e.currentTarget.open && reveal(e.currentTarget, true)}>
      <summary>
        <span className="m title">Other tasks</span>
        <span className="m count num">{rows.length}</span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </summary>
      <div className="body n13-body" ref={list} onKeyDown={(e) => moveFocus(e, list.current, "a.n13-row, summary")}>
        {same.length > 0 && (
          <section aria-label={`Also at ${here}`}>
            <h3 className="n13-head">Also at {here}</h3>
            <ul className="n13-list">
              {same.map((r) => (
                <li key={r.caseId}>
                  <Link href={href(r.caseId)} className="n13-row">
                    <span className="n13-car">{r.vehicle}</span>
                    <span />
                    <Time r={r} times={times} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-label="By pickup place">
          {same.length > 0 && <h3 className="n13-head">Other pickup places</h3>}
          <ul className="n13-list">
            {rest.map((e) =>
              e.kind === "row" ? (
                <li key={e.row.caseId}>
                  <Link href={href(e.row.caseId)} className="n13-row">
                    <span className="n13-car">{e.row.vehicle}</span>
                    <span className="n13-place">{e.row.place}</span>
                    <Time r={e.row} times={times} />
                  </Link>
                </li>
              ) : (
                <li key={`place-${e.place}`}>
                  <details className="n13-bundle" open={few || undefined} onToggle={(ev) => ev.currentTarget.open && reveal(ev.currentTarget, true)}>
                    <summary>
                      <span className="n13-car">{e.place}</span>
                      <span className="n13-place">{e.rows.length} cars</span>
                      <Time r={e.rows[0]} times={times} />
                      <span className="n13-chev">
                        <Icon name="chevron-right" size={18} />
                      </span>
                    </summary>
                    <ul className="n13-list n13-inner">
                      {e.rows.map((r) => (
                        <li key={r.caseId}>
                          <Link href={href(r.caseId)} className="n13-row">
                            <span className="n13-car">{r.vehicle}</span>
                            <span />
                            <Time r={r} times={times} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
    </details>
  )
}
