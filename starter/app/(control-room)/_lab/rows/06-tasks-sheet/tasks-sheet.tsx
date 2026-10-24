"use client"

// rows 06: Other tasks opens a sheet in the same language as Other options (one sheet at a time):
// a filter field once there are more than eight, the tasks by decide-by, arrows and Enter.

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { useOtherTasks } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import { useNeedsVariant, type CaseRowsListProps } from "../shared/kit"
import "./tasks-sheet.css"

const FILTER_FROM = 9

export function TasksSheetRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const needs = useNeedsVariant()
  return (
    <div className="rows work-rows lab-rows-06">
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
        <details className="row" open={lab.why || undefined}>
          <summary>
            <span className="m title">{whyTitle}</span>
            <span className="chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </summary>
          <div className="body">
            <Facts facts={why} />
          </div>
        </details>
      )}
      {needs ? <NeedsRow /> : <OthersSheet start={lab.others} />}
    </div>
  )
}

function OthersSheet({ start }: { start: boolean }) {
  const { rows, times, href, show } = useOtherTasks()
  const [open, setOpen] = useState(start)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase()
    if (!words) return rows
    return rows.filter((r) => `${r.vehicle} ${r.place} ${r.orderId}`.toLowerCase().includes(words))
  }, [rows, q])

  if (!show || rows.length === 0) return null
  const close = () => (setOpen(false), setQ(""), trigger.current?.focus())

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return
    const links = [...(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])]
    if (!links.length) return
    e.preventDefault()
    const at = links.indexOf(document.activeElement as HTMLAnchorElement)
    const to = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : at < 0 ? 0 : Math.min(links.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))
    links[to].focus()
    links[to].scrollIntoView({ block: "nearest" })
  }

  return (
    <>
      <button ref={trigger} type="button" className="row-link r06-row" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="row-text">
          <span className="m title">Other tasks</span>
        </span>
        <span className="m r06-count num">{rows.length}</span>
        <span className="chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      <dialog ref={ref} className="sheet lab-rows-06 r06-sheet" aria-label="Other tasks" onClose={() => (setOpen(false), setQ(""))} onClick={(e) => e.target === ref.current && close()} onKeyDown={onKey}>
        <div className="sheet-head">
          <span />
          <span className="m title">Other tasks</span>
          <button type="button" className="btn btn-plain btn-small end" onClick={close}>
            Done
          </button>
        </div>
        {rows.length >= FILTER_FROM && (
          <div className="r06-find">
            <input className="text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a car, place or order" aria-label="Find a task" autoFocus />
          </div>
        )}
        <ul className="r06-list" ref={list}>
          {shown.map((r) => {
            const t = times[r.caseId]
            return (
              <li key={r.caseId}>
                <Link href={href(r.caseId)} className="r06-task" onClick={() => setOpen(false)}>
                  <span className="v">{r.vehicle}</span>
                  <span className="p">{r.place}</span>
                  {t && <time className={t.now ? "now" : undefined}>{t.text}</time>}
                </Link>
              </li>
            )
          })}
          {shown.length === 0 && <li className="r06-none">No task matches &ldquo;{q}&rdquo;.</li>}
        </ul>
      </dialog>
    </>
  )
}
