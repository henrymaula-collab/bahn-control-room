"use client"

// menu 07: the person block also says who is on shift with you: their faces in a row, one tap to
// Team. The signed-in person stays as today (photo, name, the job title in italic) and still
// opens the switch.
import "./on-shift.css"
import Link from "next/link"
import { Icon } from "../../../_ui/icons"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, useKeep, type ShellProps } from "../kit/kit"

const FACES = 5

export function OnShiftShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  const keep = useKeep()
  const others = people.filter((p) => p.id !== person.id)
  const names = others.map((p) => p.name.split(" ")[0])
  return (
    <Frame
      root="lab-menu-07"
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
            {others.length > 0 && (
              <Link href={keep("/team")} className="lm07-shift" aria-label={`On shift with you: ${names.join(", ")}. Open Team.`}>
                <span className="lm07-l">On shift with you</span>
                <span className="lm07-row">
                  <span className="lm07-faces">
                    {others.slice(0, FACES).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} className="avatar lm07-face" src={p.avatar} alt="" width={28} height={28} title={`${p.name}, ${p.desk}`} />
                    ))}
                    {others.length > FACES && <span className="lm07-more num">+{others.length - FACES}</span>}
                  </span>
                  <Icon name="chevron-right" size={16} />
                </span>
              </Link>
            )}
            <PersonSwitcher current={person} people={people} />
          </div>
        </>
      }
    >
      {children}
    </Frame>
  )
}
