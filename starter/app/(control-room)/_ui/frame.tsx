import Link from "next/link"
import { clock, day, deskTitle } from "@/lib/control-room/format"
import type { OpsPerson } from "@/lib/control-room/types"
import { BahnLogo } from "./logo"
import { PersonSwitcher } from "./person-switcher"

/** The quiet top bar of Bahn's portal: logo left, page title centred, the person on shift right. */
export function Frame({
  title,
  person,
  people,
  asOf,
  active,
  children,
}: {
  title: string
  person: OpsPerson
  people: OpsPerson[]
  asOf?: string
  active?: "desk" | "lead"
  children: React.ReactNode
}) {
  const isLead = person.role === "shift_lead"
  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link href={isLead ? "/lead" : "/"} className="logo" aria-label="Control room home">
            <BahnLogo />
          </Link>
          {isLead && (
            <nav className="segmented" aria-label="Views">
              <Link href="/lead" aria-current={active === "lead" ? "page" : undefined}>Shift lead</Link>
              <Link href="/" aria-current={active === "desk" ? "page" : undefined}>Your desk</Link>
            </nav>
          )}
        </div>
        <div className="topbar-center">
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="topbar-right">
          {asOf && (
            <span className="room-clock">
              <time dateTime={asOf}>{day(asOf)}, {clock(asOf)}</time>
            </span>
          )}
          <PersonSwitcher
            current={{ id: person.id, name: person.name, desk: deskTitle(person.desks[0]) }}
            people={people.filter((p) => p.onShift).map((p) => ({ id: p.id, name: p.name, desk: deskTitle(p.desks[0]), lead: p.role === "shift_lead" }))}
          />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  )
}
