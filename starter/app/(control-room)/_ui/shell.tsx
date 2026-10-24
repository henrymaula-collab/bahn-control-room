"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon, type IconName } from "./icons"
import { BahnLogo } from "./logo"
import { archivoItalic } from "./shell-fonts"
import { useLabExtra, useLabPart } from "../_lab/context"
import { PersonSwitcher } from "./person-switcher"

type P = { id: string; name: string; desk: string; avatar: string }

export const SECTIONS: { href: string; label: string; icon: IconName | "history" }[] = [
  { href: "/", label: "Overview", icon: "map" },
  { href: "/tasks", label: "Your tasks", icon: "inbox" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/orders", label: "Orders", icon: "car" },
  { href: "/agents", label: "Agents", icon: "headset" },
  { href: "/know-how", label: "Know-how", icon: "book-open" },
  { href: "/team", label: "Team", icon: "users" },
]

export const sectionOf = (path: string) =>
  SECTIONS.find((s) => (s.href === "/" ? path === "/" : path === s.href || path.startsWith(`${s.href}/`))) ?? SECTIONS[0]

/** One fixed frame: the side menu, a slim header with the page name, the page. It never moves between sections. */
/** Props of the frame (slot `menu`, part `Shell`). */
export type ShellProps = { person: P; people: P[]; needYou: number; children: React.ReactNode }

export function Shell({ person, people, needYou, children }: ShellProps) {
  const path = usePathname() ?? "/"
  const here = sectionOf(path)
  return (
    <div className={`shell ${archivoItalic.variable}`}>
      <aside className="side" aria-label="Control room">
        <Link href="/" className="brand" aria-label="Bahn control room, overview">
          <BahnLogo />
          {/* A lockup like Aalto's "Founder Sprint": the brand, then the product set in under its end. */}
          <span className="brand-sub">
            <span className="brand-sub-1">Control</span> <span className="brand-sub-2">room</span>
          </span>
        </Link>
        <nav className="nav">
          {/* Your tasks keeps only its count (Henry, 24 Oct 21:45: nested rows "don't work when you
              have many"); the other tasks open from the card's "Other tasks" row (work-case.tsx). */}
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} aria-current={s === here ? "page" : undefined}>
              {s.icon === "history" ? <HistoryIcon /> : <Icon name={s.icon} size={16} />}
              <span>{s.label}</span>
              {s.href === "/tasks" && needYou > 0 && (
                <span className="count num" aria-label={`${needYou} need you`}>
                  {needYou}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <NeedsMenu />
        <div className="side-foot">
          <PersonSwitcher current={person} people={people} />
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <span className="top-title">{here.label}</span>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}

/** The needs slot's place in the side menu, under the sections (empty today). Menu variants render it too. */
export function NeedsMenu() {
  const Menu = useLabExtra("needs", "Menu")
  return Menu ? <Menu /> : null
}

/** History: lucide "history" (ISC), a clock turning back, at the menu's 1.75 stroke. */
export function HistoryIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}
