"use client"

// chat 01: Two lines, then ask. The opener is the agent's own two sentences that matter (what is new,
// what the suggestion rests on); everything else it said is one tap away. Before the first question,
// two real questions sit under it as quiet rows that ask on a tap.

import { useState } from "react"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { runningWords, shortOpener, stepSentence, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame } from "../parts"
import "./two-lines.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

/** The pickup place the agent named, for the starter questions ("Calverona Hamburg"). */
function placeOf(t: ChatThread): string | null {
  const m = /what ([A-Z][\w-]*(?: [A-Z][\w-]*)*) said/.exec(t.opener.text) ?? /call with ([A-Z][\w-]*(?: [A-Z][\w-]*)*)/.exec((t.opener.toolSteps ?? []).map((s) => s.label).join(" "))
  return m ? m[1] : null
}

export function TwoLinesChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const [all, setAll] = useState(false)
  const short = thread ? shortOpener(thread.opener.text) : null
  const place = thread ? placeOf(thread) : null
  const starters = [
    place ? `How did earlier pickups at ${place} go?` : "How did earlier pickups at this place go?",
    "Who is the contact at the pickup place?",
  ]
  const asked = core.messages.some((m) => m.role === "person")

  return (
    <PanelFrame nn="01" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread && short ? (
          <>
            <div className="lc-opener">
              <p className="lc-by">
                <AgentMark />
                <span>{thread.knowledge.kindLabel}</span>
              </p>
              <div className="lc-lead">
                {short.lead.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              {short.rest.length > 0 && (
                <div className={`lc-rest${all ? " is-open" : ""}`}>
                  {all && (
                    <div className="lc-rest-body">
                      {short.rest.map((s) => (
                        <p key={s}>{s}</p>
                      ))}
                      <KindLine k={thread.knowledge} now={now} />
                    </div>
                  )}
                  <button type="button" className="lc-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>
                    {all ? "Less" : "Everything the agent said"}
                    <Icon name={all ? "chevron-up" : "chevron-right"} size={14} />
                  </button>
                </div>
              )}
            </div>
            {!asked && !core.live && (
              <ul className="lc-starters" aria-label="Ask">
                {starters.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => (follow.pin(), core.send(q))}>
                      <span>{q}</span>
                      <Icon name="arrow-up" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentTurn m={m} />
                  {core.offer?.after === m.id && <OfferRow offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <PersonTurn key={m.id} m={m} />
              ),
            )}
            {core.live && <LiveTurn steps={core.live.steps} text={core.live.text} />}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <LiveTurn steps={[]} text="" />
        )}
      </div>
      <Composer core={core} thread={thread} open={open} placeholder="Ask about this case" />
    </PanelFrame>
  )
}

function Steps({ steps, working }: { steps: ChatToolStep[]; working?: boolean }) {
  if (steps.length <= 1)
    return (
      <p className="lc-by">
        <AgentMark working={working} />
        {steps[0] && <span>{steps[0].status === "running" ? runningWords(steps[0].label) : steps[0].label}</span>}
      </p>
    )
  return (
    <details className="lc-steps">
      <summary className="lc-by">
        <AgentMark working={working} />
        <span className="lc-steps-sum">{stepSentence(steps)}</span>
        <Icon name="chevron-right" size={14} />
      </summary>
      <ul>
        {steps.map((s) => (
          <li key={s.id}>
            <Icon name="check" size={14} />
            {s.label}
          </li>
        ))}
      </ul>
    </details>
  )
}

function AgentTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-agent">
      <Steps steps={m.toolSteps ?? []} />
      <Paras text={m.text} />
    </div>
  )
}

function PersonTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-person">
      <p>
        {m.text}
        {m.via === "voice" && (
          <span className="lc-via" title="Said aloud">
            <Icon name="mic" size={14} />
          </span>
        )}
      </p>
    </div>
  )
}

/** The answer on its way: the mark breathes and says what it is doing now, in its own words. */
function LiveTurn({ steps, text }: { steps: ChatToolStep[]; text: string }) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  const doing = running ? runningWords(running.label) : steps.length ? "Writing the answer" : "Reading the case"
  return (
    <div className="lc-agent lc-live">
      <p className="lc-by">
        <AgentMark working />
        <span className={text && !running ? undefined : "lc-shimmer"}>{text && !running ? stepSentence(steps) || doing : doing}</span>
      </p>
      {text && <Paras text={text} />}
    </div>
  )
}

function OfferRow({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <div className="lc-done" role="status">
        <p className="lc-by">
          <Icon name="check" size={16} />
          <span>Decided{offer.at ? ` at ${offer.at}` : ""}</span>
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
