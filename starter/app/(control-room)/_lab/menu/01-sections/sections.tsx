"use client"

// menu 01: two groups. The person's own work on top (Overview, Your tasks, History), then the
// room's records under a small grey header, "Operations" (Bahn's word: the Operations board).
import "./sections.css"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, type ShellProps } from "../kit/kit"

const MINE = ["/", "/tasks", "/history"]

export function SectionsShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  const mine = SECTIONS.filter((s) => MINE.includes(s.href))
  const ops = SECTIONS.filter((s) => !MINE.includes(s.href))
  return (
    <Frame
      root="lab-menu-01"
      here={here}
      side={
        <>
          <Lockup />
          <nav className="nav" aria-label="Your work">
            {mine.map((s) => (
              <NavRow key={s.href} s={s} here={here} needYou={needYou} />
            ))}
          </nav>
          <p className="lm01-head" id="lm01-ops">
            Operations
          </p>
          <nav className="nav" aria-labelledby="lm01-ops">
            {ops.map((s) => (
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
