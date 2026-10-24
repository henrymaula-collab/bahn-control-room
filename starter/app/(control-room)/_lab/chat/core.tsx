"use client"

// Shared logic for every `chat` variant: a copy of today's CaseChat state (_ui/case-chat.tsx), so the
// variants differ in structure and interaction, never in behaviour. Asking streams the answer over
// SSE (POST /api/cr/cases/:id/chat); the agent's offer is the case's own option, and the yes goes
// the same way as the card's button (the decide action), with the conversation's summary as the reason.
// Lab states: ?chat=thread|thinking|offer (fixtures, CD-420458), ?chat=offer&decided=1 (the moment
// after the yes, nothing saved), ?voice=listening|speaking (a voice state held still for a shot).

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { readChatEvents } from "@/lib/control-room/chat-sse"
import { clock } from "@/lib/control-room/format"
import type { ChatAction, ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { decide } from "../../actions"
import type { SpeakInput } from "../../_ui/voice-button"
import { useLab } from "../context"
import { FIXTURE_OFFER, FIXTURE_THINKING, fixtureMessages } from "../fixtures"

export type Live = { steps: ChatToolStep[]; text: string }
export type OfferState = "open" | "saving" | "done" | "failed"
/** The agent's offer under its answer: open until the person taps, then the line of what happened. */
export type Offer = { after: string; action: ChatAction; state: OfferState; line?: string; at?: string }

/** What happens now, after the yes (the head above it already says it was decided, and when). */
const doneLine = (a: ChatAction) => a.next ?? `${a.label}.`

const chatUrl = (caseId: string) => `/api/cr/cases/${encodeURIComponent(caseId)}/chat`

const upsert = (steps: ChatToolStep[], step: ChatToolStep) =>
  steps.some((s) => s.id === step.id) ? steps.map((s) => (s.id === step.id ? step : s)) : [...steps, step]

export type ChatCore = ReturnType<typeof useChatCore>

/** Everything a variant needs: the turns, the answer on its way, the offer, send and the yes. */
export function useChatCore(thread: ChatThread | null, personId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(thread?.messages ?? [])
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<Offer | null>(null)
  const [speak, setSpeak] = useState<SpeakInput | null>(null)
  const answerId = useRef("")
  const abort = useRef<AbortController | null>(null)
  const router = useRouter()
  const lab = useLab()

  useEffect(() => setMessages(thread?.messages ?? []), [thread])
  useEffect(() => () => abort.current?.abort(), [])

  // Lab: once the thread is in, the fixture's live turn or offer (CD-420458 only). Keyed to the case
  // (dev StrictMode runs effects twice; a one-shot ref would be used up).
  const seededFor = useRef("")
  useEffect(() => {
    if (!thread || seededFor.current === thread.caseId) return
    seededFor.current = thread.caseId
    if (!fixtureMessages(thread.caseId, lab.chat)) return
    if (lab.chat === "thinking") setLive(FIXTURE_THINKING.live)
    if (lab.chat === "offer") {
      const a = FIXTURE_OFFER.action
      setOffer(
        lab.decided
          ? { after: FIXTURE_OFFER.answer.id, action: a, state: "done", line: doneLine(a), at: "12:04" }
          : { after: FIXTURE_OFFER.answer.id, action: a, state: "open" },
      )
    }
  }, [thread, lab.chat, lab.decided])

  const send = useCallback(
    async (raw: string, via: "text" | "voice" = "text") => {
      const text = raw.trim()
      if (!thread || !text || live) return
      setError(null)
      const mine: ChatMessage = { id: `local-${Date.now()}`, caseId: thread.caseId, role: "person", personId, text, via, at: new Date().toISOString() }
      setMessages((m) => [...m, mine])
      // A new question sets an unanswered offer aside; a decided one keeps its line.
      setOffer((o) => (o && (o.state === "open" || o.state === "failed") ? null : o))
      setLive({ steps: [], text: "" })
      const spoken = via === "voice"
      if (spoken) answerId.current = `answer-${Date.now()}`
      const ctrl = new AbortController()
      abort.current = ctrl
      try {
        const res = await fetch(chatUrl(thread.caseId), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ person: personId, text, via }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) throw new Error(`POST chat ${res.status}`)
        let done = false
        let action: ChatAction | undefined
        for await (const ev of readChatEvents(res.body)) {
          if (ev.type === "tool") setLive((l) => l && { ...l, steps: upsert(l.steps, ev.step) })
          else if (ev.type === "action") action = ev.action
          else if (ev.type === "delta") {
            setLive((l) => l && { ...l, text: l.text + ev.text })
            if (spoken) setSpeak((sp) => ({ id: answerId.current, text: (sp?.id === answerId.current ? sp.text : "") + ev.text }))
          } else if (ev.type === "done") {
            done = true
            setMessages((m) => [...m, ev.message])
            setLive(null)
            if (action) setOffer({ after: ev.message.id, action, state: "open" })
            if (spoken) setSpeak({ id: answerId.current, text: ev.message.text, done: true })
          } else if (ev.type === "error") throw new Error(ev.message)
        }
        if (!done) throw new Error("The answer stopped early")
      } catch {
        if (ctrl.signal.aborted) return
        setLive(null)
        setError("No answer came through. Ask again.")
      }
    },
    [thread, live, personId],
  )

  // The person's yes: the same decision path as the card's button, then the card shows it decided.
  const confirm = useCallback(async () => {
    if (!thread || !offer || offer.state === "saving" || offer.state === "done") return
    const { action } = offer
    setOffer({ ...offer, state: "saving" })
    try {
      const d = await decide({ id: `dec-${thread.caseId}-${Date.now().toString(36)}`, caseId: thread.caseId, optionId: action.optionId, why: action.summary })
      setOffer({ ...offer, state: "done", line: doneLine(action), at: clock(d.at) })
      router.refresh()
    } catch {
      setOffer({ ...offer, state: "failed" })
    }
  }, [thread, offer, router])

  const dismiss = useCallback(() => setOffer((o) => (o && o.state !== "done" && o.state !== "saving" ? null : o)), [])

  return { messages, live, error, offer, speak, send, confirm, dismiss }
}

