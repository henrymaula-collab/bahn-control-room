"use client"

// chat 07: The conversation as the case record. Every turn has who and when; what the agent looked
// at is an event line between the turns (Zendesk's "pre-approved action completed" line); the yes is
// the last event: who decided what, at what time, logged with this conversation as the reason. This is
// the pitch's loop on screen: the conversation, the decision and the reason are one record.

import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { newsOf, runningWords, stepSentence, turnTime, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame, OfferMessage } from "../parts"
import "./case-log.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

const nameOf = (personId: string) => {
  const id = personId.replace(/^p-/, "")
  return id ? id[0].toUpperCase() + id.slice(1) : "You"
}

function Event({ at, working, failed, children }: { at?: string; working?: boolean; failed?: boolean; children: React.ReactNode }) {
  return (
    <p className={`lc-event${working ? " is-working" : ""}`}>
      <span className="lc-event-icon" aria-hidden="true">
        {working ? <span className="lc-spin" /> : <Icon name={failed ? "x" : "check"} size={14} />}
      </span>
      <span className="lc-event-text">{children}</span>
      {at && <time>{at}</time>}
    </p>
  )
}

function Entry({ who, at, agent, working, children }: { who: string; at?: string; agent?: boolean; working?: boolean; children: React.ReactNode }) {
  return (
    <div className={`lc-entry${agent ? " is-agent" : " is-person"}`}>
      <p className="lc-entry-head">
        {agent ? <AgentMark working={working} /> : <span className="lc-initial" aria-hidden="true">{who[0]}</span>}
        <span className="lc-name">{who}</span>
        {at && <time>{at}</time>}
      </p>
      <div className="lc-entry-body">{children}</div>
    </div>
  )
}

const stepsEvent = (steps: ChatToolStep[]) => (steps.length ? `The agent ${lowerFirst(stepSentence(steps))}` : null)
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

export function CaseLogChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const me = nameOf(personId)
  const all = thread ? [thread.opener, ...core.messages] : []
  const time = (m: ChatMessage) => turnTime(m, now, all.indexOf(m), all.length + 1)

  return (
    <PanelFrame nn="07" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread ? (
          <>
            {stepsEvent(thread.opener.toolSteps ?? []) && <Event at={time(thread.opener)}>{stepsEvent(thread.opener.toolSteps ?? [])}</Event>}
            <Entry who="Agent" agent>
              <div className="lc-words">
                {newsOf(thread.opener.text).map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <KindLine k={thread.knowledge} now={now} />
            </Entry>
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  {stepsEvent(m.toolSteps ?? []) && <Event>{stepsEvent(m.toolSteps ?? [])}</Event>}
                  <Entry who="Agent" at={time(m)} agent>
                    <Paras text={m.text} />
                  </Entry>
                  {core.offer?.after === m.id && <OfferEntry offer={core.offer} me={me} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <Entry key={m.id} who={me} at={time(m)}>
                  <p>
                    {m.text}
                    {m.via === "voice" && (
                      <span className="lc-via" title="Said aloud">
                        <Icon name="mic" size={14} />
                      </span>
                    )}
                  </p>
                </Entry>
              ),
            )}
            {core.live && (
              <div className="lc-turn">
                {core.live.steps.map((s) => (
                  <Event key={s.id} working={s.status === "running"} failed={s.status === "failed"}>
                    {s.status === "running" ? <span className="lc-shimmer">{runningWords(s.label)}</span> : `The agent ${lowerFirst(s.label)}`}
                  </Event>
                ))}
                {core.live.text ? (
                  <Entry who="Agent" agent working>
                    <Paras text={core.live.text} />
                  </Entry>
                ) : (
                  !core.live.steps.length && (
                    <Event working>
                      <span className="lc-shimmer">Reading the case</span>
                    </Event>
                  )
                )}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <Event working>
            <span className="lc-shimmer">Reading the case</span>
          </Event>
        )}
      </div>
      <Composer core={core} thread={thread} open={open} placeholder="Ask, and it goes in the record" />
    </PanelFrame>
  )
}

/** The offer, then the decision as the record's last event: who, what, when, with what reason. */
function OfferEntry({ offer, me, onYes, onNo }: { offer: Offer; me: string; onYes: () => void; onNo: () => void }) {
  if (offer.state === "done")
    return (
      <div className="lc-decision" role="status">
        <p className="lc-decision-head">
          <span className="lc-event-icon" aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
          <span>
            {me} decided: {offer.action.label}
          </span>
          {offer.at && <time>{offer.at}</time>}
        </p>
        <p className="lc-decision-body">Logged with this conversation as the reason.{offer.action.next ? ` Next: ${lowerFirst(offer.action.next)}` : ""}</p>
      </div>
    )
  const saving = offer.state === "saving"
  return (
    <div className="lc-offer">
      <OfferMessage offer={offer} />
      <div className="lc-offer-buttons">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onYes}>
          {offer.action.label}
        </button>
        <button type="button" className="btn btn-plain" disabled={saving} onClick={onNo}>
          Not now
        </button>
      </div>
      <p className="lc-offer-note">Your yes is logged with this conversation as the reason.</p>
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}
