"use client"

// menu 04: Your tasks says how many and when the next one is due: "BMW M4 by 12:30", the time red
// within the hour (the same rule as everywhere else). One line, never a list: the tasks themselves
// live in Your tasks.
import "./next-due.css"
import Link from "next/link"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { useMenuNeeds } from "../../context"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, SectionIcon, useHere, type ShellProps } from "../kit/kit"

export function NextDueShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  const { rows, times } = useMenuNeeds()
  const next = rows.find((r) => times[r.caseId]) ?? rows[0]
  const t = next ? times[next.caseId] : undefined
  return (
    <Frame
      root="lab-menu-04"
      here={here}
      side={
        <>
          <Lockup />
          <nav className="nav">
            {SECTIONS.map((s) =>
              s.href === "/tasks" && next ? (
                <Link key={s.href} href={s.href} aria-current={s === here ? "page" : undefined} className="lm04-tasks">
                  <SectionIcon s={s} />
                  <span className="lm04-two">
                    <span className="lm-l">{s.label}</span>
                    <span className="lm04-next">
                      {next.vehicle}
                      {t && (
                        <>
                          {" by "}
                          <time className={t.now ? "now" : undefined}>{t.text}</time>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="count num" aria-label={`${needYou} need you`}>
                    {needYou}
                  </span>
                </Link>
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
