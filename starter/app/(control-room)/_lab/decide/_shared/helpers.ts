"use client"

// Slot `decide`, shared helpers (not a variant): the recipient's words, sentence pairs for the
// translation, and the case read back after a decision (the agent's new steps, the kind's count).

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { AgentStep, Option } from "@/lib/control-room/types"
import type { Draft } from "@/lib/control-room/views"
import { useLab } from "../../context"
import { usePanel } from "../../../_ui/work-frame"

/** "Kovellin Automobilhandel, by email" -> name, how, whether it is an email. */
export function recipient(to: string) {
  const [name, ...rest] = to.split(/,\s*/)
  return { name: name.trim(), how: rest.join(", ").trim(), email: /e-?mail/i.test(to) }
}

/** The recipient's first word ("Kovellin"), for short receipts. */
export const shortName = (name: string) => name.split(/\s+/)[0] ?? name

/** The case this card is on, from the URL (/tasks/<caseId>). */
export function useCaseId(): string {
  const path = usePathname() ?? ""
  return decodeURIComponent(path.split("/")[2] ?? "")
}

/**
 * Sentences, split at . ! ? before a capital, never after a number ("26. Oktober" stays whole)
 * or inside an address ("calverona.example").
 */
export function sentences(text: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== "." && c !== "!" && c !== "?") continue
    const next = text.slice(i + 1).match(/^\s+(\S)/)
    if (!next) continue
    if (!/[A-ZÄÖÜÅ"„(]/.test(next[1])) continue
    // A German ordinal ("26. Oktober") is not a sentence end; "13:00." is.
    if (c === "." && /(^|\s)\d{1,2}$/.test(text.slice(Math.max(0, i - 4), i))) continue
    out.push(text.slice(start, i + 1).trim())
    start = i + 1
  }
  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/** German and English sentence by sentence, or null when the two do not line up. */
export function pairs(text: string, translation?: string): [string, string][] | null {
  if (!translation) return null
  const a = sentences(text)
  const b = sentences(translation)
  if (a.length !== b.length || a.length < 2) return null
  return a.map((s, i) => [s, b[i]])
}

/** The draft a done option sent, when it sent one. */
export const draftOf = (o: Option): Draft | undefined => o.draft

type Knowledge = {
  kindKey: string
  kindLabel: string
  gate: { status: "new" | "learning" | "ready" | "differ"; line: string; agreeing: number; agreeingPeople: number; needed: number }
}
type CaseBack = {
  case: { status: string; agentSteps: AgentStep[]; decideBy?: string; suggestion?: Option; alternatives?: Option[] }
  decision: { at: string; optionId: string } | null
  knowledge: Knowledge | null
  situation?: { pickup?: { place?: string }; delivery?: { place?: string } }
}

/**
 * The case read back from the API once decided: where the pickup is, the agent's steps after the
 * decision (its carry-out), and the kind's gate. `saved` is false in the lab's ?decided=1 photo
 * state, where nothing was posted.
 */
export function useCaseBack(caseId: string, poll = false) {
  const [data, setData] = useState<CaseBack | null>(null)
  useEffect(() => {
    if (!caseId) return
    let alive = true
    let n = 0
    const load = () =>
      fetch(`/api/cr/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return
          setData(d)
          // The carry-out may still be running: look again a few times until the case is done.
          if (poll && d.decision && d.case?.status !== "done" && n++ < 6) setTimeout(load, 1500)
        })
        .catch(() => {})
    load()
    return () => {
      alive = false
    }
  }, [caseId, poll])
  const saved = !!data?.decision
  const steps = data ? afterSteps(data.case.agentSteps ?? []) : []
  return {
    loaded: !!data,
    saved,
    place: data?.situation?.pickup?.place,
    steps: saved ? steps : [],
    done: data?.case.status === "done",
    count: data?.knowledge ? countOf(data.knowledge, saved) : null,
    /** The option the decision chose (or the suggestion, before one). */
    option: data ? ([data.case.suggestion, ...(data.case.alternatives ?? [])].find((o) => o?.id === data.decision?.optionId) ?? data.case.suggestion) : undefined,
  }
}

/** The agent's steps after the person's decision: everything after its last "propose" step. */
function afterSteps(steps: AgentStep[]): AgentStep[] {
  let at = -1
  steps.forEach((s, i) => s.kind === "propose" && (at = i))
  return steps.slice(at + 1)
}

/**
 * Where the kind stands after this decision. In the lab's photo state (nothing saved) this decision
 * is counted in by hand, the way the gate would count it. "New kind of case" becomes "1 of 16".
 */
export function countOf(k: Knowledge, saved: boolean) {
  const g = k.gate
  const kind = k.kindLabel
  if (g.status === "differ") return { kind, before: g.line, line: g.line, differ: true, first: false }
  if (g.status === "ready") return { kind, before: g.line, line: g.line, differ: false, first: false }
  if (!saved) {
    if (g.status === "new") return { kind, before: "New kind of case", line: `1 of ${g.needed}`, differ: false, first: true }
    return { kind, before: `${g.agreeing} of ${g.needed}`, line: `${g.agreeing + 1} of ${g.needed}`, differ: false, first: false }
  }
  const first = g.agreeing <= 1
  return { kind, before: first ? "New kind of case" : `${g.agreeing - 1} of ${g.needed}`, line: `${g.agreeing} of ${g.needed}`, differ: false, first }
}

/** "Seller hold on the car" -> "seller holds on the car" is wrong; keep the label, lower its first letter. */
export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

/** The lab's ?decided=1 (nothing saved) or a real decision. */
export function useLabDecided() {
  return useLab().decided
}

/** The planned follow-up, from the option's effect: the sentences about what the agent does. */
export function agentPlan(o: Option): string[] {
  return sentences(o.effect)
    .filter((s) => !/^A person sends/i.test(s))
    .map((s) => s.replace(/^After a yes,\s*/i, ""))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}

export type { DoneProps } from "../../../_ui/question"
export type PreviewProps = {
  draft: Draft
  subject?: string
  verb: string // "Send the email"
  pending: boolean
  error: string | null
  onSend: (editedText?: string) => void
  returnFocus: () => void
}

/** Return goes to the default button (Apple: the default button answers Return) without moving focus. */
export function useDefaultKey(go: () => void, on = true) {
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && el !== document.body && el.closest("a, button, input, textarea, select, summary, [contenteditable], dialog")) return
      e.preventDefault()
      go()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
}

/**
 * A panel the moment after a decision keeps open (02's sent email, 08's receipt) goes through the
 * shared panel state like every other panel: it asks for the "email" place one frame after it mounts
 * (so it is the newest request, after a needs variant that opens its list on the same decision), shows
 * only while it holds that place, and gives it up for good once anything else takes it (Talk it
 * through, the list, Escape). Closing it hands the panel back (`setOpen(null)`: the situation, or the
 * list that stepped aside).
 */
export function useAfterPanel(want: boolean, gone: () => void) {
  const { open, setOpen } = usePanel()
  const held = useRef(false)
  useEffect(() => {
    if (!want) return
    const id = requestAnimationFrame(() => setOpen("email"))
    return () => cancelAnimationFrame(id)
  }, [want, setOpen])
  useEffect(() => {
    if (!want) return
    if (open === "email") held.current = true
    else if (held.current) {
      held.current = false
      gone()
    }
  }, [open, want]) // eslint-disable-line react-hooks/exhaustive-deps
  return { shown: want && open === "email", close: () => setOpen(null) }
}
