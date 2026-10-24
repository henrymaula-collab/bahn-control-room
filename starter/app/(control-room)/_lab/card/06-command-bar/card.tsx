"use client"

// card 06: keyboard first, for the person who decides forty of these a shift (Raycast's action
// panel: the first action on Return, every action in one list on Cmd+K with its key on the right).

import { useEffect, useRef, useState } from "react"
import type { Option } from "@/lib/control-room/types"
import { Keep } from "../../../_ui/text"
import { CardDone, CardTail, Due, sentences, useCard, type CardProps } from "../shared/kit"
import "../shared/kit.css"
import "./card.css"

type Item = { id: string; title: string; sub?: string; keys?: string; run: () => void }

const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable], dialog")

export function CommandBar(props: CardProps) {
  const q = useCard(props)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const more = useRef<HTMLButtonElement>(null)
  const cmd = mac() ? "⌘" : "Ctrl "

  const pick = (o: Option) => (setOpen(false), q.choose(o))
  const items: Item[] = [
    { id: props.suggestion.id, title: q.answer, sub: sentences(props.next ?? props.suggestion.effect)[0], keys: `${cmd}↵`, run: () => pick(props.suggestion) },
    ...props.alternatives.map((o) => ({ id: o.id, title: o.label, sub: sentences(o.effect)[0], run: () => pick(o) })),
    { id: "chat", title: "Talk it through with the agent", run: () => (setOpen(false), q.panel.setOpen("chat")) },
    { id: "situation", title: "Show the situation", run: () => (setOpen(false), q.panel.setOpen("situation")) },
  ]

  // Cmd+Return answers with the default; Cmd+K shows every action (Raycast; Primer: no single-letter keys).
  const { onPrimary, pending, done } = q
  useEffect(() => {
    if (done) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || typing(e.target)) return
      if (e.key === "Enter" && !pending) {
        e.preventDefault()
        setOpen(false)
        onPrimary()
      }
      if (e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [done, pending, onPrimary])

  useEffect(() => {
    if (!open) return
    setAt(0)
    list.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !more.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  if (q.done) return <CardDone props={props} q={q} />

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setAt((i) => Math.min(items.length - 1, i + 1)))
    else if (e.key === "ArrowUp") (e.preventDefault(), setAt((i) => Math.max(0, i - 1)))
    else if (e.key === "Home") (e.preventDefault(), setAt(0))
    else if (e.key === "End") (e.preventDefault(), setAt(items.length - 1))
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) (e.preventDefault(), items[at]?.run())
    else if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), setOpen(false), more.current?.focus())
  }

  return (
    <section className="lab-card lab-card-06" aria-labelledby={`q-${props.caseId}`}>
      <Due due={props.due} />
      <h1 className="lc-what c06-what" id={`q-${props.caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="lc-ask c06-ask">{q.ask}</p>
      <div className="c06-bar">
        <button
          ref={q.primary}
          type="button"
          className="btn btn-primary"
          disabled={q.pending}
          aria-keyshortcuts="Meta+Enter Control+Enter"
          aria-expanded={q.preview ? q.panel.open === "email" : undefined}
          aria-controls={q.preview ? "email" : undefined}
          onClick={q.onPrimary}
        >
          {q.answer}
          <span className="c06-keys" aria-hidden="true">
            {cmd}↵
          </span>
        </button>
        <button
          ref={more}
          type="button"
          className="btn btn-plain"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-keyshortcuts="Meta+K Control+K"
          disabled={q.pending}
          onClick={() => setOpen((o) => !o)}
        >
          Other options
          <span className="c06-keys" aria-hidden="true">
            {cmd}K
          </span>
        </button>
        {open && (
          <div
            ref={list}
            className="c06-panel"
            role="listbox"
            tabIndex={-1}
            aria-label="Every action"
            aria-activedescendant={`c06-${items[at]?.id}`}
            onKeyDown={onListKey}
          >
            {items.map((it, i) => (
              <div
                key={it.id}
                id={`c06-${it.id}`}
                role="option"
                aria-selected={i === at}
                className={`c06-item${i === at ? " on" : ""}${i === props.alternatives.length ? " last-option" : ""}`}
                onPointerEnter={() => setAt(i)}
                onClick={it.run}
              >
                <span className="c06-text">
                  <span className="c06-title">{it.title}</span>
                  {it.sub && <span className="c06-sub">{it.sub}</span>}
                </span>
                <span className="c06-right">{i === at ? (it.keys ?? "↵") : (it.keys ?? "")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {props.next && <p className="lc-next c06-next">{props.next}</p>}
      <CardTail props={props} q={q} />
    </section>
  )
}
