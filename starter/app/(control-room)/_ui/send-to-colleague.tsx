"use client"

// Send to a colleague (Henry, 25 Oct: "in case you can't handle it at all"; the AI recommends the
// person and you can write a short line why). The card's row opens this as the side panel, the
// same way Talk it through does. The agent's pick is first, with one line that is true from the
// data (lib/handoff/pick.ts); the others on the desk below it. Sending moves the case to their
// Your tasks, files it in History, opens your next case and offers Undo in the dock for 10 s.

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { Icon } from "./icons"
import { clearDockNote, showDockNote } from "./task-dock"
import { useNeedsYou, usePanel } from "./work-frame"

/** The AI's pick for "Send to a colleague": who, and one line that is true from the data. */
export type ColleaguePick = {
  personId: string
  name: string
  avatar?: string
  /** For the card row's subline, a few words: "Jonas reads German". */
  short: string
  /** The panel's line under the name: "Reads German, the language at Calverona Hamburg." */
  reason: string
}
type Colleague = ColleaguePick & { open: number }
type Colleagues = { pick: Colleague | null; others: Colleague[] }

// One read per case and person, shared by the row's subline and the panel.
const cache = new Map<string, Colleagues | "loading" | "none">()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
function load(caseId: string, personId: string, again = false) {
  const key = `${caseId}|${personId}`
  if (!again && cache.has(key)) return
  cache.set(key, "loading")
  fetch(`/api/cr/handoff?case=${encodeURIComponent(caseId)}&person=${encodeURIComponent(personId)}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: Colleagues | null) => cache.set(key, d && (d.pick || d.others.length) ? d : "none"))
    .catch(() => cache.set(key, "none"))
    .finally(emit)
}
function useColleagues(caseId: string, personId: string): Colleagues | null {
  const key = `${caseId}|${personId}`
  const v = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => cache.get(key),
    () => undefined,
  )
  useEffect(() => load(caseId, personId), [caseId, personId])
  return v && v !== "loading" && v !== "none" ? v : null
}

/** The card row's subline: the recommended colleague for this case, null while it loads or when nobody fits. */
export function useColleaguePick(caseId: string, personId: string): ColleaguePick | null {
  return useColleagues(caseId, personId)?.pick ?? null
}

/**
 * Mount once in the card's rows. It renders nothing until the frame's panel is "colleague"
 * (usePanel().setOpen("colleague")), then shows the panel in the side slot.
 */
export function SendToColleague({ caseId, personId }: { caseId: string; personId: string }) {
  const { open, slot } = usePanel()
  if (!slot) return null
  return createPortal(<Panel key={caseId} caseId={caseId} personId={personId} shown={open === "colleague"} />, slot)
}

function Panel({ caseId, personId, shown }: { caseId: string; personId: string; shown: boolean }) {
  const { setOpen } = usePanel()
  const { rows, next, href } = useNeedsYou()
  const router = useRouter()
  const data = useColleagues(caseId, personId)
  const all = data ? [...(data.pick ? [data.pick] : []), ...data.others] : []
  const [chosen, setChosen] = useState<string | null>(null)
  const [line, setLine] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = useRef<HTMLButtonElement>(null)
  const who = all.find((c) => c.personId === chosen) ?? all[0]
  const vehicle = rows.find((r) => r.caseId === caseId)?.vehicle

  useEffect(() => {
    if (shown) (load(caseId, personId, true), close.current?.focus({ preventScroll: true }))
    else setError(null)
  }, [shown, caseId, personId])

  const send = async () => {
    if (!who || pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/cr/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, from: personId, to: who.personId, note: line.trim() || undefined }),
      })
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(e?.error ?? "It did not go through. Try again.")
      }
      const back = href(caseId)
      showDockNote(`${vehicle ?? "The case"} sent to ${who.name}`, async () => {
        const r = await fetch("/api/cr/handoff", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, personId }) })
        cache.clear()
        if (r.ok) router.push(back)
        router.refresh()
      })
      cache.clear()
      setOpen(null)
      router.push(next ? href(next.caseId) : "/tasks")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "It did not go through. Try again.")
      clearDockNote()
    } finally {
      setPending(false)
    }
  }

  return (
    <aside id="colleague" className={`panel colleague-panel${shown ? " open" : ""}`} aria-label="Send to a colleague" aria-hidden={!shown} inert={!shown}>
      <div className="panel-head">
        <h2 className="m strong">Send to a colleague</h2>
        <button ref={close} type="button" className="close" aria-label="Close" onClick={() => setOpen(null)}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="s colleague-lede">It leaves your tasks and opens in theirs.</p>

      {!data ? (
        <p className="s colleague-lede">Finding who can take it…</p>
      ) : (
        <div className="colleague-list" role="radiogroup" aria-label="Colleague">
          {all.map((c, i) => {
            const on = c.personId === who?.personId
            return (
              <div key={c.personId} style={{ display: "contents" }}>
                {i === 0 && data.pick && <p className="s colleague-label">The agent suggests</p>}
                {i === (data.pick ? 1 : 0) && data.others.length > 0 && <p className="s colleague-label">Also on the desk</p>}
                <button type="button" role="radio" aria-checked={on} className="colleague-row" onClick={() => setChosen(c.personId)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.avatar ? <img className="avatar" src={c.avatar} alt="" width={40} height={40} /> : <span className="avatar" />}
                  <span className="colleague-text">
                    <span className="m">{c.name}</span>
                    <span className="s">{c.reason}</span>
                  </span>
                  <span className="colleague-tick">{on && <Icon name="check" size={18} />}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {who && (
        <div className="colleague-send">
          <label className="s colleague-label" htmlFor="colleague-line">
            Add a line for {who.name}
          </label>
          <textarea
            id="colleague-line"
            className="colleague-line m"
            rows={2}
            maxLength={280}
            placeholder="Optional"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), void send())}
          />
          <button type="button" className="btn btn-primary colleague-go" disabled={pending} onClick={() => void send()}>
            {pending ? "Sending…" : `Send to ${who.name}`}
          </button>
          {error && (
            <p className="s colleague-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
