"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { chatIntent, type ChatDraft, type ChatIntent, type ChatOffer, sendsOnly } from "@/lib/chat/intent"
import { readChatEvents } from "@/lib/control-room/chat-sse"
import { gateWords, knowledgeWords } from "@/lib/control-room/chat-words"
import { clock, day, languageName, onDay } from "@/lib/control-room/format"
import type { CaseKnowledge, ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { decide } from "../actions"
import { AgentMark } from "./agent-mark"
import { EmailReceipt } from "./email-receipt"
import { type SendInfo, editedText, openedFromChat, pauseSend, recipient, sendNow, sentWhat, startSend, undoSend, useEdit, useSendWindow } from "./email-send"
import { Icon } from "./icons"
import { VoiceButton, type SpeakInput } from "./voice-button"
import { usePanel } from "./work-frame"

// "Talk it through": the conversation with the agent beside a decision. The agent answers from the
// case (order, calls, messages, earlier cases) and shows what it read as one line over each answer.
// Asked to do one of the case's options, it offers it in the field's place (lab chat:06): "Send the
// email" and "See the email". "Send the email", tapped, typed or said, opens the short send window
// (Sending, Undo) and then decides through the decide action the card's own save calls; the side panel
// then shows the receipt (h48). "See the email" opens the email sheet (h47: Send, Edit, Cancel).
// "Show me the email" puts the email itself in the conversation. Consumes GET/POST
// /api/cr/cases/:id/chat (ChatThread, then a text/event-stream of ChatEvent per question).

const chatUrl = (caseId: string) => `/api/cr/cases/${encodeURIComponent(caseId)}/chat`

/** Loads the thread as soon as the card shows, so the opener is there when the person opens it. */
export function useChatThread(caseId: string, personId: string) {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let live = true
    setThread(null)
    setMissing(false)
    fetch(`${chatUrl(caseId)}?person=${encodeURIComponent(personId)}`, {
      cache: "no-store",
    })
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

/**
 * The agent's offer after its answer. open: the two buttons stand in the field's place; sending: the
 * send window runs; done: one line in the conversation says it was decided and when.
 */
type Offer = {
  after: string
  action: ChatOffer
  state: "open" | "sending" | "done" | "failed"
  at?: string
}

const infoOf = (caseId: string, action: ChatOffer): SendInfo | null => {
  if (!action.draft) return null
  const r = recipient(action.draft.to)
  return {
    caseId,
    origin: "chat",
    to: r.name,
    how: r.how,
    noun: r.noun,
    language: action.draft.language,
    subject: action.draft.subject,
    next: action.next,
    calls: action.calls,
  }
}

export function CaseChat({ thread, personId, now, focus }: { thread: ChatThread | null; personId: string; now: string; focus?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(thread?.messages ?? [])
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<Offer | null>(null)
  const router = useRouter()
  const panel = usePanel()
  const [draft, setDraft] = useState("")
  // The answer to a spoken question is read aloud as it streams (one id per answer; a new id stops the old one).
  const [speak, setSpeak] = useState<SpeakInput | null>(null)
  const answerId = useRef("")
  const log = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const pinned = useRef(true)
  const abort = useRef<AbortController | null>(null)
  const caseId = thread?.caseId ?? ""
  const win = useSendWindow(caseId)

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
  }, [messages.length, live, offer?.state])

  // The yes: the send window first (Undo for a few seconds), then the decide action the card's save calls.
  const sendIt = useCallback(
    (o: Offer) => {
      if (!thread) return
      const info = infoOf(thread.caseId, o.action)
      const decideNow = async () => {
        // The person's edit from the email sheet goes with it, whichever way they send.
        const own = editedText(thread.caseId, o.action.draft?.text)
        const d = await decide({
          id: `dec-${thread.caseId}-${Date.now().toString(36)}`,
          caseId: thread.caseId,
          optionId: o.action.optionId,
          why: o.action.summary,
          ...(own ? { editedDetail: own } : {}),
        })
        const at = clock(d.at)
        setOffer({ ...o, state: "done", at })
        router.refresh()
        return at
      }
      if (!info) {
        // An option that sends nothing: no window, the decision at once.
        setOffer({ ...o, state: "sending" })
        decideNow().catch(() => setOffer({ ...o, state: "failed" }))
        return
      }
      setOffer({ ...o, state: "sending" })
      startSend(
        info,
        () => decideNow().catch((e) => (setOffer({ ...o, state: "failed" }), Promise.reject(e))),
        () => setOffer({ ...o, state: "open" }),
      )
    },
    [thread, router],
  )

  const send = useCallback(
    async (raw: string, via: "text" | "voice") => {
      const text = raw.trim()
      if (!thread || !text || live) return
      setError(null)
      setDraft("")
      pinned.current = true
      const intent: ChatIntent | null = chatIntent(text)
      const mine: ChatMessage = {
        id: `local-${Date.now()}`,
        caseId: thread.caseId,
        role: "person",
        personId,
        text,
        via,
        at: new Date().toISOString(),
      }
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
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ person: personId, text, via }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) throw new Error(`POST chat ${res.status}`)
        let done = false
        let action: ChatOffer | undefined
        for await (const ev of readChatEvents(res.body)) {
          if (ev.type === "tool") setLive((l) => l && { ...l, steps: upsert(l.steps, ev.step) })
          else if (ev.type === "action") action = ev.action as ChatOffer
          else if (ev.type === "delta") {
            setLive((l) => l && { ...l, text: l.text + ev.text })
            if (spoken)
              setSpeak((sp) => ({
                id: answerId.current,
                text: (sp?.id === answerId.current ? sp.text : "") + ev.text,
              }))
          } else if (ev.type === "done") {
            done = true
            setMessages((m) => [...m, ev.message])
            setLive(null)
            if (action) {
              const o: Offer = { after: ev.message.id, action, state: "open" }
              // "Send the email", typed or said, is the yes itself: straight into the send window.
              if (intent === "send" && action.draft && sendsOnly(action.label)) sendIt(o)
              else setOffer(o)
            }
            if (spoken)
              setSpeak({
                id: answerId.current,
                text: ev.message.text,
                done: true,
              })
          } else if (ev.type === "error") throw new Error(ev.message)
        }
        if (!done) throw new Error("The answer stopped early")
      } catch {
        if (ctrl.signal.aborted) return
        setLive(null)
        setError("No answer came through. Ask again.")
      }
    },
    [thread, live, personId, sendIt],
  )

  // "See the email": the email sheet (h47) over the panel, where Edit works; its Send ends in this chat's receipt.
  const seeIt = useCallback(
    (o: Offer) => {
      if (!thread) return
      openedFromChat(thread.caseId, {
        next: o.action.next,
        calls: o.action.calls,
      })
      panel.setOpen("email")
    },
    [thread, panel],
  )

  // Decided through the sheet opened from here: the chat says so too.
  useEffect(() => {
    if (win?.phase === "sent" && offer && offer.state !== "done") setOffer({ ...offer, state: "done", at: win.at })
  }, [win?.phase, win?.at, offer])

  const asking = offer && (offer.state === "open" || offer.state === "failed") ? offer : null
  const sending = win && (win.phase === "wait" || win.phase === "saving") && win.origin === "chat" ? win : null

  // Undo lives in this panel: when the panel closes or the case changes while it counts, the email goes
  // at once rather than on a countdown nobody sees (Gmail: dismissing the undo bar sends).
  const counting = useRef(false)
  counting.current = !!sending && sending.phase === "wait"
  useEffect(() => {
    if (focus === false && counting.current) sendNow()
  }, [focus])
  useEffect(() => () => void (counting.current && sendNow()), [])

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
                  {offer?.after === m.id && offer.state === "done" && <DecidedLine offer={offer} />}
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
      {sending ? (
        <SendingCard win={sending} />
      ) : asking ? (
        <OfferCard
          offer={asking}
          onYes={() => sendIt(asking)}
          onSee={() => seeIt(asking)}
          onNo={() => (setOffer(null), field.current?.focus({ preventScroll: true }))}
        />
      ) : null}
      {/* The field stays under the offer: saying or typing "send the email" is the yes too. */}
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
            // The field grows with its text up to its CSS max-height (seven lines of the ramp's body).
            el.style.height = `${el.scrollHeight}px`
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

      {thread && <EmailReceipt caseId={thread.caseId} />}
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

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

