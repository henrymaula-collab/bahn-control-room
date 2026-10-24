"use client"

// rows 05: one panel at a time. Why it came to you and Other options open as the side panel, the
// way Talk it through opens the conversation: no scrim, the card stays readable beside them.
// The panel lies over the situation; closing it shows the situation again.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { knowledgeWords } from "@/lib/control-room/chat-words"
import { languageName } from "@/lib/control-room/format"
import type { Option } from "@/lib/control-room/types"
import { Icon } from "../../../_ui/icons"
import { Facts, NeedsRow } from "../../../_ui/work-case"
import { usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import type { CaseRowsListProps, OptionsSheetProps } from "../shared/kit"
import "./panels.css"

// The two panels of this variant close each other (they live in different components).
const EVENT = "lab-rows-05-panel"
const announce = (who: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: who }))
function useOnlyOne(me: string, close: () => void) {
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<string>).detail !== me && close()
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [me, close])
}
function useEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === "Escape" && !(e.target as HTMLElement).closest("input, textarea") && (e.stopPropagation(), close())
    window.addEventListener("keydown", on, true)
    return () => window.removeEventListener("keydown", on, true)
  }, [open, close])
}

function Panel({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const { slot } = usePanel()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => ref.current?.focus(), [])
  if (!slot) return null
  return createPortal(
    <aside ref={ref} className="panel open lab-rows-05 r05-panel" aria-label={label} tabIndex={-1}>
      <div className="panel-head">
        <h2 className="m strong">{label}</h2>
        <button type="button" className="close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      {children}
    </aside>,
    slot,
  )
}

export function PanelRows({ thread, missing, why, whyTitle, chatOpen, onTalk, talkRef }: CaseRowsListProps) {
  const lab = useLab()
  const [open, setOpen] = useState(lab.why)
  const whyRef = useRef<HTMLButtonElement>(null)
  const [close] = useState(() => () => setOpen(false))
  useOnlyOne("why", close)
  useEscape(open, () => (setOpen(false), whyRef.current?.focus()))
  // The conversation is a panel too: opening it closes this one, and the other way round.
  useEffect(() => {
    if (chatOpen) setOpen(false)
  }, [chatOpen])

  const toggleWhy = () => {
    if (!open) {
      announce("why")
      if (chatOpen) onTalk()
    }
    setOpen((o) => !o)
  }

  return (
    // A click on the other tasks row (today's, or a needs variant's such as needs 11, whose list
    // panel sits in the same place) closes this variant's panels, so the list is never hidden under one.
    <div className="rows work-rows lab-rows-05" onClickCapture={(e) => !(e.target as HTMLElement).closest("[data-r05-own]") && announce("rows")}>
      {!missing && (
        <button ref={talkRef} data-r05-own="" type="button" className="row-link" aria-expanded={chatOpen} aria-controls="chat" onClick={() => (announce("chat"), onTalk())}>
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
        <button ref={whyRef} data-r05-own="" type="button" className="row-link" aria-expanded={open} onClick={toggleWhy}>
          <span className="row-text">
            <span className="m title">{whyTitle}</span>
          </span>
          <span className="chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      )}
      <NeedsRow />
      {open && whyTitle && (
        <Panel label={whyTitle} onClose={() => (setOpen(false), whyRef.current?.focus())}>
          <div className="r05-body">
            <Facts facts={why} />
          </div>
        </Panel>
      )}
    </div>
  )
}

export function PanelOptions({ open, onClose, options, draftOf, whyChoices, leadName, pending, error, onDecide }: OptionsSheetProps) {
  const [chosen, setChosen] = useState<Option | null>(options.length === 1 ? options[0] : null)
  const [writing, setWriting] = useState(false)
  const [own, setOwn] = useState("")
  const panel = usePanel()
  const close = useRef(() => {})
  close.current = () => {
    onClose()
    setChosen(options.length === 1 ? options[0] : null)
    setWriting(false)
    setOwn("")
  }
  const [stable] = useState(() => () => close.current())
  useOnlyOne("options", stable)
  useEscape(open, stable)
  useEffect(() => {
    if (!open) return
    announce("options")
    if (panel.open === "chat" || panel.open === "email") panel.setOpen(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  if (!open) return null

  const draft = chosen ? draftOf(chosen) : undefined
  const reasons = chosen ? whyChoices(chosen) : []
  return (
    <Panel label={chosen ? "Why this instead?" : "Other options"} onClose={stable}>
      {!chosen ? (
        <div className="r05-options">
          {options.map((o) => (
            <button key={o.id} type="button" className="r05-option" onClick={() => setChosen(o)}>
              <span>
                <span className="r05-title">{o.label}</span>
                <span className="r05-sub">{o.effect}</span>
              </span>
              <span className="chev">
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="r05-step">
          {options.length > 1 && (
            <button type="button" className="r05-back" onClick={() => (setChosen(null), setWriting(false))}>
              <Icon name="chevron-left" size={16} />
              Other options
            </button>
          )}
          <p className="r05-title r05-chosen">{chosen.label}</p>
          <ul className="r05-changes">
            {chosen.changes.map((c, i) => (
              <li key={i}>{c.detail}</li>
            ))}
          </ul>
          {draft && (
            <details className="r05-draft">
              <summary>
                The {/e-?mail/i.test(draft.to) ? "email" : "message"} to {draft.to.split(",")[0]}
                {draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}
                <Icon name="chevron-right" size={14} />
              </summary>
              <p lang={draft.language}>{draft.text}</p>
            </details>
          )}
          <p className="r05-note">Tap a reason to decide. {leadName} reviews it before the agent learns from it.</p>
          <div className="r05-reasons">
            {reasons.map((r) => (
              <button key={r} type="button" className="r05-reason" disabled={pending} onClick={() => onDecide(chosen, r)}>
                {r}
              </button>
            ))}
            {!writing ? (
              <button type="button" className="r05-reason r05-else" onClick={() => setWriting(true)}>
                Something else
              </button>
            ) : (
              <form
                className="r05-own"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (own.trim()) onDecide(chosen, own.trim())
                }}
              >
                <input className="text-input" autoFocus value={own} onChange={(e) => setOwn(e.target.value)} placeholder="One sentence is enough" aria-label="Why, in your own words" />
                <button type="submit" className="btn btn-primary btn-small" disabled={!own.trim() || pending}>
                  Decide
                </button>
              </form>
            )}
          </div>
          {error && <p className="m now r05-err">{error}</p>}
          <button type="button" className="r05-plain" disabled={pending} onClick={() => onDecide(chosen)}>
            Decide without a reason
          </button>
        </div>
      )}
    </Panel>
  )
}

