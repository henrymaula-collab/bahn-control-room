"use client"

import Link from "next/link"
import { useState } from "react"

export interface QuietItem {
  id: string
  href: string
  headline: string
  sub: string
}

/** The lamp test: one line that proves the quiet is real, with the agent's own work one tap away. */
export function QuietLine({ lead, rest, more, items }: { lead: string; rest: string; more?: string; items: QuietItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="quiet" aria-label="Everything else">
      <p className="quiet-line">
        <strong>{lead}</strong> {rest}
      </p>
      {more && (
        <div className="quiet-more">
          <span>{more}</span>
          {items.length > 0 && (
            <button type="button" className="btn-text" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}
      {open && (
        <ul className="quiet-list">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="quiet-row">
                <span className="headline">{i.headline}</span>
                <span className="sub">{i.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