/** "Read the order, the call with Calverona Hamburg and looked up earlier cases": the steps as one plain line (lab chat:06). */
export function stepSentence(steps: ChatToolStep[]): string {
  const labels = steps.map((s) => s.label.replace(/: none( yet)?$/, ""))
  if (labels.length <= 1) return labels[0] ?? ""
  // A verb said once: "Read the order and the call with ..."
  const verb = (l: string) => /^(Read|Looked up|Looked for|Checked|Found) /.exec(l)?.[1] ?? null
  const parts = labels.map((l, i) => {
    const v = verb(l)
    const same = i > 0 && v && v === verb(labels[i - 1])
    const t = same ? l.slice(v!.length + 1) : l
    return i === 0 ? t : lower(t)
  })
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/**
 * What the agent read, over its answer: its line of reasoning in one line ("Read the order"), the
 * whole list one tap deep when there is more than one step. While it works: the step it is on.
 */
function Byline({ steps, working }: { steps: ChatToolStep[]; working?: boolean }) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  const line = running ? running.label : working ? (steps.length ? "Writing the answer" : "Reading the case") : stepSentence(steps)
  if (steps.length <= 1 || working)
    return (
      <p className="byline s">
        <AgentMark working={working} />
        {line && <span className={`by-line${working ? " thinking" : ""}`}>{line}</span>}
      </p>
    )
  return (
    <details className="steps">
      <summary className="byline s">
        <AgentMark />
        <span className="by-line">{line}</span>
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

/** An agent message; "show me the email" answers carry the email itself (lib/chat/service.ts). */
function AgentTurn({ message }: { message: ChatMessage & { email?: ChatDraft; decided?: { at: string; by: string } } }) {
  // The thread's own record of the decision (lib/chat/service.ts noteDecision): the "Decided at" line.
  if (message.decided)
    return (
      <div className="chat-decided" role="status">
        <p className="m strong">
          <Icon name="check" size={16} /> Decided by {message.decided.by} at {message.decided.at}
        </p>
        <p className="s">{message.text.replace(/^Decided by .+? at \d{1,2}:\d{2}: /, "")}</p>
      </div>
    )
  const email = message.email
  return (
    <div className="turn agent">
      <Byline steps={message.toolSteps ?? []} />
      <Words text={message.text} />
      {email && <EmailInChat draft={email} caseId={message.caseId} />}
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

/** "Show me the email": the email itself in the conversation, To and Subject over it, about eight lines until "Read it all". */
function EmailInChat({ draft: agents, caseId }: { draft: ChatDraft; caseId: string }) {
  // The person's edit from the sheet, when there is one for this very email.
  const edit = useEdit(caseId)
  const own = edit && edit.original.trim() === agents.text.trim() ? edit.text : undefined
  const draft: ChatDraft = own ? { ...agents, text: own, translation: undefined } : agents
  const [all, setAll] = useState(false)
  const text = useRef<HTMLParagraphElement>(null)
  const [long, setLong] = useState(true)
  useLayoutEffect(() => {
    const el = text.current
    if (el && !all) setLong(el.scrollHeight > el.clientHeight + 2)
  }, [all, draft.text])
  const r = recipient(draft.to)
  const foreign = draft.language !== "en"
  return (
    <div className="chat-email" aria-label={`The ${r.noun}`}>
      <dl className="chat-email-meta s">
        <dt>To</dt>
        <dd>
          {r.name}
          {r.how ? `, ${r.how}` : ""}
        </dd>
        {draft.subject && (
          <>
            <dt>Subject</dt>
            <dd>{draft.subject}</dd>
          </>
        )}
        {foreign && (
          <>
            <dt>Language</dt>
            <dd>{languageName(draft.language)}</dd>
          </>
        )}
      </dl>
      <p ref={text} className={`m chat-email-text${all ? "" : " clamped"}`} lang={draft.language}>
        {draft.text}
      </p>
      {all && foreign && draft.translation && (
        <>
          <p className="s chat-email-en">In English</p>
          <p className="m chat-email-text" lang="en">
            {draft.translation}
          </p>
        </>
      )}
      {!all && (long || (foreign && !!draft.translation)) && (
        <button type="button" className="s read-all" onClick={() => setAll(true)}>
          Read it all
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </div>
  )
}

/**
 * The offer in the field's place (lab chat:06): the question, what happens next, the filled
 * "Send the email" (Enter, it has focus) and "See the email" (the sheet, where Edit works).
 * Escape or the close says not now, and the field comes back.
 */
function OfferCard({ offer, onYes, onSee, onNo }: { offer: Offer; onYes: () => void; onSee: () => void; onNo: () => void }) {
  const yes = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    yes.current?.focus({ preventScroll: true })
  }, [offer.after])
  const { action } = offer
  const email = !!action.draft
  const noun = action.draft ? recipient(action.draft.to).noun : "email"
  return (
    <div
      className="chat-approve"
      role="group"
      aria-label="The agent's offer"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          onNo()
        }
      }}
    >
      <div className="approve-title">
        <AgentMark />
        <span>{action.label}?</span>
        <button type="button" className="approve-close" aria-label="Not now" onClick={onNo}>
          <Icon name="x" size={16} />
        </button>
      </div>
      {action.next && <p className="approve-next s">Then {lower(action.next)}</p>}
      <div className="approve-choices">
        <button ref={yes} type="button" className="choice is-yes" onClick={onYes}>
          <span>{action.label}</span>
          <kbd aria-label="Enter">↵</kbd>
        </button>
        {email && sendsOnly(action.label) && (
          <button type="button" className="choice" onClick={onSee}>
            <span>See the {noun}</span>
          </button>
        )}
      </div>
      <p className="approve-limit s">
        {offer.state === "failed"
          ? "This was not saved. Nothing was sent or booked. Try again."
          : `The agent never contacts a customer on its own. Nothing is sent before you choose.`}
      </p>
    </div>
  )
}

/** The send window in the field's place: what is going where, a count, and Undo (held while pointed at). */
function SendingCard({ win }: { win: NonNullable<ReturnType<typeof useSendWindow>> }) {
  const saving = win.phase === "saving"
  return (
    <div className="chat-approve is-sending" role="status" aria-live="polite">
      <div className="approve-title">
        <AgentMark working />
        <span>Sending</span>
      </div>
      <p className="approve-next s">
        {sentWhat(win)}
        {win.subject ? `, about ${win.subject}` : ""}.{" "}
        {saving ? "Saving the decision." : `It goes in ${Math.max(1, Math.ceil(win.left))} s. Until then you can take it back.`}
      </p>
      <button
        type="button"
        className="choice"
        disabled={saving}
        onClick={() => undoSend()}
        onPointerEnter={() => pauseSend(true)}
        onPointerLeave={() => pauseSend(false)}
        onFocus={() => pauseSend(true)}
        onBlur={() => pauseSend(false)}
      >
        <span>Undo</span>
        <span className="send-count" aria-hidden="true" style={{ ["--left" as string]: String(win.left / 5) }} />
      </button>
    </div>
  )
}

/** After the yes: one line in the conversation (h43), what was decided and what the agent does next. */
function DecidedLine({ offer }: { offer: Offer }) {
  return (
    <div className="chat-decided" role="status">
      <p className="m strong">
        <Icon name="check" size={16} /> Decided
        {offer.at ? ` at ${offer.at}` : ""}
      </p>
      {offer.action.next && <p className="s">{offer.action.next}</p>}
    </div>
  )
}

/** The answer on its way: the mark breathes, the step it is on as one shimmering line; the text streams in. */
function LiveTurn({ live }: { live: Live }) {
  return (
    <div className="turn agent live">
      <Byline steps={live.steps} working />
      {live.text && <Words text={live.text} />}
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
