"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { dayKey, when } from "@/lib/control-room/format"
import type { HistoryRow, HistoryView as View } from "@/lib/control-room/history"

export type HistoryState = {
  q: string
  range: string // all | today | yesterday | 7 | 30
  kind: string // all | <kindKey>
  who: string // me | all | agent | <personId> (a shift lead's filter)
  sort: string // when | car | kind | decision | by
  dir: "asc" | "desc"
  open: string | null // the case whose record is open
}

const RANGES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
]

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** Whole days from `now` to `iso` on the room's calendar (Helsinki): 0 today, -1 yesterday. */
function dayDiff(iso: string, now: string): number {
  return Math.round((Date.parse(`${dayKey(iso)}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86_400_000)
}

/** Finder's date groups: Today, Yesterday, Previous 7 days, Previous 30 days, then months. */
function groupOf(iso: string, now: string): { key: string; label: string; order: number } {
  const d = dayDiff(iso, now)
  if (d >= 0) return { key: "today", label: "Today", order: 0 }
  if (d === -1) return { key: "yesterday", label: "Yesterday", order: 1 }
  if (d >= -7) return { key: "week", label: "Previous 7 days", order: 2 }
  if (d >= -30) return { key: "month", label: "Previous 30 days", order: 3 }
  const [y, m] = dayKey(iso).split("-").map(Number) as [number, number]
  const [nowY] = dayKey(now).split("-").map(Number) as [number]
  return { key: `m-${y}-${m}`, label: y === nowY ? MONTHS[m - 1]! : String(y), order: 4 + (nowY - y) * 12 + (12 - m) }
}

function inRange(iso: string, now: string, range: string): boolean {
  const d = dayDiff(iso, now)
  if (range === "today") return d >= 0
  if (range === "yesterday") return d === -1
  if (range === "7") return d >= -7
  if (range === "30") return d >= -30
  return true
}

/** Search without case or accents: "seinajoki" finds Seinäjoki. */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function Chevron({ dir }: { dir: "asc" | "desc" | "right" }) {
  const d = dir === "asc" ? "m6 15 6-6 6 6" : dir === "desc" ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6"
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function Close() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function HistoryView({ view, initial }: { view: View; initial: HistoryState }) {
  const lead = view.person.role === "shift_lead"
  const [state, setState] = useState<HistoryState>({ ...initial, who: lead ? initial.who : "me" })
  const set = (patch: Partial<HistoryState>) => setState((s) => ({ ...s, ...patch }))
  const listRef = useRef<HTMLDivElement>(null)
  const now = view.asOf
  const me = view.person.id

  // Keep the filters in the address, so a reload or a shared link shows the same list.
  useEffect(() => {
    const p = new URLSearchParams()
    if (state.q) p.set("q", state.q)
    if (state.range !== "all") p.set("range", state.range)
    if (state.kind !== "all") p.set("kind", state.kind)
    if (lead && state.who !== "me") p.set("who", state.who)
    if (state.sort !== "when") p.set("sort", state.sort)
    if (state.dir !== "desc") p.set("dir", state.dir)
    if (state.open) p.set("open", state.open)
    const next = `${window.location.pathname}${p.size ? `?${p}` : ""}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next)
  }, [state, lead])

  const byWho = useMemo(
    () => view.rows.filter((row) => (state.who === "all" ? true : state.who === "me" ? row.by.id === me : row.by.id === state.who)),
    [view.rows, state.who, me],
  )
  const kinds = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of byWho) seen.set(row.kindKey, row.kindLabel)
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]))
  }, [byWho])

  const rows = useMemo(() => {
    const words = fold(state.q.trim()).split(/\s+/).filter(Boolean)
    return byWho.filter((row) => {
      if (state.kind !== "all" && row.kindKey !== state.kind) return false
      if (!inRange(row.shownAt, now, state.range)) return false
      if (!words.length) return true
      const hay = fold([row.car, row.place, row.reference, row.kindLabel, row.decision, row.reason ?? "", row.by.name, row.headline].join(" "))
      return words.every((word) => hay.includes(word))
    })
  }, [byWho, state.kind, state.range, state.q, now])

  const whoName = (row: HistoryRow) => (row.by.id === me ? "You" : row.by.name)

  const groups = useMemo(() => {
    const sign = state.dir === "asc" ? 1 : -1
    const key = (row: HistoryRow) =>
      state.sort === "car" ? `${row.car} ${row.place}` : state.sort === "kind" ? row.kindLabel : state.sort === "decision" ? row.decision : state.sort === "by" ? whoName(row) : row.shownAt
    const sorted = [...rows].sort((a, b) => sign * key(a).localeCompare(key(b)) || b.shownAt.localeCompare(a.shownAt))
    const out = new Map<string, { key: string; label: string; order: number; rows: HistoryRow[] }>()
    for (const row of sorted) {
      const g = groupOf(row.shownAt, now)
      if (!out.has(g.key)) out.set(g.key, { ...g, rows: [] })
      out.get(g.key)!.rows.push(row)
    }
    // Groups run newest first; sorting by When ascending turns them around, as in Finder.
    const flip = state.sort === "when" && state.dir === "asc" ? -1 : 1
    return [...out.values()].sort((a, b) => flip * (a.order - b.order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, state.sort, state.dir, now, me])

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups])
  const open = state.open ? view.rows.find((row) => row.caseId === state.open) ?? null : null

  const sortBy = (key: string) =>
    set(state.sort === key ? { dir: state.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: key === "when" ? "desc" : "asc" })

  // Arrow keys move through the list, Escape closes the record (Finder's keys).
  function onKey(event: React.KeyboardEvent) {
    if (event.key === "Escape" && state.open) { set({ open: null }); return }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    if ((event.target as HTMLElement).tagName === "INPUT" || (event.target as HTMLElement).tagName === "SELECT") return
    event.preventDefault()
    const index = flat.findIndex((row) => row.caseId === state.open)
    const next = flat[Math.max(0, Math.min(flat.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]
    if (!next) return
    set({ open: next.caseId })
    listRef.current?.querySelector<HTMLElement>(`[data-case="${CSS.escape(next.caseId)}"]`)?.focus()
  }

  const columns: { key: string; label: string }[] = [
    { key: "car", label: "Car" },
    { key: "kind", label: "Kind of case" },
    { key: "decision", label: "Decision" },
    { key: "by", label: "Decided by" },
    { key: "when", label: "When" },
  ]

  const total = rows.length
  return (
    <section className={`hist${open ? " with-record" : ""}`} onKeyDown={onKey}>
      <div className="hist-main" ref={listRef}>
        <header className="hist-head">
          <h1 className="hist-title">History</h1>
          <label className="hist-search">
            <SearchIcon />
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search" value={state.q} onChange={(e) => set({ q: e.target.value })} />
          </label>
        </header>

        <div className="hist-filters">
          <div className="hist-range" role="group" aria-label="Time">
            {RANGES.map((r) => (
              <button key={r.key} type="button" aria-pressed={state.range === r.key} onClick={() => set({ range: r.key })}>
                {r.label}
              </button>
            ))}
          </div>
          <label className="hist-select">
            <span className="sr-only">Kind of case</span>
            <select value={state.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="all">All kinds of case</option>
              {kinds.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Chevron dir="desc" />
          </label>
          {lead && (
            <label className="hist-select">
              <span className="sr-only">Decided by</span>
              <select value={state.who} onChange={(e) => set({ who: e.target.value, kind: "all" })}>
                <option value="me">You</option>
                <option value="all">Everyone</option>
                {view.people.filter((p) => p.id !== me).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="agent">Agent</option>
              </select>
              <Chevron dir="desc" />
            </label>
          )}
          <span className="hist-total num">{total === 1 ? "1 case" : `${total} cases`}</span>
        </div>

        <div className="hist-table" role="table" aria-label="Finished cases">
          <div className="hist-cols" role="row">
            {columns.map((c) => (
              <button key={c.key} type="button" role="columnheader" className={`hist-col col-${c.key}`} onClick={() => sortBy(c.key)}
                aria-sort={state.sort === c.key ? (state.dir === "asc" ? "ascending" : "descending") : "none"}>
                {c.label}
                {state.sort === c.key && <Chevron dir={state.dir} />}
              </button>
            ))}
          </div>
          {groups.length === 0 && <p className="hist-empty">{view.rows.length ? "Nothing matches." : "Nothing finished yet."}</p>}
          {groups.map((g) => (
            <div key={g.key} role="rowgroup" className="hist-group">
              <h2 className="hist-group-name">
                {g.label} <span className="num">{g.rows.length}</span>
              </h2>
              {g.rows.map((row) => (
                <button key={row.caseId} type="button" role="row" data-case={row.caseId}
                  className="hist-row" aria-selected={row.caseId === state.open}
                  onClick={() => set({ open: row.caseId === state.open ? null : row.caseId })}>
                  <span role="cell" className="col-car">
                    <span className="hist-car">{row.car}</span>
                    <span className="hist-sub">{row.place}</span>
                  </span>
                  <span role="cell" className="col-kind">{row.kindLabel}</span>
                  <span role="cell" className="col-decision" title={row.decision}>{row.decision}</span>
                  <span role="cell" className="col-by">{whoName(row)}</span>
                  <span role="cell" className="col-when num">{when(row.shownAt, now)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {open && <Record row={open} now={now} me={me} lead={lead} onClose={() => set({ open: null })} />}
    </section>
  )
}

function Record({ row, now, me, lead, onClose }: { row: HistoryRow; now: string; me: string; lead: boolean; onClose: () => void }) {
  const mine = row.by.id === me
  const agent = row.by.id === "agent"
  const weight = row.weight
    ? row.weight.value >= 1 ? "Full" : `${row.weight.value.toFixed(2)}: ${row.weight.held} of ${mine ? "your" : `${row.by.name}'s`} ${row.weight.decided} earlier decisions on this kind stood`
    : null
  const via = row.chat?.via === "voice" ? "By voice" : row.chat?.via === "mixed" ? "By voice and text" : "In text"
  return (
    <aside className="hist-record" aria-label={`${row.car}, the record`}>
      <div className="hist-record-head">
        <div>
          <h2 className="hist-record-car">{row.car}</h2>
          <p className="hist-sub">{[row.reference, row.place].filter(Boolean).join(", ")}</p>
        </div>
        <button type="button" className="hist-close" onClick={onClose} aria-label="Close the record">
          <Close />
        </button>
      </div>

      <p className="hist-headline">{row.headline}</p>

      <dl className="hist-kv">
        <dt>Decided</dt>
        <dd className="strong">{row.decision}</dd>
        {row.suggested && (
          <>
            <dt>The agent suggested</dt>
            <dd>{row.suggested}</dd>
          </>
        )}
        {!agent && (
          <>
            <dt>Reason</dt>
            <dd>{row.reason ? `“${row.reason}”` : <span className="hist-quiet">No reason given</span>}</dd>
          </>
        )}
        <dt>Decided by</dt>
        <dd>{agent ? "Agent, under a trust rule" : mine ? "You" : row.by.name}</dd>
        <dt>When</dt>
        <dd className="num">
          {when(row.shownAt, now)}
          {dayDiff(row.shownAt, now) === 0 ? ", today" : ""}
          {row.minutes ? <span className="hist-quiet">, {row.minutes} min after it came in</span> : null}
        </dd>
        <dt>Kind of case</dt>
        <dd>{row.kindLabel}</dd>
        {agent && row.rule ? (
          <>
            <dt>Trust rule</dt>
            <dd>
              {row.rule.when}, {row.rule.then}.
              <span className="hist-quiet"> {row.rule.evidence}{row.rule.turnedOnBy ? `, turned on by ${row.rule.turnedOnBy}` : ""}.</span>
            </dd>
          </>
        ) : (
          <>
            <dt>Toward a trust rule</dt>
            <dd>
              {row.counted}
              {row.countedNow && <span className="hist-quiet">, now {row.countedNow}</span>}
            </dd>
            {weight && (
              <>
                <dt>Weight</dt>
                <dd>{weight}</dd>
              </>
            )}
          </>
        )}
      </dl>

      {row.chat && (row.chat.lines?.length || row.chat.summary) ? (
        <div className="hist-chat">
          <h3 className="hist-chat-name">
            Talked it through <span className="hist-quiet">{via.toLowerCase()}</span>
          </h3>
          {row.chat.lines?.length ? (
            <ul>
              {row.chat.lines.map((line, i) => (
                <li key={i}>
                  <span className="hist-quiet">{line.who === "person" ? (mine ? "You" : row.by.name) : "Agent"}</span>
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{row.chat.summary}</p>
          )}
        </div>
      ) : null}

      {row.live && !agent && (
        <Link href={`/tasks/${encodeURIComponent(row.caseId)}`} className="hist-open">
          Open in Your tasks <Chevron dir="right" />
        </Link>
      )}
    </aside>
  )
}
