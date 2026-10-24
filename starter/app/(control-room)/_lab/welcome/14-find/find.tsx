"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import type { MapCar } from "@/lib/control-room/types-v3"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, useBoth, useFit, useKeep, when } from "../shared"
import "./find.css"

const STATE: Record<string, { word: string; dot: string; rank: number }> = {
  needs_person: { word: "Needs a person", dot: "dot-red", rank: 0 },
  agent_working: { word: "Agent working", dot: "dot-agent", rank: 1 },
}
const state = (c: MapCar) => STATE[c.state] ?? { word: "On plan", dot: "dot-green", rank: 2 }

/** Every car on the road today, read once, for the find field (the same read the Overview makes). */
function useCars(): MapCar[] {
  const [cars, setCars] = useState<MapCar[]>([])
  useEffect(() => {
    const person = /(?:^|;\s*)cr-person=([^;]+)/.exec(document.cookie)?.[1] ?? "aino"
    fetch(`/api/cr/overview?person=${encodeURIComponent(person)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.cars && setCars(d.cars))
      .catch(() => {})
  }, [])
  return cars
}

function search(cars: MapCar[], q: string): MapCar[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits = cars.filter((c) => {
    const hay = `${c.vehicle} ${c.reference} ${c.from} ${c.to}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const head = (c: MapCar) => (c.reference.toLowerCase() === q.toLowerCase() ? 0 : c.vehicle.toLowerCase().startsWith(words[0]) ? 1 : 2)
  return hits.sort((a, b) => head(a) - head(b) || state(a).rank - state(b).rank).slice(0, 4)
}

/** Attio's greeting over one field: find any car, place or CD number; her tasks are the suggestions. */
export function Find({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const router = useRouter()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const input = useRef<HTMLInputElement>(null)
  const cars = useCars()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => search(cars, q), [cars, q])
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const hrefOf = (c: MapCar) => keep(c.caseId ? `/tasks/${c.caseId}` : `/orders/${encodeURIComponent(c.orderId)}`)

  // Cmd/Ctrl+K or "/" from anywhere on the Overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]")
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  useEffect(() => setActive(0), [q])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)))
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
    else if (e.key === "Enter" && results[active]) router.push(hrefOf(results[active]))
    else if (e.key === "Escape") (setQ(""), input.current?.blur())
  }

  return (
    <section ref={ref} className="lab-welcome lab-welcome-14 lw-panel" aria-label="Today">
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      <label className="field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find a car, pickup place or CD number"
          aria-label="Find a car, pickup place or CD number"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="lw14-results"
          aria-activedescendant={results[active] ? `lw14-${results[active].orderId}` : undefined}
        />
        {q ? (
          <button type="button" className="clear" onClick={() => (setQ(""), input.current?.focus())} aria-label="Clear">
            <Icon name="x" size={16} />
          </button>
        ) : (
          <kbd>⌘K</kbd>
        )}
      </label>

      {q ? (
        <ul id="lw14-results" className="results" role="listbox">
          {results.length === 0 && <li className="none">No car today matches “{q}”.</li>}
          {results.map((c, i) => (
            <li key={c.orderId} id={`lw14-${c.orderId}`} role="option" aria-selected={i === active}>
              <Link href={hrefOf(c)} className={`hit${i === active ? " on" : ""}`} onMouseEnter={() => (setActive(i), setLift(c.orderId))} onMouseLeave={() => setLift(null)}>
                <span className="v">
                  {c.vehicle} <span className="ref">{c.reference}</span>
                </span>
                <span className="p">{c.from === c.to ? c.from : `${c.from} to ${c.to}`}</span>
                <span className="st">
                  <span className={`dot ${state(c).dot}`} />
                  {state(c).word}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : tasks.length ? (
        <>
          <Link href={keep("/tasks")} className="yours">
            <span>Your tasks</span>
            <span className="c">{n(tasks.length)}</span>
            <Icon name="chevron-right" size={16} />
          </Link>
          <ul className="lw-rows">
            {shown.map((r) => (
              <li key={r.caseId}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="lw-v">{r.vehicle}</span>
                  <span className="lw-p">{r.place}</span>
                  {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
                </Link>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <Link href={keep("/tasks")} className="lw-row lw-more">
                  <span>{n(rest)} more</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="calm">Nothing needs you right now.</p>
      )}

      <Key counts={counts} />
    </section>
  )
}
