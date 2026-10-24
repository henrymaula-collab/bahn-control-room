"use client"

// rows 07: Talk it through speaks first. The row carries the agent's mark and the first sentence of
// its own opener, so the conversation invites itself; Why it came to you ends with how far this
// kind is from the agent offering to handle it alone, so the loop shows on every case.

import { gateWords, knowledgeWords } from "@/lib/control-room/chat-words"
import { AgentMark } from "../../../_ui/agent-mark"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { useLab } from "../../context"
import { openerLine, type CaseRowsListProps } from "../shared/kit"
import "./agent-preview.css"

export function AgentPreviewRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const quote = thread ? openerLine(thread.opener.text) : ""
  // RV7: when the quote already says the kind is new, the kind line ("New kind of case") would say it twice.
  const saysNew = /^(This has not happened|Nobody)/.test(quote)
  return (
    <div className="rows work-rows lab-rows-07">
      {!missing && (
        <button ref={talkRef} type="button" className="row-link r07-talk" aria-expanded={chatOpen} aria-controls="chat" onClick={onTalk}>
          <span className="r07-mark">
            <AgentMark size={30} />
          </span>
          <span className="r07-text">
            <span className="r07-head">
              <span className="m title">Talk it through</span>
              {!saysNew && <span className="s r07-kind">{thread ? knowledgeWords(thread.knowledge) : ""}</span>}
            </span>
            <span className="r07-quote">{quote ? `“${quote}”` : " "}</span>
          </span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      )}
      {whyTitle && why.length > 0 && (
        <details className="row" open={lab.why || undefined}>
          <summary>
            <span className="m title">{whyTitle}</span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <Facts facts={why} />
            {thread && <p className="s r07-gate">{gateWords(thread.knowledge)}</p>}
          </div>
        </details>
      )}
      <NeedsRow />
    </div>
  )
}
