"use client"

// menu 03: the menu collapses to an icon rail with Bahn's mark. "auto" (the default) is a rail
// under 1200 px wide, which includes Henry's Safari window at 125% (1064 px), and the full menu
// above it; the toggle pins either way and is remembered on this browser (a convenience only).
import "./rail.css"
import { useEffect, useState } from "react"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { BahnMark, Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, type ShellProps } from "../kit/kit"

type Pin = "auto" | "rail" | "full"
const KEY = "lab-menu-03-pin"
const NARROW = "(max-width: 1199px)"

export function RailShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  const [pin, setPin] = useState<Pin>("auto")
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY)
      if (v === "rail" || v === "full") setPin(v)
    } catch {}
  }, [])
  const toggle = () => {
    const railNow = pin === "rail" || (pin === "auto" && window.matchMedia(NARROW).matches)
    const next: Pin = railNow ? "full" : "rail"
    setPin(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {}
  }
  return (
    <Frame
      root="lab-menu-03"
      here={here}
      attrs={{ "data-pin": pin }}
      side={
        <>
          <div className="lm03-top">
            <Lockup>
              <BahnMark />
            </Lockup>
            <button type="button" className="lm03-toggle" onClick={toggle} aria-label="Show or hide the menu's names" title="Show or hide the menu's names">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M9 3v18" />
              </svg>
            </button>
          </div>
          <nav className="nav">
            {SECTIONS.map((s) => (
              <NavRow key={s.href} s={s} here={here} needYou={needYou} />
            ))}
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
