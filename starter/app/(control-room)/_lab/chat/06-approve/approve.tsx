"use client"

// chat 06: The offer takes the field's place. When the agent offers to carry out the case's option,
// an approval card stands where the field was (Zendesk auto assist), with the keys on it (Claude in
// Chrome): Enter does it, Esc says not now. One line says what the agent never does alone. After the
// yes, the decision goes into the conversation as one line and the field comes back.

import { useEffect, useRef } from "react"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { runningWords, shortOpener, stepSentence, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame, OfferMessage } from "../parts"
import "./approve.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

function Byline({ steps, working }: { steps: ChatToolStep[]; working?: boolean }) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  return (
    <p className="lc-by">
      <AgentMark working={working} />
      <span className={working ? "lc-shimmer" : undefined}>{running ? runningWords(running.label) : working ? (steps.length ? "Writing the answer" : "Reading the case") : stepSentence(steps)}</span>
    </p>
  )
}

export function ApproveChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const asking = core.offer && core.offer.state !== "done" ? core.offer : null
  const done = core.offer?.state === "done" ? core.offer : null

  return (
    <PanelFrame nn="06" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread ? (
          <>
            <div className="lc-agent">
              <Byline steps={thread.opener.toolSteps ?? []} />
              <div className="lc-words">
                {shortOpener(thread.opener.text).lead.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
            </div>
            <KindLine k={thread.knowledge} now={now} />
            {core.messages.map((m: ChatMessage) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <div className="lc-agent">
                    <Byline steps={m.toolSteps ?? []} />
                    <Paras text={m.text} />
                  </div>
                  {done && done.after === m.id && (
                    <p className="lc-decided" role="status">
                      <Icon name="check" size={16} />
                      <span>
                        <strong>Decided{done.at ? ` at ${done.at}` : ""}.</strong> {done.line}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div key={m.id} className="lc-person">
                  <p>{m.text}</p>
                </div>
              ),
            )}
            {core.live && (
              <div className="lc-agent">
                <Byline steps={core.live.steps} working />
                {core.live.text && <Paras text={core.live.text} />}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <Byline steps={[]} working />
        )}
      </div>
      {asking ? <Approval offer={asking} onYes={core.confirm} onNo={core.dismiss} /> : <Composer core={core} thread={thread} open={open} />}
    </PanelFrame>
  )
}

/** The approval card in the field's place: Enter does it, Esc says not now. */
function Approval({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  const yes = useRef<HTMLButtonElement>(null)
  const saving = offer.state === "saving"
  useEffect(() => {
    yes.current?.focus({ preventScroll: true })
  }, [offer.after])
  return (
    <div
      className="lc-approve"
      role="group"
      aria-label="The agent's offer"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Not now: the field comes back; the panel stays open.
          e.preventDefault()
          e.stopPropagation()
          onNo()
        }
      }}
    >
      <p className="lc-approve-title">
        <AgentMark />
        {offer.action.label}?
      </p>
      {offer.action.next && <p className="lc-approve-next">Then {offer.action.next.replace(/^The agent/, "the agent")}</p>}
      <OfferMessage offer={offer} />
      <button ref={yes} type="button" className="lc-choice is-yes" disabled={saving} onClick={onYes}>
        <span>{saving ? "Saving" : offer.action.label}</span>
        <kbd aria-label="Enter">↵</kbd>
      </button>
      <button type="button" className="lc-choice" disabled={saving} onClick={onNo}>
        <span>Not now</span>
        <kbd>esc</kbd>
      </button>
      <p className="lc-approve-limit">
        {offer.state === "failed" ? "This was not saved. Nothing was sent or booked. Try again." : "The agent never contacts a customer on its own. Nothing is sent before you choose."}
      </p>
    </div>
  )
}
