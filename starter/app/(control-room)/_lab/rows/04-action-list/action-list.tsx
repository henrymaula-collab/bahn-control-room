"use client"

// rows 04: Other options as Raycast's action panel, anchored to the button that opened it. Each
// step with its consequence and a number key; picking one turns the same panel into the reasons,
// numbered the same way. Escape steps back, then closes; a click outside closes.

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Option } from "@/lib/control-room/types"
import { languageName } from "@/lib/control-room/format"
import { Icon } from "../../../_ui/icons"
import type { OptionsSheetProps } from "../shared/kit"
import "./action-list.css"

type Spot = { left: number; top?: number; bottom?: number; width: number; max: number }

export function ActionListSheet({ open, onClose, options, draftOf, whyChoices, leadName, pending, error, onDecide }: OptionsSheetProps) {
  const box = useRef<HTMLDivElement>(null)
  const [chosen, setChosen] = useState<Option | null>(options.length === 1 ? options[0] : null)
  const [at, setAt] = useState(0)
  const [writing, setWriting] = useState(false)
  const [own, setOwn] = useState("")
  const [spot, setSpot] = useState<Spot | null>(null)
  const reasons = chosen ? whyChoices(chosen) : []
  const items = chosen ? reasons : options.map((o) => o.label)

  const close = () => {
    onClose()
    setChosen(options.length === 1 ? options[0] : null)
    setWriting(false)
    setOwn("")
    setAt(0)
  }

  // Anchor: the button that opened it (focus is on it), else the card's Other options button.
  useLayoutEffect(() => {
    if (!open) return
    const a = document.activeElement as HTMLElement | null
    const anchor = a?.closest(".answers button") ?? document.querySelector(".question .answers .btn-plain")
    const r = anchor?.getBoundingClientRect()
    if (!r) return setSpot({ left: 24, top: 80, width: 440, max: window.innerHeight - 96 })
    const width = Math.min(480, window.innerWidth - r.left - 16)
    const below = window.innerHeight - r.bottom
    setSpot(below > 320 || below > r.top ? { left: r.left, top: r.bottom + 6, width, max: below - 22 } : { left: r.left, bottom: window.innerHeight - r.top + 6, width, max: r.top - 22 })
  }, [open])

  useEffect(() => {
    if (open) box.current?.focus()
  }, [open, chosen])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && close()
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  })

  if (!open || !spot) return null

  const pick = (i: number) => {
    if (pending) return
    if (!chosen) {
      const o = options[i]
      if (o) (setChosen(o), setAt(0))
    } else if (reasons[i]) onDecide(chosen, reasons[i])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") {
      if (e.key === "Escape") (e.preventDefault(), setWriting(false), box.current?.focus())
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      if (chosen && options.length > 1) (setChosen(null), setWriting(false), setAt(0))
      else close()
    } else if (e.key === "ArrowDown") (e.preventDefault(), setAt((i) => Math.min(items.length - 1, i + 1)))
    else if (e.key === "ArrowUp") (e.preventDefault(), setAt((i) => Math.max(0, i - 1)))
    else if (e.key === "Enter") (e.preventDefault(), pick(at))
    else if (/^[1-9]$/.test(e.key)) (e.preventDefault(), pick(Number(e.key) - 1))
  }

  const draft = chosen ? draftOf(chosen) : undefined
  return (
    <div
      ref={box}
      className="lab-rows-04 r04-panel"
      role="dialog"
      aria-label={chosen ? chosen.label : "Other options"}
      tabIndex={-1}
      onKeyDown={onKey}
      style={{ left: spot.left, top: spot.top, bottom: spot.bottom, width: spot.width, maxHeight: spot.max }}
    >
      <div className="r04-head">
        {chosen && options.length > 1 ? (
          <button type="button" className="r04-back" onClick={() => (setChosen(null), setWriting(false), setAt(0))}>
            <Icon name="chevron-left" size={16} />
            Other options
          </button>
        ) : (
          <span className="r04-label">Other options</span>
        )}
        <span className="r04-key" aria-hidden>
          esc
        </span>
      </div>

      {!chosen ? (
        <ul className="r04-list" role="listbox" aria-label="Other options">
          {options.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === at}>
              <button type="button" className={`r04-item${i === at ? " r04-at" : ""}`} onMouseEnter={() => setAt(i)} onClick={() => pick(i)}>
                <span className="r04-text">
                  <span className="r04-title">{o.label}</span>
                  <span className="r04-sub">{o.effect}</span>
                </span>
                <span className="r04-key" aria-hidden>
                  {i + 1}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="r04-step">
          <p className="r04-chosen">{chosen.label}</p>
          <ul className="r04-changes">
            {chosen.changes.map((c, i) => (
              <li key={i}>{c.detail}</li>
            ))}
          </ul>
          {draft && (
            <details className="r04-draft">
              <summary>
                The {/e-?mail/i.test(draft.to) ? "email" : "message"} to {draft.to.split(",")[0]}
                {draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}
                <Icon name="chevron-right" size={14} />
              </summary>
              <p lang={draft.language}>{draft.text}</p>
            </details>
          )}
          <p className="r04-label r04-why">Why this instead? {leadName} reviews it before the agent learns from it.</p>
          <ul className="r04-list" role="listbox" aria-label="Why this instead">
            {reasons.map((r, i) => (
              <li key={r} role="option" aria-selected={i === at}>
                <button type="button" className={`r04-item${i === at ? " r04-at" : ""}`} disabled={pending} onMouseEnter={() => setAt(i)} onClick={() => pick(i)}>
                  <span className="r04-title r04-reason">{r}</span>
                  <span className="r04-key" aria-hidden>
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!writing ? (
            <div className="r04-foot">
              <button type="button" className="r04-plain" onClick={() => setWriting(true)}>
                Something else
              </button>
              <button type="button" className="r04-plain" disabled={pending} onClick={() => onDecide(chosen)}>
                Decide without a reason
              </button>
            </div>
          ) : (
            <form
              className="r04-own"
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
          {error && <p className="m now r04-err">{error}</p>}
        </div>
      )}
    </div>
  )
}
