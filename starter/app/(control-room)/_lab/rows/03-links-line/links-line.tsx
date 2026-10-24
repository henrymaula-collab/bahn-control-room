"use client"

// rows 03: no rows. One quiet line of text buttons under the card: Talk it through, Why it came
// to you (the kind line inside it), Other tasks N. Why and Other tasks open as popovers anchored to
// their word; one at a time; they open upward when the window has no room below.

import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { useOtherTasks } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { useNeedsVariant, type CaseRowsListProps } from "../shared/kit"
import "./links-line.css"

type Open = "why" | "others" | null

export function LinksLineRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const needs = useNeedsVariant()
  const { rows, times, href, show } = useOtherTasks()
  const [open, setOpen] = useState<Open>(lab.why ? "why" : lab.others ? "others" : null)
  const [up, setUp] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const others = !needs && show && rows.length > 0
  const hasWhy = !!whyTitle && why.length > 0

  // Room below the line? Henry's Safari window is 544 CSS px tall: often not, so it opens upward.
  useLayoutEffect(() => {
    if (!open) return
    const r = box.current?.getBoundingClientRect()
    if (r) setUp(window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(null)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(null))
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => (document.removeEventListener("pointerdown", onDown), window.removeEventListener("keydown", onKey, true))
  }, [open])

  const toggle = (k: Exclude<Open, null>) => setOpen((o) => (o === k ? null : k))

  return (
    <div className="work-rows lab-rows-03">
      <div className="r03-line" ref={box}>
        {!missing && (
          <button ref={talkRef} type="button" className="r03-btn r03-talk" aria-expanded={chatOpen} aria-controls="chat" onClick={onTalk}>
            Talk it through
          </button>
        )}
        {hasWhy && (
          <button type="button" className="r03-btn" aria-expanded={open === "why"} aria-controls="r03-why" onClick={() => toggle("why")}>
            {whyTitle}
            <Icon name={open === "why" ? "chevron-up" : "chevron-down"} size={16} />
          </button>
        )}
        {others && (
          <button type="button" className="r03-btn" aria-expanded={open === "others"} aria-controls="r03-others" onClick={() => toggle("others")}>
            {rows.length} other {rows.length === 1 ? "task" : "tasks"}
            <Icon name={open === "others" ? "chevron-up" : "chevron-down"} size={16} />
          </button>
        )}

        {open === "why" && hasWhy && (
          <div className={`r03-pop${up ? " r03-up" : ""}`} id="r03-why" role="dialog" aria-label={whyTitle}>
            <p className="r03-pop-title">{whyTitle}</p>
            <Facts facts={why} />
            {thread && <p className="r03-kindline">{knowledgeWords(thread.knowledge)}</p>}
          </div>
        )}
        {open === "others" && others && (
          <div className={`r03-pop r03-tasks${up ? " r03-up" : ""}`} id="r03-others" role="dialog" aria-label="Other tasks">
            <p className="r03-pop-title">Other tasks</p>
            <ul className="r03-list">
              {rows.map((r) => {
                const t = times[r.caseId]
                return (
                  <li key={r.caseId}>
                    <Link href={href(r.caseId)} className="r03-task" onClick={() => setOpen(null)}>
                      <span className="v">{r.vehicle}</span>
                      <span className="p">{r.place}</span>
                      {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
      {needs && (
        <div className="rows r03-needs">
          <NeedsRow />
        </div>
      )}
    </div>
  )
}
