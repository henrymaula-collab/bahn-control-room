"use client"

// Shared markup for the `chat` variants. Unstyled on purpose: every class here is styled only under a
// variant's root (.lab-chat-NN ...), so each variant gives the same parts its own look.

import { knowledgeWords, gateWords } from "@/lib/control-room/chat-words"
import { day, onDay } from "@/lib/control-room/format"
import type { CaseKnowledge, ChatThread } from "@/lib/control-room/types-chat"
import { AgentMark } from "../../_ui/agent-mark"
import { Icon } from "../../_ui/icons"
import type { Voice } from "../../_ui/use-voice"
import { VoiceButton } from "../../_ui/voice-button"
import { linesOf, useField, type ChatCore } from "./core"
import "./base.css"

/** The agent's words, one paragraph per line it wrote. */
export function Paras({ text, className = "lc-words" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {linesOf(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

/** The panel's frame: the same side panel as today (slides in, one at a time), a head, then the variant. */
export function PanelFrame({
  nn,
  open,
  onClose,
  title = "Talk it through",
  className = "",
  children,
  head,
}: {
  nn: string
  open: boolean
  onClose: () => void
  title?: string
  className?: string
  children: React.ReactNode
  head?: React.ReactNode
}) {
  return (
    <aside
      id="chat"
      className={`panel chat-panel lab-chat-base lab-chat-${nn}${open ? " open" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Talk it through"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="panel-head lc-head">
        {head ?? <h2 className="m strong">{title}</h2>}
        <button type="button" className="close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {children}
    </aside>
  )
}

/** The field: type, talk, send. */
export function Composer({
  core,
  thread,
  open,
  placeholder = "Ask about this case",
  className = "lc-composer",
  withVoice = true,
  voice,
}: {
  core: ChatCore
  thread: ChatThread | null
  open: boolean
  placeholder?: string
  className?: string
  withVoice?: boolean
  voice?: Voice
}) {
  const field = useField((t) => core.send(t, "text"), open)
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        field.submit()
      }}
    >
      <textarea {...field.props} placeholder={placeholder} aria-label="Ask the agent about this case" />
      {withVoice && <VoiceButton voice={voice} onTranscript={(t) => core.send(t, "voice")} speak={core.speak} disabled={!thread} showState={false} />}
      <button type="submit" className="lc-send" disabled={!thread || !field.draft.trim() || !!core.live} aria-label="Send">
        <Icon name="arrow-up" size={18} />
      </button>
    </form>
  )
}

const dayWords = (iso: string, now: string) => {
  const d = onDay(iso, now)
  return d === "today" ? "Today" : d === "yesterday" ? "Yesterday" : day(iso)
}

/** Where this kind of case stands ("New kind of case", "2 of 16, 2 people"); the earlier answers one tap deep. */
export function KindLine({ k, now, className = "lc-kind" }: { k: CaseKnowledge; now: string; className?: string }) {
  if (!k.precedents.length)
    return (
      <p className={className}>
        <span className="lc-kind-label">{k.kindLabel}</span>
        <span className="lc-kind-state">{knowledgeWords(k)}</span>
      </p>
    )
  return (
    <details className={`${className} lc-kind-more`}>
      <summary>
        <span className="lc-kind-label">{k.kindLabel}</span>
        <span className="lc-kind-state">
          {knowledgeWords(k)}
          <Icon name="chevron-right" size={14} />
        </span>
      </summary>
      <ul className="lc-precedents">
        {k.precedents.map((p) => (
          <li key={`${p.caseId}-${p.at}`}>
            <p className="lc-p-who">
              {p.decidedBy}, {dayWords(p.at, now)}, {p.place}
            </p>
            <p className="lc-p-choice">{p.choice}</p>
            {p.why && <p className="lc-p-why">“{p.why}”</p>}
          </li>
        ))}
      </ul>
      <p className="lc-gate">{gateWords(k)}</p>
    </details>
  )
}

export { AgentMark, Icon }
