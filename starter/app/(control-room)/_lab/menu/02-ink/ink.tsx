"use client"

// menu 02: the open section as an asphalt pill with birch type, Bahn's black button. Structure as today; the idea is all in ink.css.
import "./ink.css"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, type ShellProps } from "../kit/kit"

export function InkShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  return (
    <Frame
      root="lab-menu-02"
      here={here}
      side={
        <>
          <Lockup />
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
