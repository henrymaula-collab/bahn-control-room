"use client"

// chat 03: The work as a live checklist. While the agent answers, each step it takes appears on a thin
// rail in its own words: done ones ticked, the running one at work, "Writing the answer" waiting last.
// Once the answer is in, the rail folds into "Read 2 things" one tap deep. After the yes, the same rail
// says what was done and what the agent does next.

import { useState } from "react"
import type { ChatMessage, ChatThread, ChatToolStep } from "@/lib/control-room/types-chat"
import { newsOf, runningWords, useChatCore, useFollow, type Offer } from "../core"
import { AgentMark, Composer, Icon, KindLine, Paras, PanelFrame } from "../parts"
import "./checklist.css"

type Props = { thread: ChatThread | null; personId: string; open: boolean; now: string; onClose: () => void }
type Row = { id: string; text: string; state: "done" | "running" | "waiting" | "failed" }

function Rail({ rows }: { rows: Row[] }) {
  return (
    <ol className="lc-rail">
      {rows.map((r) => (
        <li key={r.id} className={`is-${r.state}`}>
          <span className="lc-node" aria-hidden="true">
            {r.state === "done" && <Icon name="check" size={12} />}
            {r.state === "failed" && <Icon name="x" size={12} />}
          </span>
          <span className={`lc-row-text${r.state === "running" ? " lc-shimmer" : ""}`}>{r.text}</span>
          {r.state === "running" && <span className="sr-only">, working</span>}
        </li>
      ))}
    </ol>
  )
}

const things = (n: number) => (n === 1 ? "1 thing" : `${n} things`)

/** A finished answer's steps, folded: "Read 2 things", the rail one tap deep. */
function Folded({ steps }: { steps: ChatToolStep[] }) {
  const [open, setOpen] = useState(false)
  if (!steps.length)
    return (
      <p className="lc-by">
        <AgentMark />
      </p>
    )
  return (
    <div className="lc-fold">
      <button type="button" className="lc-by lc-fold-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <AgentMark />
        <span>Read {things(steps.length)}</span>
        <Icon name="chevron-right" size={14} />
      </button>
      {open && <Rail rows={steps.map((s) => ({ id: s.id, text: s.label, state: s.status === "failed" ? "failed" : "done" }))} />}
    </div>
  )
}

export function ChecklistChat({ thread, personId, open, now, onClose }: Props) {
  const core = useChatCore(thread, personId)
  const follow = useFollow([core.messages.length, core.live?.text, core.live?.steps.length, core.offer?.state])

  const liveRows = (steps: ChatToolStep[], text: string): Row[] => [
    ...steps.map<Row>((s) => ({ id: s.id, text: s.status === "running" ? runningWords(s.label) : s.label, state: s.status === "running" ? "running" : s.status === "failed" ? "failed" : "done" })),
    steps.length
      ? { id: "answer", text: "Writing the answer", state: steps.some((s) => s.status === "running") ? "waiting" : "running" }
      : { id: "answer", text: "Reading the case", state: "running" },
  ]

  return (
    <PanelFrame nn="03" open={open} onClose={onClose}>
      <div className="lc-log" ref={follow.ref} onScroll={follow.onScroll} role="log" aria-live="polite" aria-busy={!!core.live || !thread}>
        {thread ? (
          <>
            <div className="lc-agent">
              <Folded steps={thread.opener.toolSteps ?? []} />
              <div className="lc-words">
                {newsOf(thread.opener.text).map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
            </div>
            <KindLine k={thread.knowledge} now={now} />
            {core.messages.map((m) =>
              m.role === "agent" ? (
                <div key={m.id} className="lc-turn">
                  <AgentTurn m={m} />
                  {core.offer?.after === m.id && <OfferRows offer={core.offer} onYes={core.confirm} onNo={core.dismiss} />}
                </div>
              ) : (
                <div key={m.id} className="lc-person">
                  <p>{m.text}</p>
                </div>
              ),
            )}
            {core.live && (
              <div className="lc-agent lc-live">
                <Rail rows={liveRows(core.live.steps, core.live.text)} />
                {core.live.text && <Paras text={core.live.text} />}
              </div>
            )}
            {core.error && <p className="lc-error">{core.error}</p>}
          </>
        ) : (
          <div className="lc-agent lc-live">
            <Rail rows={liveRows([], "")} />
          </div>
        )}
      </div>
      <Composer core={core} thread={thread} open={open} />
    </PanelFrame>
  )
}

function AgentTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="lc-agent">
      <Folded steps={m.toolSteps ?? []} />
      <Paras text={m.text} />
    </div>
  )
}

/** The offer, then after the yes the rail again: what was done, what the agent does next. */
function OfferRows({ offer, onYes, onNo }: { offer: Offer; onYes: () => void; onNo: () => void }) {
  const a = offer.action
  if (offer.state === "done")
    return (
      <div className="lc-after" role="status">
        <Rail
          rows={[
            { id: "decided", text: `${a.label}: decided${offer.at ? ` at ${offer.at}` : ""}`, state: "done" },
            ...(a.next ? [{ id: "next", text: a.next, state: "waiting" as const }] : []),
          ]}
        />
      </div>
    )
  const saving = offer.state === "saving"
  return (
    <div className="lc-offer">
      <div className="lc-offer-buttons">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onYes}>
          {a.label}
        </button>
        <button type="button" className="btn btn-plain" disabled={saving} onClick={onNo}>
          Not now
        </button>
      </div>
      {offer.state === "failed" && <p className="lc-error">This was not saved. Nothing was sent or booked. Try again.</p>}
    </div>
  )
}