/** The field: grows with its text up to its CSS max-height; Enter sends, Shift+Enter breaks, Escape leaves it. */
export function useField(onSend: (text: string) => void, focusWhen: boolean) {
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!draft && ref.current) ref.current.style.height = ""
  }, [draft])
  // Focus when the person opens the conversation, not when J/K brings the next case in with it open.
  const was = useRef(focusWhen)
  useEffect(() => {
    if (focusWhen && !was.current) ref.current?.focus({ preventScroll: true })
    was.current = focusWhen
  }, [focusWhen])
  const submit = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft("")
  }
  const props = {
    ref,
    value: draft,
    rows: 1,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value)
      const el = e.currentTarget
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") e.currentTarget.blur()
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        submit()
      }
    },
  }
  return { draft, setDraft, submit, props, ref }
}

/** A person's question in any variant's markup (the newest one is where reading starts). */
const ASK = ".lc-person, .lc-q, .lc-ask, .lc-tturn.is-you, .lc-entry.is-person"

/**
 * Where the log rests: the newest question at the top, its answer under it (the way chat apps
 * place a new question), so a long answer is read from its first line, not its end; a short one ends
 * at the bottom. Before any question it rests on the opener. Once the person scrolls, the log is
 * theirs until they ask again.
 */
export function useFollow(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null)
  const free = useRef(false)
  const asked = useRef(0)
  const ours = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const asks = el.querySelectorAll<HTMLElement>(ASK)
    if (asks.length > asked.current) free.current = false
    asked.current = asks.length
    if (free.current) return
    const last = asks.length ? asks[asks.length - 1] : null
    const max = el.scrollHeight - el.clientHeight
    const at = last ? last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12 : 0
    ours.current = performance.now()
    el.scrollTop = Math.max(0, Math.min(max, at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  const onScroll = () => {
    // A scroll we did not set is the person's: leave the log where they put it.
    if (performance.now() - ours.current > 150) free.current = true
  }
  return { ref, onScroll, pin: () => (free.current = false) }
}

/** ?voice=listening|speaking|transcribing: a voice state held still for a shot (no microphone). */
export function useVoiceDemo(): "listening" | "speaking" | "transcribing" | null {
  const p = useSearchParams()
  const v = p?.get("voice")
  return v === "listening" || v === "speaking" || v === "transcribing" ? v : null
}

// ---------- words ----------

/** The agent's text as lines: it writes one thought per line (a blank line starts a paragraph). */
export const linesOf = (text: string) =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

/** Sentences, cut at ". " before a capital, a digit or a quote (an email's dot stays inside). */
export function sentencesOf(text: string): string[] {
  const out: string[] = []
  for (const line of linesOf(text)) {
    const re = /[.!?]["”)]?\s+(?=[A-Z0-9"“(])/g
    let from = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      out.push(line.slice(from, m.index + m[0].trimEnd().length).trim())
      from = m.index + m[0].length
    }
    if (from < line.length) out.push(line.slice(from).trim())
  }
  return out.filter(Boolean)
}

