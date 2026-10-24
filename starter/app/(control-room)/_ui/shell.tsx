"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Fragment, Suspense } from "react"
import { Icon, type IconName } from "./icons"
import { BahnLogo } from "./logo"
import { archivoItalic } from "./shell-fonts"
import { PersonSwitcher } from "./person-switcher"

type P = { id: string; name: string; desk: string; avatar: string }
/** One case that needs the person, as the side menu nests it under Your tasks. */
export type NavTask = { caseId: string; vehicle: string; place: string; time?: { text: string; now: boolean } }

const SECTIONS: { href: string; label: string; icon: IconName | "history" }[] = [
  { href: "/", label: "Overview", icon: "map" },
  { href: "/tasks", label: "Your tasks", icon: "inbox" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/orders", label: "Orders", icon: "car" },
  { href: "/agents", label: "Agents", icon: "headset" },
  { href: "/know-how", label: "Know-how", icon: "book-open" },
  { href: "/team", label: "Team", icon: "users" },
]

const sectionOf = (path: string) =>
  SECTIONS.find((s) => (s.href === "/" ? path === "/" : path === s.href || path.startsWith(`${s.href}/`))) ?? SECTIONS[0]

/** One fixed frame: the side menu, a slim header with the page name, the page. It never moves between sections. */
export function Shell({ person, people, needYou, tasks = [], children }: { person: P; people: P[]; needYou: number; tasks?: NavTask[]; children: React.ReactNode }) {
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
            <Fragment key={s.href}>
              <Link href={s.href} aria-current={s === here ? "page" : undefined}>
                {s.icon === "history" ? <HistoryIcon /> : <Icon name={s.icon} size={16} />}
                <span>{s.label}</span>
                {s.href === "/tasks" && needYou > 0 && (
                  <span className="count num" aria-label={`${needYou} need you`}>
                    {needYou}
                  </span>
                )}
              </Link>
              {/* useSearchParams needs its own Suspense boundary; nothing shows until it resolves. */}
              {s.href === "/tasks" && tasks.length > 0 && (
                <Suspense fallback={null}>
                  <NestedTasks tasks={tasks} path={path} />
                </Suspense>
              )}
            </Fragment>
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


/** Henry, 24 Oct 20:40: the person's tasks nested under Your tasks, like mailboxes in Mail.
 *  Only while Your tasks is open (the Overview's welcome panel already lists them), and not
 *  in R2's two alternatives (?tasks=switcher, ?tasks=column), which show the list themselves. */
function NestedTasks({ tasks, path }: { tasks: NavTask[]; path: string }) {
  const view = useSearchParams()?.get("tasks")
  if (!path.startsWith("/tasks") || view === "switcher" || view === "column") return null
  const shown = tasks.slice(0, MAX_NESTED)
  return (
    <ul className="nav-sub" aria-label="Your tasks">
      {shown.map((t) => (
        <li key={t.caseId}>
          <Link href={`/tasks/${t.caseId}`} className="nav-task" aria-current={path === `/tasks/${t.caseId}` ? "page" : undefined}>
            <span className="v">{t.vehicle}</span>
            <span className="p">{t.place}</span>
            {t.time && <time className={t.time.now ? "now" : undefined}>{t.time.text}</time>}
          </Link>
        </li>
      ))}
      {tasks.length > shown.length && (
        <li>
          <Link href="/tasks" className="nav-task nav-more">
            <span className="p">{tasks.length - shown.length} more</span>
          </Link>
        </li>
      )}
    </ul>
  )
}
const MAX_NESTED = 6

/** History: lucide "history" (ISC), a clock turning back, at the menu's 1.75 stroke. */
function HistoryIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}
