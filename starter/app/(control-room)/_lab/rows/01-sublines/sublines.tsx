"use client"

// rows 01: every row says what is inside on a grey second line, so most people never open one.
// Other tasks names the next one; opened, it shows five, then "Show all".

import Link from "next/link"
import { useState } from "react"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { useOtherTasks } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { useNeedsVariant, whyLine, type CaseRowsListProps } from "../shared/kit"
import "./sublines.css"

const FIRST = 5

/** Opened below the fold on a laptop: bring the opened row into view. */
const reveal = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
  const d = e.currentTarget
  if (!d.open) return
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  requestAnimationFrame(() => d.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" }))
}

export function SublineRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const needs = useNeedsVariant()
  return (
    <div className="rows work-rows lab-rows-01">
      {!missing && (
        <button ref={talkRef} type="button" className="row-link" aria-expanded={chatOpen} aria-controls="chat" onClick={onTalk}>
          <span className="row-text">
            <span className="m title">Talk it through</span>
            <span className="s sub">{thread ? knowledgeWords(thread.knowledge) : " "}</span>
          </span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      )}
      {whyTitle && why.length > 0 && (
        <details className="row" open={lab.why || undefined} onToggle={reveal}>
          <summary>
            <span className="r01-text">
              <span className="m title">{whyTitle}</span>
              <span className="s sub">{whyLine(why)}</span>
            </span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <Facts facts={why} />
          </div>
        </details>
      )}
      {needs ? <NeedsRow /> : <Others open={lab.others} />}
    </div>
  )
}

function Others({ open }: { open: boolean }) {
  const { rows, times, href, show } = useOtherTasks()
  const [all, setAll] = useState(false)
  if (!show || rows.length === 0) return null
  const next = rows[0]
  const t = times[next.caseId]
  const shown = all ? rows : rows.slice(0, FIRST)
  return (
    <details className="row r01-others" open={open || undefined} onToggle={reveal}>
      <summary>
        <span className="r01-text">
          <span className="m title">Other tasks</span>
          <span className={`s sub${t?.now ? " r01-now" : ""}`}>
            {next.vehicle} next{t ? `, ${t.text}` : ""}
          </span>
        </span>
        <span className="m r01-count num">{rows.length}</span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </summary>
      <div className="body">
        <ul className="rows-list">
          {shown.map((r) => {
            const rt = times[r.caseId]
            return (
              <li key={r.caseId}>
                <Link href={href(r.caseId)} className="wrow">
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {rt && <time className={rt.now ? "now" : undefined}>{rt.text}</time>}
                </Link>
              </li>
            )
          })}
        </ul>
        {rows.length > FIRST && !all && (
          <button type="button" className="r01-all" onClick={() => setAll(true)}>
            Show all {rows.length}
          </button>
        )}
      </div>
    </details>
  )
}
