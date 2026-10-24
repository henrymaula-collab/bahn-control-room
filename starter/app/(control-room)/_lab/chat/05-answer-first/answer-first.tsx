"use client"

// chat 05: The answer in one line. No bubbles: the person's question is a small grey line, the
// agent's first sentence is the answer in ink at headline weight, and the rest of what it said sits
// in grey under it, folded after three lines. An expert reads the bold lines and decides; anyone
// can open the rest. Where the answer comes from is one tap under it.

import { useState } from "react"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { lcFirst } from "@/lib/control-room/format"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { linesOf, runningWords, sentencesOf, shortOpener, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, PanelFrame } from "../parts"
import "./answer-first.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }

/** The first sentence, and the rest with its paragraphs kept. */
function split(text: string): { lead: string; rest: string[] } {
  const paras = linesOf(text)
  if (!paras.length) return { lead: "", rest: [] }
  const first = sentencesOf(paras[0])
  const lead = first[0] ?? paras[0]
  const tail = paras[0].slice(paras[0].indexOf(lead) + lead.length).trim()
  return { lead, rest: [tail, ...paras.slice(1)].filter(Boolean) }
}

function Answer({ lead, rest, steps, children }: { lead: string; rest: string[]; steps?: ChatToolStep[]; children?: React.ReactNode }) {
  const [more, setMore] = useState(false)
  const [src, setSrc] = useState(false)
  const long = rest.join(" ").length > 170 || rest.length > 1
  return (
    <div className="lc-answer">
      <p className="lc-lead">{lead}</p>
      {rest.length > 0 && (
        <div className={`lc-rest${long && !more ? " is-clamped" : ""}`}>
          {rest.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <div className="lc-links">
        {long && (
          <button type="button" className="lc-link" aria-expanded={more} onClick={() => setMore((m) => !m)}>
            {more ? "Less" : "More"}
            <Icon name={more ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        )}
        {steps && steps.length > 0 && (
          <button type="button" className="lc-link" aria-expanded={src} onClick={() => setSrc((s) => !s)}>
            Where this comes from
            <Icon name={src ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        )}
      </div>
      {src && steps && (
        <ul className="lc-src">
          {steps.map((s) => (
            <li key={s.id}>{s.label}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  )
}

export function AnswerFirstChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])
  const opener = thread ? shortOpener(thread.opener.text) : null

  return (
    <PanelFrame nn="05" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread && opener ? (
          <>
            <section className="lc-x">
              <p className="lc-q">
                <AgentMark />
                {thread.knowledge.kindLabel}, {lcFirst(knowledgeWords(thread.knowledge))}
              </p>
              <Answer lead={opener.lead[0] ?? ""} rest={[...opener.lead.slice(1), ...opener.rest]} steps={thread.opener.toolSteps}>
                {thread.knowledge.precedents.length > 0 && <KindLine k={thread.knowledge} now={now} />}
              </Answer>
            </section>
            {exchanges(core.messages).map(({ q, a }) => (
              <section key={(q ?? a)!.id} className="lc-x">
                {q && <p className="lc-q">{q.text}</p>}
                {a && <AgentAnswer m={a} offer={core.offer?.after === a.id ? core.offer : null} onYes={core.confirm} onNo={core.dismiss} />}
                {!a && q && core.live && q === core.messages[core.messages.length - 1] && <LiveAnswer steps={core.live.steps} text={core.live.text} />}
              </section>
            ))}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <p className="lc-doing lc-shimmer">Reading the case</p>
        )}
      </div>
      <Composer core={core} thread={thread} open={open} />
    </PanelFrame>
  )
}

/** Pairs: each question with the answer that follows it. */
function exchanges(ms: ChatMessage[]) {
  const out: { q?: ChatMessage; a?: ChatMessage }[] = []
  for (const m of ms) {
    if (m.role === "person") out.push({ q: m })
    else if (out.length && !out[out.length - 1].a) out[out.length - 1].a = m
    else out.push({ a: m })
  }
  return out
}

function AgentAnswer({ m, offer, onYes, onNo }: { m: ChatMessage; offer: Offer | null; onYes: () => void; onNo: () => void }) {
  const { lead, rest } = split(m.text)
  return (
    <>
      <Answer lead={lead} rest={rest} steps={m.toolSteps}>
        {offer && offer.state !== "done" && (
          <div className="lc-offer">
            <div className="lc-offer-buttons">
              <button type="button" className="btn btn-primary" disabled={offer.state === "saving"} onClick={onYes}>
                {offer.action.label}
              </button>
              <button type="button" className="btn btn-plain" disabled={offer.state === "saving"} onClick={onNo}>
                Not now
              </button>
            </div>
            {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
          </div>
        )}
      </Answer>
      {offer?.state === "done" && (
        <div className="lc-answer lc-decided" role="status">
          <p className="lc-lead">
            <Icon name="check" size={18} />
            Decided{offer.at ? ` at ${offer.at}` : ""}.
          </p>
          <div className="lc-rest">
            <p>{offer.line}</p>
          </div>
        </div>
      )}
    </>
  )
}

function LiveAnswer({ steps, text }: { steps: ChatToolStep[]; text: string }) {
  const running = [...steps].reverse().find((s) => s.status === "running")
  const { lead, rest } = split(text)
  return (
    <div className="lc-answer lc-live">
      {lead && <p className="lc-lead">{lead}</p>}
      {rest.length > 0 && (
        <div className="lc-rest">
          {rest.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <p className="lc-doing">
        <AgentMark working />
        <span className="lc-shimmer">{running ? runningWords(running.label) : text ? "Writing the answer" : "Reading the case"}</span>
      </p>
    </div>
  )
}
