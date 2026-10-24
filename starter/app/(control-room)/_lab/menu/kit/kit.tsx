"use client"

// Menu slot kit: the pieces every menu variant shares, so each variant is only its own idea.
// The frame keeps today's classes (.shell .side .main .top .page .brand .nav .side-foot), so every
// page lays out exactly as today and the shell.css sizes (--side, --cr-su, the lockup) still apply;
// each variant restyles under its own root class.

import "./kit.css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "../../../_ui/icons"
import { BahnLogo } from "../../../_ui/logo"
import { archivoItalic } from "../../../_ui/shell-fonts"
import { HistoryIcon, NeedsMenu, SECTIONS, sectionOf, type ShellProps } from "../../../_ui/shell"
import { useLab } from "../../context"

export type Section = (typeof SECTIONS)[number]
export { NeedsMenu, SECTIONS, type ShellProps }

/** A link that keeps the lab's own params (?v=, many, rule), so a menu variant survives its own clicks
 *  (RV6: the rows dropped ?v=, and one click in the menu put today's menu back). Built from useLab(), so
 *  the frame needs no useSearchParams and no Suspense boundary. */
export function useKeep() {
  const lab = useLab()
  const q = new URLSearchParams()
  const v = Object.entries(lab.v).map(([slot, nn]) => `${slot}:${nn}`).join(",")
  if (v) q.set("v", v)
  if (lab.many) q.set("many", String(lab.many))
  if (lab.rule && !lab.v.rule) q.set("rule", "1")
  const s = q.toString().replace(/%3A/g, ":").replace(/%2C/g, ",")
  return (path: string) => (s ? `${path}?${s}` : path)
}

export function useHere() {
  const path = usePathname() ?? "/"
  return { path, here: sectionOf(path) }
}

/** Today's lockup: the Bahn wordmark, "Control room" set in under its end. */
export function Lockup({ children }: { children?: React.ReactNode }) {
  const keep = useKeep()
  return (
    <Link href={keep("/")} className="brand" aria-label="Bahn control room, overview">
      <BahnLogo />
      <span className="brand-sub">
        <span className="brand-sub-1">Control</span> <span className="brand-sub-2">room</span>
      </span>
      {children}
    </Link>
  )
}

/** Bahn's mark alone (the first path of the logo), for the collapsed rail. */
export function BahnMark() {
  return (
    <svg className="lm-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23.77 24" fill="currentColor" role="img" aria-label="Bahn">
      <path d="M15.0639 0C18.1124 0 20.5837 2.47173 20.5837 5.52025C20.5836 8.56867 18.1123 11.0401 15.0639 11.0401H5.52439C5.05539 11.0401 4.67519 11.4203 4.67519 11.8893C4.6753 12.3582 5.05546 12.7385 5.52439 12.7385H18.2484C21.2969 12.7385 23.7682 15.2098 23.7682 18.2583C23.7681 21.3068 21.2968 23.7782 18.2484 23.7782H0V19.1075H18.2484C18.7173 19.1075 19.0975 18.7272 19.0976 18.2583C19.0976 17.7893 18.7174 17.4091 18.2484 17.4091H5.52439C2.47594 17.4091 0.00467321 14.9377 0.00456116 11.8893C0.00456116 8.84077 2.47588 6.36945 5.52439 6.36945H15.0639C15.5328 6.36945 15.9129 5.98916 15.9131 5.52025C15.9131 5.05125 15.5329 4.67104 15.0639 4.67104H0.00124395V0H15.0639Z" />
    </svg>
  )
}

export function SectionIcon({ s }: { s: Section }) {
  return s.icon === "history" ? <HistoryIcon /> : <Icon name={s.icon} size={16} />
}

/** One menu row, as today: icon, name, and the count on Your tasks. */
export function NavRow({ s, here, needYou, after, title }: { s: Section; here: Section; needYou: number; after?: React.ReactNode; title?: string }) {
  const keep = useKeep()
  return (
    <Link href={keep(s.href)} aria-current={s === here ? "page" : undefined} data-label={s.label} title={title}>
      <SectionIcon s={s} />
      <span className="lm-l">{s.label}</span>
      {s.href === "/tasks" && needYou > 0 && (
        <span className="count num" aria-label={`${needYou} need you`}>
          {needYou}
        </span>
      )}
      {after}
    </Link>
  )
}

/** The frame around every page: the side menu, the header with the page name, the page. */
export function Frame({ root, here, side, children, attrs }: { root: string; here: Section; side: React.ReactNode; children: React.ReactNode; attrs?: Record<string, string> }) {
  return (
    <div className={`shell ${archivoItalic.variable} lab-menu-kit ${root}`} {...attrs}>
      <aside className="side" aria-label="Control room">
        {side}
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
