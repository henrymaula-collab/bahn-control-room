"use client"

// Slot `decide`, shared by its variants (not a variant itself): the send window.
//
// Send does not post at once. It opens a 10 s window (Polaris: a toast with an action stays at
// least 10 s; Gmail's Undo Send runs 5 to 30 s), paused while the pointer or focus is on the undo.
// Undo (the button, Z, or Cmd/Ctrl+Z) cancels it and gives the email back. At zero the window calls
// the card's own onSend, so the decision, the agent's carry-out and History run exactly as today.
// The window lives outside React, so it keeps counting when the person moves to the next case
// (variant 06) and still sends; closing the tab sends at once (best effort, pagehide).
//
// Lab photo states (read by the variants, never posting): ?send=wait (inside the window, frozen at
// 7 s) and ?send=sent (the window has passed, the agent is at work). See useSendView.

import { useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"

export const WINDOW_S = 10

export type SendPhase = "wait" | "sent"
export type SendState = {
  caseId: string
  to: string // "Kovellin Automobilhandel"
  how: string // "by email"
  email: boolean
  seconds: number
  left: number // seconds left, fractional
  paused: boolean
  phase: SendPhase
  at?: string // "12:04" once sent
  frozen?: boolean // a lab photo state: nothing posts
  back?: string // where Undo goes when the person has moved on (variant 06)
}

let state: SendState | null = null
let commit: (() => void) | null = null
let restore: (() => void) | null = null
let timer: ReturnType<typeof setInterval> | null = null
let clearer: ReturnType<typeof setTimeout> | null = null
let last = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f))

const hhmm = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (!!el.closest("input, textarea, select, [contenteditable]") || el.isContentEditable)
}

function onKey(e: KeyboardEvent) {
  if (!state || state.phase !== "wait" || typing(e.target)) return
  const z = e.key === "z" || e.key === "Z"
  if (z && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    undoSend()
  }
}
function onHide() {
  if (state?.phase === "wait") fire()
}
function listen(on: boolean) {
  if (typeof window === "undefined") return
  if (on) {
    window.addEventListener("keydown", onKey)
    window.addEventListener("pagehide", onHide)
  } else {
    window.removeEventListener("keydown", onKey)
    window.removeEventListener("pagehide", onHide)
  }
}

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  listen(false)
}

function fire() {
  if (!state || state.phase !== "wait") return
  stop()
  state = { ...state, phase: "sent", left: 0, at: hhmm() }
  const c = commit
  commit = null
  restore = null
  emit()
  c?.()
  // The receipt stays readable for a while after the card has moved on, then the window forgets it.
  if (clearer) clearTimeout(clearer)
  clearer = setTimeout(() => {
    state = null
    emit()
  }, 12_000)
}

/** Opens the window. `send` is the card's onSend (bound to the edited text); `undo` gives the email back. */
export function startSend(
  s: { caseId: string; to: string; how: string; email: boolean; seconds?: number; back?: string },
  send: () => void,
  undo?: () => void,
) {
  if (state?.phase === "wait") fire() // one window at a time: the earlier one goes now
  if (clearer) clearTimeout(clearer)
  const seconds = s.seconds ?? WINDOW_S
  state = { ...s, seconds, left: seconds, paused: false, phase: "wait" }
  commit = send
  restore = undo ?? null
  last = Date.now()
  listen(true)
  timer = setInterval(() => {
    const now = Date.now()
    const dt = (now - last) / 1000
    last = now
    if (!state || state.phase !== "wait" || state.paused) return
    const left = Math.max(0, state.left - dt)
    state = { ...state, left }
    emit()
    if (left <= 0) fire()
  }, 100)
  emit()
}

/** Cancels the window and gives the email back. True when there was something to undo. */
export function undoSend(): boolean {
  if (!state || state.phase !== "wait") return false
  stop()
  const r = restore
  commit = null
  restore = null
  state = null
  emit()
  r?.()
  return true
}

/** Sends now (the window's "Send now"). */
export const sendNow = () => fire()

/** Holds the count while the pointer or focus is on the undo (Polaris pauses its toast timer). */
export function pauseSend(paused: boolean) {
  if (!state || state.phase !== "wait" || state.paused === paused) return
  last = Date.now()
  state = { ...state, paused }
  emit()
}

/** The live window, whatever case it belongs to. */
export function useSendWindow(): SendState | null {
  return useSyncExternalStore(subscribe, () => state, () => null)
}

/** ?send=wait | sent: the lab's frozen photo states. */
export function useFrozen(): SendPhase | null {
  const p = useSearchParams()
  const v = p?.get("send")
  return v === "wait" || v === "sent" ? v : null
}

/** The window for this case: the live one, or the frozen lab state built from the draft's recipient. */
export function useSendView(caseId: string, who: { to: string; how: string; email: boolean }): SendState | null {
  const live = useSendWindow()
  const frozen = useFrozen()
  if (frozen) {
    return {
      caseId,
      ...who,
      seconds: WINDOW_S,
      left: frozen === "wait" ? 7 : 0,
      paused: false,
      phase: frozen,
      at: frozen === "sent" ? "12:04" : undefined,
      frozen: true,
    }
  }
  return live && live.caseId === caseId ? live : null
}
