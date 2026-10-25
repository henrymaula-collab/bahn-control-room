"use client"

import { useSyncExternalStore } from "react"
import { languageName } from "@/lib/control-room/format"

// The short send window (lab decide:08): Send does not decide at once. For a few seconds the panel says
// "Sending" with Undo; at zero the window calls the one decision path it was given (the card's own
// save through the email sheet, or the decide action from the chat, which the card's save also calls),
// then the receipt says it went. The window lives outside React, so it keeps counting while the panel
// changes underneath it. One window at a time; a new one replaces an old one only after it has sent.

export const SEND_WINDOW_S = 5

export type SendOrigin = "chat" | "card"
export type SendInfo = {
  caseId: string
  origin: SendOrigin
  /** "Kovellin Automobilhandel" and "by email", from the draft's To. */
  to: string
  how: string
  noun: "email" | "message"
  language: string
  subject?: string
  /** What the agent does once it is decided, one or two sentences. */
  next?: string
  /** The pickup place the agent calls back once it is decided. */
  calls?: string
}
export type SendWin = SendInfo & {
  phase: "wait" | "saving" | "sent" | "failed"
  left: number
  paused: boolean
  at?: string
  receipt: boolean
}

let state: SendWin | null = null
let commit: (() => Promise<string | undefined> | string | undefined | void) | null = null
let restore: (() => void) | null = null
let timer: ReturnType<typeof setInterval> | null = null
let last = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (next: SendWin | null) => {
  state = next
  emit()
}

const stop = () => {
  if (timer) clearInterval(timer)
  timer = null
}

const hhmm = () =>
  new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Helsinki",
  })

async function fire() {
  stop()
  if (!state || state.phase !== "wait") return
  const run = commit
  commit = null
  restore = null
  set({ ...state, phase: "saving", left: 0 })
  try {
    const at = run ? await run() : undefined
    if (state)
      set({
        ...state,
        phase: "sent",
        at: typeof at === "string" ? at : hhmm(),
        receipt: state.origin === "chat",
      })
  } catch {
    if (state) set({ ...state, phase: "failed" })
  }
}

/** Opens the window. `send` is the decision itself; `undo` gives the email back to whoever opened it. */
export function startSend(info: SendInfo, send: () => Promise<string | undefined> | string | undefined | void, undo?: () => void) {
  if (state && (state.phase === "wait" || state.phase === "saving")) return
  stop()
  commit = send
  restore = undo ?? null
  set({
    ...info,
    phase: "wait",
    left: SEND_WINDOW_S,
    paused: false,
    receipt: false,
  })
  last = Date.now()
  timer = setInterval(() => {
    const now = Date.now()
    const dt = (now - last) / 1000
    last = now
    if (!state || state.phase !== "wait" || state.paused) return
    const left = state.left - dt
    if (left <= 0) void fire()
    else set({ ...state, left })
  }, 100)
}

/** Undo inside the window: nothing was decided, the email comes back. */
export function undoSend() {
  if (!state || state.phase !== "wait") return
  stop()
  const back = restore
  commit = null
  restore = null
  set(null)
  back?.()
}

/** Held while the pointer or focus rests on Undo (Polaris: never take an action away under the cursor). */
export function pauseSend(paused: boolean) {
  if (state && state.phase === "wait" && state.paused !== paused) set({ ...state, paused })
}

/** Send now, without waiting out the window (the tab is closing, or the person moved on). */
export function sendNow() {
  if (state?.phase === "wait") void fire()
}

/** The receipt's close, or the decision failed and the card says so: forget the window. */
export function clearSend(caseId?: string) {
  if (!state || (caseId && state.caseId !== caseId)) return
  if (state.phase === "wait" || state.phase === "saving") return
  set(null)
}

/** The decision did not save after all (the card's error): no receipt claims it went. */
export function failSend(caseId: string) {
  if (state && state.caseId === caseId && state.phase !== "wait") set({ ...state, phase: "failed", receipt: false })
}

export function useSendWindow(caseId?: string): SendWin | null {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => null,
  )
  return s && (!caseId || s.caseId === caseId) ? s : null
}

// The sheet opened from the chat's "See the email": its Send ends in the chat's receipt, not the card's view alone.
// It carries what the chat knows and the sheet does not: what the agent does next, and whom it calls.
let fromChat: { caseId: string; next?: string; calls?: string } | null = null
export const openedFromChat = (caseId: string, extra: { next?: string; calls?: string }) => void (fromChat = { caseId, ...extra })
export const sheetOrigin = (caseId: string): { origin: SendOrigin; next?: string; calls?: string } =>
  fromChat?.caseId === caseId ? { origin: "chat", next: fromChat.next, calls: fromChat.calls } : { origin: "card" }
export const sheetClosed = () => void (fromChat = null)

/** "Kovellin Automobilhandel, by email" -> name, how, and whether it is an email. */
export function recipient(to: string): {
  name: string
  how: string
  noun: "email" | "message"
} {
  const [name, ...rest] = to.split(/,\s*/)
  return {
    name,
    how: rest.join(", "),
    noun: /e-?mail/i.test(to) ? "email" : "message",
  }
}

/** "The email in German to Kovellin Automobilhandel" (the language only when it is not English). */
export function sentWhat(w: Pick<SendInfo, "noun" | "language" | "to">): string {
  return `The ${w.noun}${w.language !== "en" ? ` in ${languageName(w.language)}` : ""} to ${w.to}`
}
