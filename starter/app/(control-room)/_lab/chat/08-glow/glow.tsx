"use client"

// chat 08: Lifted, with a light at the edge. The conversation floats as its own rounded panel beside
// the card, the person's question stands in large type (Ask Siri), and while the agent works or talks
// the panel's edge glows softly in Bahn's green and orange instead of a spinner; at rest it is still.

import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { useVoice, type Voice } from "../../../_ui/use-voice"
import { runningWords, shortOpener, stepSentence, useChatCore, useFollow, useVoiceDemo, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame } from "../parts"
import "./glow.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

export function GlowChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const real = useVoice({ onTranscript: (t) => core.send(t, "voice") })
  const demo = useVoiceDemo()
  const voice: Voice = demo ? { ...real, state: demo, supported: true, error: null } : real
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const glow = core.live || !thread ? "is-working" : voice.state === "speaking" ? "is-speaking" : voice.state === "listening" || voice.state === "starting" ? "is-listening" : ""
  const short = thread ? shortOpener(thread.opener.text) : null

  return (
    <PanelFrame nn="08" open={open} onClose={onClose} className={glow}>
      <span className="lc-glow" aria-hidden="true" />
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread && short ? (
          <>
            <div className="lc-agent">
              <p className="lc-by">
                <AgentMark />
                <span>{stepSentence(thread.opener.toolSteps ?? [])}</span>
              </p>
              <div className="lc-words">
                {short.lead.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <KindLine k={thread.knowledge} now={now} />
            </div>
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentTurn m={m} />
                  {core.offer?.after === m.id && <OfferRow offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <p key={m.id} className="lc-ask">
                  {m.text}
                </p>
              ),
            )}
            {core.live && (
              <div className="lc-agent">
                <p className="lc-by">
                  <AgentMark />
                  <span>{doing(core.live.steps, core.live.text)}</span>
                </p>
                {core.live.text && <Paras text={core.live.text} />}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <p className="lc-by">
            <AgentMark />
            <span>Reading the case</span>
          </p>
        )}
      </div>
      <Composer core={core} thread={thread} open={open} voice={voice} placeholder="Ask about this case" />
      {(voice.state === "listening" || voice.state === "speaking") && <p className="lc-voice-word">{voice.state === "speaking" ? "Speaking. Talk to interrupt" : "Listening. Let go to send"}</p>}
    </PanelFrame>
  )
}

function doing(steps: ChatToolStep[], text: string) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  if (running) return runningWords(running.label)
  return text ? "Writing the answer" : "Reading the case"
}

function AgentTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-agent">
      {(m.toolSteps?.length ?? 0) > 0 && (
        <p className="lc-by">
          <AgentMark />
          <span>{stepSentence(m.toolSteps ?? [])}</span>
        </p>
      )}
      <Paras text={m.text} />
    </div>
  )
}

function OfferRow({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <div className="lc-done" role="status">
        <p>
          <Icon name="check" size={16} />
          <strong>Decided{offer.at ? ` at ${offer.at}` : ""}</strong>
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
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}
