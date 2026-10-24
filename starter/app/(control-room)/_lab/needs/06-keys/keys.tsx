"use client"

// needs 06: the queue by keyboard (Linear Triage's single keys, Raycast's Enter for the primary
// action, a palette's key legend). A quiet line pinned at the foot of the card column teaches the
// four keys that matter; ? opens every key in one sheet. J and K already walk Needs you (work-frame).

import "./keys.css"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLab, useLabPart } from "../../context"
import { DecisionDone, type DoneProps } from "../../../_ui/question"
import { useNeedsYou, usePanel } from "../../../_ui/work-frame"

// Whether the card shows its decided state (then the black-button key opens the next case).
let decided: string | null = null
const subs = new Set<() => void>()
const setDecided = (id: string | null) => ((decided = id), subs.forEach((f) => f()))
const useDecided = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => decided, () => null)

const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable], dialog")
const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const click = (selector: string) => {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return false
  el.click()
  el.focus({ preventScroll: false })
  return true
}

type Flash = string | null

/** Part `Row`: the key line at the foot, the keys themselves, and the sheet behind "?". */
export function KeysRow() {
  const { next, prev, current } = useNeedsYou()
  const panel = usePanel()
  const lab = useLab()
  const done = useDecided() === current
  const [sheet, setSheet] = useState(lab.others)
  const [flash, setFlash] = useState<Flash>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [cmd, setCmd] = useState("Ctrl")
  useEffect(() => setCmd(mac() ? "⌘" : "Ctrl"), [])
  // The black button's own words ("Send the email"), so the key line says what the key does.
  const [answer, setAnswer] = useState("")
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnswer(document.querySelector(".work .question .answers .btn-primary")?.textContent?.trim() ?? ""))
    return () => cancelAnimationFrame(id)
  }, [current, done])

  const lit = (k: string) => {
    setFlash(k)
    window.setTimeout(() => setFlash((f) => (f === k ? null : f)), 320)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const k = e.key.toLowerCase()
      // Cmd/Ctrl + Enter: the black button (or, once decided, the way on). Primer: the primary action.
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (click(".work .question .answers .btn")) lit("enter")
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "?") {
        e.preventDefault()
        setSheet((s) => !s)
        return
      }
      if (k === "j" && next) lit("j")
      if (k === "k" && prev) lit("k")
      if (k === "o" && click(".work .question .answers .btn-plain")) {
        e.preventDefault()
        lit("o")
      }
      if (k === "t" && click('.work .work-rows button.row-link[aria-controls="chat"]')) {
        e.preventDefault()
        lit("t")
      }
      if (k === "w") {
        const why = document.querySelector<HTMLDetailsElement>(".work .work-rows details.row:not(.others)")
        if (why) {
          e.preventDefault()
          why.open = !why.open
          why.querySelector("summary")?.focus()
          lit("w")
        }
      }
      if (k === "s") {
        e.preventDefault()
        panel.setOpen(null) // back to the case's default panel, the situation
        lit("s")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, panel])

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (sheet && !d.open) d.showModal()
    if (!sheet && d.open) d.close()
  }, [sheet])

  const primary = done ? "Next case" : answer || "The suggestion"
  return (
    <>
      <div className="lab-needs-06" role="note" aria-label="Keys">
        <span className={`lab-needs-06-k${flash === "j" ? " lit" : ""}${next ? "" : " off"}`}>
          <kbd>J</kbd> Next
        </span>
        <span className={`lab-needs-06-k${flash === "k" ? " lit" : ""}${prev ? "" : " off"}`}>
          <kbd>K</kbd> Previous
        </span>
        <span className={`lab-needs-06-k${flash === "enter" ? " lit" : ""}`}>
          <kbd>{cmd} ↩</kbd> {primary}
        </span>
        <button type="button" className={`lab-needs-06-k lab-needs-06-all${sheet ? " lit" : ""}`} onClick={() => setSheet(true)} aria-haspopup="dialog">
          <kbd>?</kbd> All keys
        </button>
      </div>
      <dialog
        ref={dialog}
        className="lab-needs-06-sheet"
        aria-label="Keys in Your tasks"
        onClose={() => setSheet(false)}
        onClick={(e) => e.target === dialog.current && setSheet(false)}
      >
        <div className="lab-needs-06-head">
          <h2 className="m">Keys in Your tasks</h2>
          <button type="button" className="btn btn-plain btn-small" onClick={() => setSheet(false)}>
            Done
          </button>
        </div>
        <p className="s lab-needs-06-group">Move through your tasks</p>
        <dl className="lab-needs-06-list">
          <div><dt>J</dt><dd>Next task{next ? `, ${next.vehicle}` : ""}</dd></div>
          <div><dt>K</dt><dd>Previous task{prev ? `, ${prev.vehicle}` : ""}</dd></div>
        </dl>
        <p className="s lab-needs-06-group">Decide</p>
        <dl className="lab-needs-06-list">
          <div><dt>{cmd} ↩</dt><dd>{done ? "Next case" : answer ? `${answer}, the agent's suggestion` : "The agent's suggestion"}</dd></div>
          <div><dt>O</dt><dd>Other options</dd></div>
        </dl>
        <p className="s lab-needs-06-group">Look closer</p>
        <dl className="lab-needs-06-list">
          <div><dt>T</dt><dd>Talk it through</dd></div>
          <div><dt>W</dt><dd>Why it came to you</dd></div>
          <div><dt>S</dt><dd>The situation</dd></div>
          <div><dt>Esc</dt><dd>Close the conversation or the message</dd></div>
        </dl>
        <p className="s lab-needs-06-foot">Keys rest while you type in a field.</p>
      </dialog>
    </>
  )
}

/** Part `Done`: the decide slot's moment after; the key line then names the way on. */
export function KeysDone(props: DoneProps) {
  const { current } = useNeedsYou()
  const Base = useLabPart("decide", "Done", DecisionDone)
  useEffect(() => (setDecided(current), () => setDecided(null)), [current])
  return <Base {...props} />
}
