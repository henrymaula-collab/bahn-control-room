"use client"

// menu 05: hover or focus Your tasks and your tasks fly out beside the menu (Cushion's "Switch to"),
// the first seven, then "All N tasks". The menu itself stays two levels at most (Apple HIG
// Sidebars). Arrow keys move in the list, Escape closes it.
import "./flyout.css"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Icon } from "../../../_ui/icons"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { useMenuNeeds } from "../../context"
import { PAD_ORDER_PREFIX } from "../../slots"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, type ShellProps } from "../kit/kit"

const SHOW = 7

export function FlyoutShell({ person, people, needYou, children }: ShellProps) {
  const { here, path } = useHere()
  const { rows, times } = useMenuNeeds()
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fly = useRef<HTMLDivElement>(null)
  useEffect(() => setOpen(false), [path])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const later = (v: boolean, ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(v), ms)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      return
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowRight") return
    const links = [...(fly.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])]
    if (!links.length) return
    e.preventDefault()
    setOpen(true)
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    const next = e.key === "ArrowUp" ? (i <= 0 ? links.length - 1 : i - 1) : (i + 1) % links.length
    links[next]?.focus()
  }
  return (
    <Frame
      root="lab-menu-05"
      here={here}
      side={
        <>
          <Lockup />
          <nav className="nav">
            {SECTIONS.map((s) =>
              s.href === "/tasks" ? (
                <div
                  key={s.href}
                  className="lm05-wrap"
                  onMouseEnter={() => later(true, 120)}
                  onMouseLeave={() => later(false, 220)}
                  onFocus={() => later(true, 0)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) later(false, 0)
                  }}
                  onKeyDown={onKey}
                >
                  <NavRow s={s} here={here} needYou={needYou} />
                  {open && rows.length > 0 && (
                    <div ref={fly} className="lm05-fly" aria-label="Your tasks">
                      <ul>
                        {rows.slice(0, SHOW).map((r) => {
                          const t = times[r.caseId]
                          // ?many= pads with red orders that have no case: those open the order page, as in Your tasks.
                          const href = r.caseId.startsWith(PAD_ORDER_PREFIX) ? `/orders/${encodeURIComponent(r.orderId)}` : `/tasks/${r.caseId}`
                          return (
                            <li key={r.caseId}>
                              <Link href={href} className="lm05-row" aria-current={path === `/tasks/${r.caseId}` ? "page" : undefined}>
                                <span className="lm05-v">{r.vehicle}</span>
                                <span className="lm05-p">{r.place}</span>
                                {t && <time className={`lm05-t num${t.now ? " now" : ""}`}>{t.text}</time>}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                      {rows.length > SHOW && (
                        <Link href="/tasks" className="lm05-all">
                          <span>All {rows.length} tasks</span>
                          <Icon name="chevron-right" size={16} />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <NavRow key={s.href} s={s} here={here} needYou={needYou} />
              ),
            )}
          </nav>
          <NeedsMenu />
          <div className="side-foot">
            <PersonSwitcher current={person} people={people} />
          </div>
        </>
      }
    >
      {children}
    </Frame>
  )
}
