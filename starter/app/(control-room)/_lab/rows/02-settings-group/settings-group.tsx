"use client"

// rows 02: the rows as one inset grouped list (Apple Settings): hairlines between, one open at a
// time inside the group, arrow keys between the headers (WAI-ARIA accordion).

import Link from "next/link"
import { useRef, useState } from "react"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { useOtherTasks } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { useNeedsVariant, whyLine, type CaseRowsListProps } from "../shared/kit"
import "./settings-group.css"

type Open = "why" | "others" | null

export function SettingsGroupRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const needs = useNeedsVariant()
  const { rows, times, href, show } = useOtherTasks()
  const [open, setOpen] = useState<Open>(lab.why ? "why" : lab.others ? "others" : null)
  const group = useRef<HTMLDivElement>(null)
  const others = !needs && show && rows.length > 0
  const toggle = (k: Exclude<Open, null>) => setOpen((o) => (o === k ? null : k))

  const onKey = (e: React.KeyboardEvent) => {
    const heads = [...(group.current?.querySelectorAll<HTMLButtonElement>(".r02-head") ?? [])]
    const at = heads.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const to = e.key === "ArrowDown" ? at + 1 : e.key === "ArrowUp" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? heads.length - 1 : null
    if (to === null) return
    e.preventDefault()
    e.stopPropagation()
    heads[(to + heads.length) % heads.length]?.focus()
  }

  return (
    <div className="work-rows lab-rows-02">
      <div className="r02-group" ref={group} onKeyDown={onKey}>
        {!missing && (
          <button ref={talkRef} type="button" className="r02-head" aria-expanded={chatOpen} aria-controls="chat" onClick={onTalk}>
            <span className="r02-text">
              <span className="r02-title">Talk it through</span>
              <span className="r02-sub">{thread ? knowledgeWords(thread.knowledge) : " "}</span>
            </span>
            <span className="r02-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
        )}
        {whyTitle && why.length > 0 && (
          <div className="r02-item">
            <button type="button" className="r02-head" aria-expanded={open === "why"} aria-controls="r02-why" onClick={() => toggle("why")}>
              <span className="r02-text">
                <span className="r02-title">{whyTitle}</span>
                {open !== "why" && <span className="r02-sub">{whyLine(why)}</span>}
              </span>
              <span className="r02-chev r02-turn">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
            {open === "why" && (
              <div className="r02-body" id="r02-why">
                <Facts facts={why} />
              </div>
            )}
          </div>
        )}
        {others && (
          <div className="r02-item">
            <button type="button" className="r02-head" aria-expanded={open === "others"} aria-controls="r02-others" onClick={() => toggle("others")}>
              <span className="r02-text">
                <span className="r02-title">Other tasks</span>
              </span>
              <span className="r02-count num">{rows.length}</span>
              <span className="r02-chev r02-turn">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
            {open === "others" && (
              <ul className="r02-list" id="r02-others">
                {rows.map((r) => {
                  const t = times[r.caseId]
                  return (
                    <li key={r.caseId}>
                      <Link href={href(r.caseId)} className="r02-task">
                        <span className="v">{r.vehicle}</span>
                        <span className="p">{r.place}</span>
                        {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      {needs && (
        <div className="rows r02-needs">
          <NeedsRow />
        </div>
      )}
    </div>
  )
}
