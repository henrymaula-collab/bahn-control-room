"use client"

// needs 08: guided, one at a time (Zendesk's Guided mode: no list, only the next ticket; skipping
// asks why). A slim line above the card says where you are in the order of decide-by times and
// offers "Skip for now", which asks why in one tap. The case goes to the end of your tasks, the next
// one opens, and the reason is for the shift lead (the agent learns why nobody wanted a kind).
// The engine has no skip yet: skips live in this browser's sessionStorage (see RATIONALE.md).

import "./skip-reason.css"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLab, useLabPart } from "../../context"
import { Icon } from "../../../_ui/icons"
import { DecisionDone, type DoneProps } from "../../../_ui/question"
import { useNeedsYou } from "../../../_ui/work-frame"

type Skip = { id: string; vehicle: string; why: string }
const KEY = "lab-needs-08-skips"
const JUST = "lab-needs-08-just"
const subs = new Set<() => void>()
let snap = ""
const useSkips = () => {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => {
      let v = ""
      try {
        v = `${sessionStorage.getItem(KEY) ?? ""}\u0000${sessionStorage.getItem(JUST) ?? ""}`
      } catch {}
      if (v !== snap) snap = v
      return snap
    },
    () => "",
  )
  const [a, b] = s.split("\u0000")
  const parse = <T,>(v: string | undefined, f: T): T => {
    try {
      return v ? (JSON.parse(v) as T) : f
    } catch {
      return f
    }
  }
  return { skips: parse<Skip[]>(a, []), just: parse<Skip | null>(b, null) }
}
const save = (k: string, v: unknown) => {
  try {
    if (v == null) sessionStorage.removeItem(k)
    else sessionStorage.setItem(k, JSON.stringify(v))
  } catch {}
  subs.forEach((f) => f())
}

const REASONS = ["Waiting for someone to call back", "Someone knows this pickup place better", "I need to read the order first"]

// The shift lead's first name, for "Kaisa sees the reason".
let leadCache: string | null = null
function useLead(): string {
  const [lead, setLead] = useState(leadCache ?? "The shift lead")
  useEffect(() => {
    if (leadCache) return
    fetch("/api/cr/people")
      .then((r) => (r.ok ? r.json() : []))
      .then((people: { name: string; role: string }[]) => {
        const p = people.find((x) => x.role === "shift_lead")
        if (p) setLead((leadCache = p.name))
      })
      .catch(() => {})
  }, [])
  return lead
}

let decided: string | null = null
const dsubs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), dsubs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (dsubs.add(f), () => void dsubs.delete(f)), () => decided, () => null)

/** Part `Top`: where you are, "Skip for now" and its reasons; on arrival, what was skipped. */
export function SkipLine() {
  const { rows, index, current, href } = useNeedsYou()
  const lab = useLab()
  const router = useRouter()
  const lead = useLead()
  const { skips, just } = useSkips()
  const done = useDecided() === current
  const [open, setOpen] = useState(lab.others)
  const [own, setOwn] = useState("")
  const [writing, setWriting] = useState(false)
  const first = useRef<HTMLButtonElement>(null)
  // Opened from the keyboard, focus goes to the first reason; a click or the lab's open state leaves it.
  const byKey = useRef(false)
  useEffect(() => setOpen(lab.others), [current, lab.others])
  useEffect(() => {
    if (open && byKey.current) requestAnimationFrame(() => first.current?.focus({ preventScroll: true }))
    byKey.current = false
  }, [open])

  const skipped = new Set(skips.map((s) => s.id))
  const row = rows[index]
  // Most urgent first, the skipped ones last (Zendesk: the next ticket you have not skipped).
  const order = [...rows.filter((r) => !skipped.has(r.caseId)), ...rows.filter((r) => skipped.has(r.caseId))]
  const at = order.findIndex((r) => r.caseId === current)
  const next = order.slice(at + 1).find((r) => r.caseId !== current) ?? order.find((r) => r.caseId !== current && !skipped.has(r.caseId))

  const skip = (why: string) => {
    if (!row) return
    const rest = skips.filter((s) => s.id !== row.caseId)
    const entry = { id: row.caseId, vehicle: row.vehicle, why }
    save(KEY, [...rest, entry])
    save(JUST, entry)
    setOpen(false)
    setWriting(false)
    setOwn("")
    if (next) router.push(href(next.caseId))
  }
  const undo = () => {
    if (!just) return
    save(KEY, skips.filter((s) => s.id !== just.id))
    save(JUST, null)
    router.push(href(just.id))
  }

  if (!rows.length) return null
  const note = just && just.id !== current ? just : null
  return (
    <div className="detail-inner lab-needs-08">
      {note && (
        <div className="lab-needs-08-note" role="status">
          <p className="s">
            {note.vehicle} went to the end of your tasks. {lead} sees why: {note.why.charAt(0).toLowerCase() + note.why.slice(1)}.
          </p>
          <button type="button" className="lab-needs-08-undo s" onClick={undo}>
            Undo
          </button>
        </div>
      )}
      <div className="lab-needs-08-line">
        <span className="s lab-needs-08-where">
          {at >= 0 ? `${at + 1} of ${order.length}` : `${order.length} left`}, the most urgent first
        </span>
        {row && !done && order.length > 1 && (
          <button type="button" className="lab-needs-08-skip" aria-expanded={open} aria-controls="lab-needs-08-why" onClick={(e) => ((byKey.current = e.detail === 0), setOpen((o) => !o))}>
            Skip for now
            <Icon name={open ? "chevron-up" : "chevron-down"} size={18} />
          </button>
        )}
      </div>
      {open && row && !done && (
        <div className="lab-needs-08-why" id="lab-needs-08-why">
          <p className="m lab-needs-08-ask">Why skip the {row.vehicle}?</p>
          <p className="s lab-needs-08-says">
            Tap a reason. It goes to the end of your tasks{next ? ` and ${next.vehicle} opens` : ""}; {lead} sees the reason.
          </p>
          <div className="lab-needs-08-reasons">
            {REASONS.map((r, i) => (
              <button key={r} ref={i === 0 ? first : undefined} type="button" className="lab-needs-08-reason" onClick={() => skip(r)}>
                {r}
              </button>
            ))}
            {!writing ? (
              <button type="button" className="lab-needs-08-reason other" onClick={() => setWriting(true)}>
                Something else
              </button>
            ) : (
              <form
                className="lab-needs-08-own"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (own.trim()) skip(own.trim())
                }}
              >
                <input className="text-input" autoFocus value={own} onChange={(e) => setOwn(e.target.value)} placeholder="One sentence is enough" aria-label="Why, in your own words" />
                <button type="submit" className="btn btn-primary" disabled={!own.trim()}>
                  Skip
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Part `Done`: the decide slot's moment after (its own way on); the line above drops Skip. */
export function SkipDone(props: DoneProps) {
  const { current } = useNeedsYou()
  const Base = useLabPart("decide", "Done", DecisionDone)
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  return <Base {...props} />
}

/** Part `Row`: guided mode shows no list of the others under the card. */
export function NoList() {
  return null
}
