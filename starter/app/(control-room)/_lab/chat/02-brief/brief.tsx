"use client"

// chat 02: The brief. Intercom Copilot's panel shape: what the agent did as one plain sentence on
// top, a short "What the agent found", then the conversation; every answer ends with where it comes
// from, and the offer is a card that says what happens next, with the option's own button.

import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { andList, newsOf, runningWords, sourcesOf, stepSentence, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame, OfferMessage } from "../parts"
import "./brief.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }


const found = (steps: ChatToolStep[]) => steps.filter((s) => !/: none/.test(s.label))

function Source({ steps }: { steps: ChatToolStep[] }) {
  const src = sourcesOf(found(steps))
  // "From the order" alone says nothing the card does not.
  if (!src.length || (src.length === 1 && src[0] === "the order")) return null
  return <p className="lc-source">From {andList(src)}</p>
}

function StepLine({ steps }: { steps: ChatToolStep[] }) {
  if (!steps.length) return null
  if (steps.length === 1) return <p className="lc-stepline">{steps[0].label}</p>
  return (
    <details className="lc-stepline-more">
      <summary className="lc-stepline">
        <span>{stepSentence(steps)}</span>
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

export function BriefChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])

  return (
    <PanelFrame nn="02" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread ? (
          <>
            <section className="lc-brief" aria-label="What the agent found">
              <StepLine steps={thread.opener.toolSteps ?? []} />
              <h3>What the agent found</h3>
              <div className="lc-words">
                {newsOf(thread.opener.text).map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <Source steps={thread.opener.toolSteps ?? []} />
              <KindLine k={thread.knowledge} now={now} />
            </section>
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentTurn m={m} />
                  {core.offer?.after === m.id && <OfferCard offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <Person key={m.id} m={m} />
              ),
            )}
            {core.live && (
              <div className="lc-agent lc-live">
                <p className="lc-stepline is-live">
                  <AgentMark working />
                  <span className="lc-shimmer">{liveWords(core.live.steps, core.live.text)}</span>
                </p>
                {core.live.text && <Paras text={core.live.text} />}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <p className="lc-stepline is-live">
            <AgentMark working />
            <span className="lc-shimmer">Reading the case</span>
          </p>
        )}
      </div>
      <Composer core={core} thread={thread} open={open} placeholder="Ask about this order" />
    </PanelFrame>
  )
}

function liveWords(steps: ChatToolStep[], text: string) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  if (running) return runningWords(running.label)
  return text ? "Writing the answer" : steps.length ? "Writing the answer" : "Reading the case"
}

function AgentTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-agent">
      <StepLine steps={m.toolSteps ?? []} />
      <Paras text={m.text} />
      <Source steps={m.toolSteps ?? []} />
    </div>
  )
}

function Person({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-person">
      <p>{m.text}</p>
    </div>
  )
}

/** Who the option reaches: the draft's address, or the customer when the summary says so. */
const recipient = (o: Offer) => (o.action.draft ? `To ${o.action.draft.to}` : /customer/i.test(o.action.summary) ? "To the customer" : null)

/** The option as a card: what it does and what happens next, the option's own button, "Not now". */
function OfferCard({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  const a = offer.action
  const done = offer.state === "done"
  return (
    <div className={`lc-card${done ? " is-done" : ""}`} role={done ? "status" : undefined}>
      {done ? (
        <>
          <p className="lc-card-title">
            <Icon name="check" size={16} />
            Decided{offer.at ? ` at ${offer.at}` : ""}
          </p>
          <p className="lc-card-body">{offer.line}</p>
        </>
      ) : (
        <>
          {recipient(offer) && <p className="lc-card-kicker">{recipient(offer)}</p>}
          <p className="lc-card-title">{a.label}</p>
          {a.next && <p className="lc-card-body">Then {a.next.replace(/^The agent/, "the agent")}</p>}
          <OfferMessage offer={offer} />
          <div className="lc-card-foot">
            <button type="button" className="btn btn-plain" disabled={offer.state === "saving"} onClick={onNo}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" disabled={offer.state === "saving"} onClick={onYes}>
              {a.label}
            </button>
          </div>
          {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
        </>
      )}
    </div>
  )
}
