"use client"

// chat 10: The yes is a reply. Under the agent's offer, "Send the email" and "Not now" sit on the
// person's side, like the suggested actions under a message in Apple's Messages. A tap becomes the
// person's own words in the thread, and the agent answers in one sentence that starts with what was
// done and when (Hark's "Posted to #product-launch.", Mutiny's "Done:"). While it works, one quiet
// status line sits above the field, as in Hark.

import { useState } from "react"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { runningWords, shortOpener, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame, OfferMessage } from "../parts"
import "./replies.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

export function RepliesChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  // "Not now" is the person's reply too; it stays in the thread with the agent's one line.
  const [declined, setDeclined] = useState<string | null>(null)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state, declined])
  const short = thread ? shortOpener(thread.opener.text) : null

  return (
    <PanelFrame nn="10" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread && short ? (
          <>
            <div className="lc-msg">
              <AgentMark />
              <div className="lc-msg-body">
                <div className="lc-words">
                  {short.lead.map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                </div>
                <KindLine k={thread.knowledge} now={now} />
              </div>
            </div>
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentMsg m={m} />
                  {core.offer?.after === m.id && <Replies offer={core.offer} onYes={core.confirm} onNo={() => (setDeclined(m.id), core.dismiss())} />}
                  {declined === m.id && (
                    <>
                      <Said text="Not now" />
                      <div className="lc-msg">
                        <AgentMark />
                        <div className="lc-msg-body">
                          <p>
                            <strong>Nothing was sent.</strong> The card still waits for your decision.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Said key={m.id} text={m.text} via={m.via} />
              ),
            )}
            {core.live?.text && (
              <div className="lc-msg">
                <AgentMark working />
                <div className="lc-msg-body">
                  <Paras text={core.live.text} />
                </div>
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : null}
      </div>
      {(core.live || !thread) && (
        <p className="lc-status" role="status">
          <AgentMark working />
          <span className="lc-shimmer">{core.live ? doing(core.live.steps, core.live.text) : "Reading the case"}</span>
        </p>
      )}
      <Composer core={core} thread={thread} open={open} placeholder="Message the agent" />
    </PanelFrame>
  )
}

function doing(steps: ChatToolStep[], text: string) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  if (running) return runningWords(running.label)
  return text ? "Writing" : "Reading the case"
}

function Said({ text, via }: { text: string; via?: ChatMessage["via"] }) {
  return (
    <div className="lc-person">
      <p>
        {text}
        {via === "voice" && (
          <span className="lc-via" title="Said aloud">
            <Icon name="mic" size={14} />
          </span>
        )}
      </p>
    </div>
  )
}

function AgentMsg({ m }: { m: ChatMessage }) {
  const [steps, setSteps] = useState(false)
  const n = m.toolSteps?.length ?? 0
  return (
    <div className="lc-msg">
      <AgentMark />
      <div className="lc-msg-body">
        <Paras text={m.text} />
        {n > 0 && (
          <button type="button" className="lc-how" aria-expanded={steps} onClick={() => setSteps((s) => !s)}>
            {steps ? (m.toolSteps ?? []).map((s) => s.label).join(". ") : n === 1 ? m.toolSteps![0].label : `${n} things read`}
          </button>
        )}
      </div>
    </div>
  )
}

/** The offer as the person's possible replies; after the yes, their words and the agent's one sentence. */
function Replies({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <>
        <Said text={offer.action.label} />
        <div className="lc-msg is-done" role="status">
          <AgentMark />
          <div className="lc-msg-body">
            <p>
              <strong>Decided{offer.at ? ` at ${offer.at}` : ""}.</strong> {offer.action.next ?? ""}
            </p>
          </div>
        </div>
      </>
    )
  const saving = offer.state === "saving"
  return (
    <div className="lc-replies">
      <OfferMessage offer={offer} />
      <button type="button" className="lc-reply is-yes" disabled={saving} onClick={onYes}>
        {saving ? "Sending" : offer.action.label}
      </button>
      <button type="button" className="lc-reply" disabled={saving} onClick={onNo}>
        Not now
      </button>
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}
