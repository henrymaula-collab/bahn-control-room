"use client"

// rows 08: Other options as a sheet that rises from the bottom of the card's column, with Apple's
// two detents: medium first (the step and its reasons, the card's question still visible above),
// large when there is more to read (the message it sends, your own words). A grabber switches them.

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { languageName } from "@/lib/control-room/format"
import type { Option } from "@/lib/control-room/types"
import { Icon } from "../../../_ui/icons"
import type { OptionsSheetProps } from "../shared/kit"
import "./bottom-sheet.css"

export function BottomSheet({ open, onClose, options, draftOf, whyChoices, leadName, pending, error, onDecide }: OptionsSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [chosen, setChosen] = useState<Option | null>(options.length === 1 ? options[0] : null)
  const [large, setLarge] = useState(false)
  const [writing, setWriting] = useState(false)
  const [own, setOwn] = useState("")
  const [col, setCol] = useState<{ left: number; width: number } | null>(null)

  // The sheet sits under the card's column, not the whole window.
  useLayoutEffect(() => {
    if (!open) return
    const d = document.querySelector(".work .detail")?.getBoundingClientRect()
    setCol(d ? { left: d.left + 8, width: d.width - 16 } : null)
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const reset = () => {
    setChosen(options.length === 1 ? options[0] : null)
    setLarge(false)
    setWriting(false)
    setOwn("")
  }
  const close = () => (onClose(), reset())
  const draft = chosen ? draftOf(chosen) : undefined
  const reasons = chosen ? whyChoices(chosen) : []

  return (
    <dialog
      ref={ref}
      className={`lab-rows-08 r08-sheet${large ? " r08-large" : ""}`}
      aria-label={chosen ? chosen.label : "Other options"}
      style={col ? { left: col.left, width: col.width } : undefined}
      onClose={() => (onClose(), reset())}
      onClick={(e) => e.target === ref.current && close()}
    >
      <button type="button" className="r08-grab" aria-label={large ? "Show less" : "Show more"} onClick={() => setLarge((l) => !l)}>
        <span />
      </button>
      <div className="r08-head">
        {chosen && options.length > 1 ? (
          <button type="button" className="r08-back" onClick={() => (setChosen(null), setWriting(false))}>
            <Icon name="chevron-left" size={16} />
            Other options
          </button>
        ) : (
          <span className="r08-label">Other options</span>
        )}
        <button type="button" className="btn btn-plain btn-small" onClick={close}>
          Cancel
        </button>
      </div>

      <div className="r08-body">
        {!chosen ? (
          options.map((o) => (
            <button key={o.id} type="button" className="r08-option" onClick={() => setChosen(o)}>
              <span>
                <span className="r08-title">{o.label}</span>
                <span className="r08-sub">{o.effect}</span>
              </span>
              <Icon name="chevron-right" size={16} />
            </button>
          ))
        ) : (
          <>
            <p className="r08-title r08-chosen">{chosen.label}</p>
            <p className="r08-sub">{chosen.changes.map((c) => c.detail).join(" ")}</p>
            {draft && (
              <details className="r08-draft" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setLarge(true)}>
                <summary>
                  The {/e-?mail/i.test(draft.to) ? "email" : "message"} to {draft.to.split(",")[0]}
                  {draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}
                  <Icon name="chevron-right" size={14} />
                </summary>
                <p lang={draft.language}>{draft.text}</p>
              </details>
            )}
            <p className="r08-ask">
              Why this instead? <span className="r08-sub">{leadName} reviews it before the agent learns from it.</span>
            </p>
            <div className="r08-reasons">
              {reasons.map((r) => (
                <button key={r} type="button" className="r08-reason" disabled={pending} onClick={() => onDecide(chosen, r)}>
                  {r}
                </button>
              ))}
            </div>
            {!writing ? (
              <div className="r08-foot">
                <button type="button" className="r08-plain" onClick={() => (setWriting(true), setLarge(true))}>
                  Something else
                </button>
                <button type="button" className="r08-plain" disabled={pending} onClick={() => onDecide(chosen)}>
                  Decide without a reason
                </button>
              </div>
            ) : (
              <form
                className="r08-own"
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
            {error && <p className="m now r08-err">{error}</p>}
          </>
        )}
      </div>
    </dialog>
  )
}