/**
 * The opener in two lines: what is new (when the kind is new) and what the suggestion rests on.
 * Picked from the agent's own sentences, never rewritten; `rest` is everything else it said.
 */
export function shortOpener(text: string): { lead: string[]; rest: string[] } {
  const all = sentencesOf(text)
  const isNew = (s: string) => /^This has not happened before|^Nobody at Bahn|^This is new/i.test(s)
  const rests = (s: string) => /^It rests on/i.test(s)
  const lead = [all.find(isNew), all.find(rests)].filter((s): s is string => !!s)
  if (!lead.length) return { lead: all.slice(0, 2), rest: all.slice(2) }
  return { lead, rest: all.filter((s) => !lead.includes(s)) }
}

/** The opener's sentences that are news next to the card: what is new, why it came to you, what it rests on. */
export function newsOf(text: string): string[] {
  const all = sentencesOf(text)
  const keep = all.filter((s) => /^(This has not happened before|It comes to you|It rests on|Your answer will be the first)/.test(s))
  return keep.length ? keep : all.slice(0, 2)
}

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

/** "Read the case, the call with Calverona Hamburg and earlier cases": the steps as one plain sentence. */
export function stepSentence(steps: ChatToolStep[]): string {
  // "Looked up earlier cases of this kind: none" reads as a step, not a finding, in a sentence.
  const labels = steps.map((s) => s.label.replace(/: none( yet)?$/, ""))
  if (labels.length <= 1) return labels[0] ?? ""
  // A verb said once: "Read the case, the call with Calverona Hamburg and looked up ..."
  const verb = (l: string) => /^(Read|Looked up|Looked for|Checked|Found) /.exec(l)?.[1] ?? null
  const parts = labels.map((l, i) => {
    const v = verb(l)
    const same = i > 0 && v && v === verb(labels[i - 1])
    const t = same ? l.slice(v!.length + 1) : l
    return i === 0 ? t : lower(t)
  })
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** A done step in the words of one still at work: "Read the messages" -> "Reading the messages". */
export function runningWords(label: string): string {
  return label
    .replace(/^Read /, "Reading ")
    .replace(/^Looked up /, "Looking up ")
    .replace(/^Looked for /, "Looking for ")
    .replace(/^Checked /, "Checking ")
    .replace(/^Found /, "Finding ")
}

/** Where an answer comes from, as nouns: "the call with Calverona Hamburg", "the messages on this order". */
export function sourcesOf(steps: ChatToolStep[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    const l = s.label
    let n: string | null = null
    if (/^Read the (case|order)$/.test(l)) n = "the order"
    else if (/^Read (the call|\d+ calls)/.test(l)) n = l.replace(/^Read /, "")
    else if (/^Read the messages/.test(l)) n = "the messages on this order"
    else if (/^Looked up (\d+ )?earlier cases/.test(l)) n = l.replace(/^Looked up /, "").replace(/: none$/, "")
    else if (/^Looked up /.test(l)) n = `${l.replace(/^Looked up /, "")} in Places`
    else if (/^Checked /.test(l)) n = l.replace(/^Checked /, "")
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

/** "a, b and c" */
export const andList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)

/** The time a turn is shown at. Lab fixtures are dated after the room's clock; they read as just before it. */
export function turnTime(m: ChatMessage, now: string, index: number, count: number): string {
  const t = Date.parse(m.at)
  const n = Date.parse(now)
  if (Number.isFinite(t) && Number.isFinite(n) && t <= n) return clock(m.at)
  return clock(new Date(n - (count - index) * 60_000).toISOString())
}
