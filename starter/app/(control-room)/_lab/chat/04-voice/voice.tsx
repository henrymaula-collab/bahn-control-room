"use client"

// chat 04: Talk, with captions. Voice first: the field is one round talk control (hold to talk, or tap
// to start and tap to send), the conversation reads like a call transcript with who said it, and the
// newest answer stands in ink while everything earlier steps back to grey. While the agent speaks,
// "Talk to interrupt" says how to cut in. The yes is never taken by voice: it is a tap on screen.

import { useState } from "react"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { useVoice, type Voice } from "../../../_ui/use-voice"
import { VoiceButton } from "../../../_ui/voice-button"
import { newsOf, runningWords, turnTime, useChatCore, useFollow, useVoiceDemo, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame } from "../parts"
import "./voice.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

const WORD: Record<string, string> = {
  idle: "Hold to talk",
  starting: "Listening",
  listening: "Listening. Let go to send",
  transcribing: "Writing it down",
  speaking: "Talk to interrupt",
}

export function VoiceChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const real = useVoice({ onTranscript: (t) => core.send(t, "voice") })
  const demo = useVoiceDemo()
  // A held voice state for a shot: the real controls, the state fixed, nothing recorded.
  const voice: Voice = demo ? { ...real, state: demo, supported: true, error: null } : real
  const [typing, setTyping] = useState(false)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const speaking = voice.state === "speaking"
  const msgs = core.messages
  const lastAgent = [...msgs].reverse().find((m) => m.role === "agent")?.id
  const newest = core.live ? "live" : lastAgent ?? "opener"

  return (
    <PanelFrame nn="04" open={open} onClose={onClose} className={speaking ? "is-speaking" : undefined}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread ? (
          <>
            <Turn who="Agent" at={null} now={now} focus={newest === "opener"}>
              <div className="lc-words">
                {newsOf(thread.opener.text).map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <KindLine k={thread.knowledge} now={now} />
            </Turn>
            {msgs.map((m, i) =>
              m.role === "agent" ? (
                <Turn key={m.id} who="Agent" at={turnTime(m, now, i, msgs.length)} now={now} focus={newest === m.id}>
                  <Paras text={m.text} />
                  {core.offer?.after === m.id && <OfferOnScreen offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </Turn>
              ) : (
                <Turn key={m.id} who="You" at={turnTime(m, now, i, msgs.length)} now={now} focus={i === msgs.length - 1 || (!!core.live && i === msgs.length - 1)} said={m.via === "voice"}>
                  <p>{m.text}</p>
                </Turn>
              ),
            )}
            {core.live && (
              <Turn who="Agent" at={null} now={now} focus working>
                {core.live.text ? <Paras text={core.live.text} /> : null}
                <p className="lc-doing lc-shimmer">{doing(core.live.steps, core.live.text)}</p>
              </Turn>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <p className="lc-doing lc-shimmer">Reading the case</p>
        )}
      </div>
      {typing ? (
        <div className="lc-typing">
          <Composer core={core} thread={thread} open={open} withVoice={false} placeholder="Type instead" />
          <button type="button" className="lc-totalk" onClick={() => setTyping(false)} aria-label="Talk instead">
            <MicGlyph />
          </button>
        </div>
      ) : (
        <div className="lc-dock" data-state={voice.state} data-demo={demo ? "" : undefined}>
          <button type="button" className="lc-keys" onClick={() => setTyping(true)} aria-label="Type instead">
            <KeysGlyph />
          </button>
          <div className="lc-talk">
            <span className="lc-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <VoiceButton voice={voice} onTranscript={(t) => core.send(t, "voice")} speak={core.speak} disabled={!thread} showState={false} className="lc-big" />
            <span className="lc-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <p className="lc-word" role="status">
            {voice.error ?? (core.live && voice.state === "idle" ? "The agent is answering" : WORD[voice.state])}
          </p>
        </div>
      )}
    </PanelFrame>
  )
}

function doing(steps: ChatToolStep[], text: string) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  if (running) return runningWords(running.label)
  return text ? "Writing the answer" : "Reading the case"
}

/** One turn of the transcript: who, when, the words; the newest stands in ink, the rest in grey. */
function Turn({
  who,
  at,
  focus,
  working,
  said,
  children,
}: {
  who: string
  at: string | null
  now: string
  focus?: boolean
  working?: boolean
  said?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`lc-tturn${focus ? " is-focus" : ""}${who === "You" ? " is-you" : ""}`}>
      <p className="lc-who">
        {who === "Agent" ? <AgentMark working={working} /> : null}
        <span>{who}</span>
        {said && <Icon name="mic" size={12} />}
        {at && <time>{at}</time>}
      </p>
      {children}
    </div>
  )
}

/** The yes is a tap on screen, never a spoken yes (ChatGPT Voice: "spoken approval is not supported"). */
function OfferOnScreen({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <div className="lc-done" role="status">
        <p className="lc-done-head">
          <Icon name="check" size={16} />
          Decided{offer.at ? ` at ${offer.at}` : ""}
        </p>
        <p className="lc-done-line">{offer.line}</p>
      </div>
    )
  const saving = offer.state === "saving"
  return (
    <div className="lc-offer">
      <div className="lc-offer-buttons">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onYes}>
          {offer.action.label}
        </button>
        <button type="button" className="btn btn-plain" disabled={saving} onClick={onNo}>
          Not now
        </button>
      </div>
      <p className="lc-onscreen">The agent takes a yes only from this button, never by voice.</p>
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}

function KeysGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12.5h.01M10 12.5h.01M14 12.5h.01M18 12.5h.01M8 16h8" />
    </svg>
  )
}

function MicGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </svg>
  )
}
