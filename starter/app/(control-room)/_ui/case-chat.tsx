"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { readChatEvents } from "@/lib/control-room/chat-sse"
import { gateWords, knowledgeWords } from "@/lib/control-room/chat-words"
import { clock, day, onDay } from "@/lib/control-room/format"
import type { CaseKnowledge, ChatAction, ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { decide } from "../actions"
import { AgentMark } from "./agent-mark"
import { Icon } from "./icons"
import { VoiceButton, type SpeakInput } from "./voice-button"

// "Talk it through": the conversation with the agent beside a decision. The agent
// answers from the case (order, calls, messages, earlier cases). Asked to do one of
// the case's options, it offers it as one tap (an "action" event): the option's own
// button plus "Not now". The tap is the person's decision and goes the same way as
// the card's button (the decide action, POST /api/cr/decisions), with a short summary
// of the conversation as the reason. Consumes GET/POST /api/cr/cases/:id/chat
// (ChatThread, then a text/event-stream of ChatEvent per question).

const chatUrl = (caseId: string) => `/api/cr/cases/${encodeURIComponent(caseId)}/chat`

/** Loads the thread as soon as the card shows, so the opener is there when the person opens it. */
export function useChatThread(caseId: string, personId: string) {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let live = true
    setThread(null)
    setMissing(false)
    fetch(`${chatUrl(caseId)}?person=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ChatThread>) : null))
      .then((t) => live && (t ? setThread(t) : setMissing(true)))
      .catch(() => live && setMissing(true))
    return () => {
      live = false
    }
  }, [caseId, personId])
  return { thread, missing }
}

type Live = { steps: ChatToolStep[]; text: string }

/** The agent's offer under its answer: open until the person taps, then the line of what happened. */
type Offer = { after: string; action: ChatAction; state: "open" | "saving" | "done" | "failed"; line?: string; at?: string }

export function CaseChat({ thread, personId, now, focus }: { thread: ChatThread | null; personId: string; now: string; focus?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(thread?.messages ?? [])
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<Offer | null>(null)
  const router = useRouter()
  const [draft, setDraft] = useState("")
  // The answer to a spoken question is read aloud as it streams (one id per answer; a new id stops the old one).
  const [speak, setSpeak] = useState<SpeakInput | null>(null)
  const answerId = useRef("")
  const log = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const pinned = useRef(true)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => setMessages(thread?.messages ?? []), [thread])
  useEffect(() => {
    if (!draft && field.current) field.current.style.height = ""
  }, [draft])
  useEffect(() => () => abort.current?.abort(), [])
  // The field takes focus when the person opens the panel, not when J/K brings in the next case with it open.
  const wasOpen = useRef(focus)
  useEffect(() => {
    if (focus && !wasOpen.current) field.current?.focus({ preventScroll: true })
    wasOpen.current = focus
  }, [focus])

  // Follow the answer as it grows, unless the person has scrolled up to read.
  useLayoutEffect(() => {
    const el = log.current
    if (el && pinned.current && (live || messages.length)) el.scrollTop = el.scrollHeight
  }, [messages.length, live])

  const send = useCallback(
    async (raw: string, via: "text" | "voice") => {
      const text = raw.trim()
      if (!thread || !text || live) return
      setError(null)
      setDraft("")
      pinned.current = true
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
          }
          else if (ev.type === "done") {
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
      const line = `${action.label}.${action.next ? ` ${action.next}` : ""}`
      setOffer({ ...offer, state: "done", line, at: clock(d.at) })
      router.refresh()
    } catch {
      setOffer({ ...offer, state: "failed" })
    }
  }, [thread, offer, router])

  return (
    <div className="chat">
      <div
        className="chat-log"
        ref={log}
        role="log"
        aria-live="polite"
        aria-busy={!!live || !thread}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        {thread ? (
          <>
            <AgentTurn message={thread.opener} />
            <Knowledge k={thread.knowledge} now={now} />
            {messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="turn-group">
                  <AgentTurn message={m} />
                  {offer?.after === m.id && <OfferTurn offer={offer} onYes={confirm} onNo={() => setOffer(null)} />}
                </div>
              ) : (
                <PersonTurn key={m.id} message={m} />
              ),
            )}
            {live && <LiveTurn live={live} />}
            {error && <p className="s now chat-error">{error}</p>}
          </>
        ) : (
          <LiveTurn live={{ steps: [], text: "" }} />
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft, "text")
        }}
      >
        <textarea
          ref={field}
          className="m"
          rows={1}
          value={draft}
          placeholder="Ask about this case"
          aria-label="Ask the agent about this case"
          onChange={(e) => {
            setDraft(e.target.value)
            const el = e.currentTarget
            el.style.height = "auto"
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
          }}
          onKeyDown={(e) => {
            // Escape leaves the field; a second Escape closes the panel (work-frame).
            if (e.key === "Escape") e.currentTarget.blur()
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send(draft, "text")
            }
          }}
        />
        <VoiceButton onTranscript={(t) => send(t, "voice")} speak={speak} disabled={!thread} />
        <button type="submit" className="send" disabled={!thread || !draft.trim() || !!live} aria-label="Send">
          <Icon name="arrow-up" size={18} />
        </button>
      </form>
    </div>
  )
}

const upsert = (steps: ChatToolStep[], step: ChatToolStep) =>
  steps.some((s) => s.id === step.id) ? steps.map((s) => (s.id === step.id ? step : s)) : [...steps, step]

/** Paragraphs as the agent wrote them; a blank line starts a new one. */
function Words({ text }: { text: string }) {
  return (
    <div className="words">
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="m">
            {p}
          </p>
        ))}
    </div>
  )
}

/** "3 steps ›": what the agent looked at, one tap deep. */
function Steps({ steps, working }: { steps: ChatToolStep[]; working?: boolean }) {
  const n = steps.length
  // One step needs no disclosure: its own words are shorter than "1 step ›".
  if (n <= 1)
    return (
      <p className="byline s">
        <AgentMark working={working} />
        {n === 1 && <span>{steps[0].label}</span>}
      </p>
    )
  return (
    <details className="steps">
      <summary className="byline s">
        <AgentMark working={working} />
        <span>
          {n} {n === 1 ? "step" : "steps"}
        </span>
        <Icon name="chevron-right" size={14} />
      </summary>
      <StepLines steps={steps} />
    </details>
  )
}

function StepLines({ steps }: { steps: ChatToolStep[] }) {
  return (
    <ul className="step-lines">
      {steps.map((s) => (
        <li key={s.id} className={`s step ${s.status}`}>
          <span className="step-state" aria-hidden="true">
            {s.status === "done" ? <Icon name="check" size={14} /> : s.status === "failed" ? <Icon name="x" size={14} /> : <span className="spin" />}
          </span>
          <span className="step-label">{s.label}</span>
          {s.status !== "done" && <span className="sr-only">{s.status === "failed" ? ", failed" : ", working"}</span>}
        </li>
      ))}
    </ul>
  )
}

function AgentTurn({ message }: { message: ChatMessage }) {
  return (
    <div className="turn agent">
      <Steps steps={message.toolSteps ?? []} />
      <Words text={message.text} />
    </div>
  )
}

function PersonTurn({ message }: { message: ChatMessage }) {
  return (
    <div className="turn person">
      <p className="m said">
        {message.text}
        {message.via === "voice" && (
          <span className="via" title="Said aloud">
            <Icon name="mic" size={14} />
            <span className="sr-only">said aloud</span>
          </span>
        )}
      </p>
    </div>
  )
}

/** One tap to let the agent do it: the option's own button and "Not now"; after the yes, one line of what happened. */
function OfferTurn({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <div className="turn agent offer-done" role="status">
        <p className="byline s">
          <AgentMark />
          <span>
            <Icon name="check" size={14} /> Decided{offer.at ? ` at ${offer.at}` : ""}
          </span>
        </p>
        <Words text={offer.line ?? ""} />
      </div>
    )
  const saving = offer.state === "saving"
  return (
    <div className="chat-offer">
      {offer.action.draft && <OfferDraft draft={offer.action.draft} />}
      <div className="chat-offer-buttons">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onYes}>
          {offer.action.label}
        </button>
        <button type="button" className="btn btn-plain" disabled={saving} onClick={onNo}>
          Not now
        </button>
      </div>
      {offer.state === "failed" && <p className="s now chat-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}

/** The message itself before the yes: who it goes to and the text, a few lines until "Read it all ›". */
function OfferDraft({ draft }: { draft: NonNullable<ChatAction["draft"]> }) {
  const [all, setAll] = useState(false)
  const long = draft.text.length > 220 || draft.text.split("\n").length > 4
  const translated = draft.translation && draft.language !== "en"
  return (
    <div className="chat-draft">
      <p className="s">To {draft.to}</p>
      <p className={`m draft-text${all || !long ? "" : " clamped"}`}>{draft.text}</p>
      {all && translated && (
        <>
          <p className="s">In English</p>
          <p className="m draft-text">{draft.translation}</p>
        </>
      )}
      {!all && (long || translated) && (
        <button type="button" className="s read-all" onClick={() => setAll(true)}>
          Read it all
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </div>
  )
}

/** The answer on its way: the mark breathes, "Thinking", then each step as a quiet line; the text streams in. */
function LiveTurn({ live }: { live: Live }) {
  if (live.text)
    return (
      <div className="turn agent live">
        <Steps steps={live.steps} working />
        <Words text={live.text} />
      </div>
    )
  return (
    <div className="turn agent live">
      <p className="byline s">
        <AgentMark working />
        <span className="thinking">Thinking</span>
      </p>
      {live.steps.length > 0 && <StepLines steps={live.steps} />}
    </div>
  )
}

// ---------- What the agent knows about this kind of case ----------

const dayWords = (iso: string, now: string) => {
  const d = onDay(iso, now)
  return d === "today" ? "Today" : d === "yesterday" ? "Yesterday" : day(iso)
}

function Knowledge({ k, now }: { k: CaseKnowledge; now: string }) {
  const kind = <span className="kind">{k.kindLabel}</span>
  if (!k.precedents.length)
    return (
      <p className="knowledge s">
        {kind}
        <span className="state">{knowledgeWords(k)}</span>
      </p>
    )
  return (
    <details className="knowledge-more">
      <summary className="knowledge s">
        {kind}
        <span className="state">
          {knowledgeWords(k)}
          <Icon name="chevron-right" size={14} />
        </span>
      </summary>
      <ul className="precedents">
        {k.precedents.map((p) => (
          <li key={`${p.caseId}-${p.at}`}>
            <p className="s">
              {p.decidedBy}, {dayWords(p.at, now)}, {p.place}
            </p>
            <p className="m">{p.choice}</p>
            {p.why && <p className="s">“{p.why}”</p>}
          </li>
        ))}
      </ul>
      <p className="s gate">{gateWords(k)}</p>
    </details>
  )
}
