"use client"

// menu 08: the open section as a raised birch row on the grey frame (Arc), the same material as the page. Structure as today; the idea is all in raised.css.
import "./raised.css"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, type ShellProps } from "../kit/kit"

export function RaisedShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  return (
    <Frame
      root="lab-menu-08"
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
