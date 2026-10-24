"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon, type IconName } from "./icons"
import { BahnLogo } from "./logo"
import { archivoItalic } from "./shell-fonts"
import { PersonSwitcher } from "./person-switcher"

type P = { id: string; name: string; desk: string; avatar: string }

const SECTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Overview", icon: "map" },
  { href: "/tasks", label: "Your tasks", icon: "inbox" },
  { href: "/orders", label: "Orders", icon: "car" },
  { href: "/agents", label: "Agents", icon: "headset" },
  { href: "/know-how", label: "Know-how", icon: "book-open" },
  { href: "/team", label: "Team", icon: "users" },
]

const sectionOf = (path: string) =>
  SECTIONS.find((s) => (s.href === "/" ? path === "/" : path === s.href || path.startsWith(`${s.href}/`))) ?? SECTIONS[0]

/** One fixed frame: the side menu, a slim header with the page name, the page. It never moves between sections. */
export function Shell({ person, people, needYou, children }: { person: P; people: P[]; needYou: number; children: React.ReactNode }) {
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
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} aria-current={s === here ? "page" : undefined}>
              <Icon name={s.icon} size={16} />
              <span>{s.label}</span>
              {s.href === "/tasks" && needYou > 0 && (
                <span className="count num" aria-label={`${needYou} need you`}>
                  {needYou}
                </span>
              )}
            </Link>
          ))}
        </nav>
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
