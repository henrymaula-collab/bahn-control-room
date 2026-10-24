"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { languageName } from "@/lib/control-room/format"
import type { Option } from "@/lib/control-room/types"
import type { Draft } from "@/lib/control-room/views"
import { decide } from "../actions"
import { answerFor, questionFor } from "./ask"
import { Icon } from "./icons"
import { SendPreview } from "./send-preview"
import { Keep } from "./text"
import { usePanel } from "./work-frame"

interface Props {
  variant: "desk" | "case"
  caseId: string
  due?: { text: string; now: boolean }
  headline: string
  suggestion: Option
  alternatives: Option[]
  drafts: Record<string, Draft>
  whyChoices: Record<string, string[]>
  leadName: string
  personName: string
  nextHref?: string
  existing?: { optionId: string; personName: string; timeWords: string; why?: string }
  next?: string // v3: one short line under the primary button, what the agent does next
  subject?: string // the subject line when the suggestion sends an email: "Ferrari Roma, CD-420458"
  children?: React.ReactNode // the desk's one disclosure, rendered on the server
}

type Done = { optionId: string; personName: string; timeWords: string; why?: string }

const helsinkiTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })

/** One decision as a question, with the agent's suggestion as the single filled button. */
export function Question(props: Props) {
  const { variant, caseId, suggestion, alternatives } = props
  const router = useRouter()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<Done | null>(props.existing ?? null)
  // Decided elsewhere (a yes in the chat beside it): the refreshed page brings the decision in.
  const existing = props.existing
  useEffect(() => {
    if (existing) setDone((d) => d ?? existing)
  }, [existing])
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const all = [suggestion, ...alternatives]
  const draftOf = (o: Option): Draft | undefined => props.drafts[o.id] ?? o.draft
  // A suggestion that sends something shows the message first, as the side panel (Your tasks only).
  const panel = usePanel()
  const primary = useRef<HTMLButtonElement>(null)
  const preview = variant === "case" && !!panel.slot ? draftOf(suggestion) : undefined

  const save = (option: Option, why?: string, editedDetail?: string) => {
    setError(null)
    start(async () => {
      try {
        const d = await decide({ id: `dec-${caseId}-${Date.now().toString(36)}`, caseId, optionId: option.id, why, editedDetail })
        setSheetOpen(false)
        if (panel.open === "email") panel.setOpen(null)
        if (variant === "desk") {
          // Like Mail after you act on a message: the next question comes up, with a short receipt.
          router.push(`/?done=${encodeURIComponent(caseId)}${why ? "&why=1" : ""}`)
          router.refresh()
        } else {
          setDone({ optionId: option.id, personName: props.personName, timeWords: helsinkiTime(d.at), why })
          router.refresh()
        }
      } catch {
        setError("This was not saved. Nothing was sent or booked. Try again.")
      }
    })
  }

  if (done) {
    const option = all.find((o) => o.id === done.optionId) ?? suggestion
    return (
      <section className="question" aria-live="polite">
        <p className="m due">
          Decided by {done.personName} at {done.timeWords}
        </p>
        <h1 className="l what">
          <Keep text={props.headline} />
        </h1>
        <p className="l ask">{option.label}.</p>
        <p className="m quiet context">
          {option.effect}
          {done.why && option.id !== suggestion.id ? ` The reason goes to ${props.leadName} before the agent learns from it.` : ""}
        </p>
        <div className="answers">
          <Link href={props.nextHref ?? "/tasks"} className="btn btn-secondary">
            {props.nextHref ? "Next case" : "Back to your tasks"}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="question" aria-labelledby={`q-${caseId}`}>
      {props.due && <p className={`m due${props.due.now ? " now" : ""}`}>{props.due.text}</p>}
      <h1 className="l what" id={`q-${caseId}`}>
        <Keep text={props.headline} />
      </h1>
      <p className="l ask">{questionFor(suggestion)}</p>
      <div className="answers">
        <button
          ref={primary}
          type="button"
          className="btn btn-primary"
          disabled={pending}
          aria-expanded={preview ? panel.open === "email" : undefined}
          aria-controls={preview ? "email" : undefined}
          onClick={() => (preview ? panel.setOpen(panel.open === "email" ? null : "email") : save(suggestion))}
        >
          {answerFor(suggestion, draftOf(suggestion))}
        </button>
        {alternatives.length > 0 && (
          <button type="button" className="btn btn-plain" disabled={pending} onClick={() => setSheetOpen(true)}>
            Other options
          </button>
        )}
      </div>
      {props.next && <p className="s next">{props.next}</p>}
      {error && <p className="m now" style={{ marginTop: 12 }}>{error}</p>}
      {props.children}
      {preview && (
        <SendPreview
          draft={preview}
          subject={props.subject}
          verb={answerFor(suggestion, preview)}
          pending={pending}
          error={error}
          onSend={(edited) => save(suggestion, undefined, edited)}
          returnFocus={() => primary.current?.focus()}
        />
      )}
      <OptionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={alternatives}
        draftOf={draftOf}
        whyChoices={(o) => props.whyChoices[o.id] ?? o.whyChoices ?? []}
        leadName={props.leadName}
        pending={pending}
        error={error}
        onDecide={save}
      />
    </section>
  )
}

/** Other options in one sheet: pick a step, see what it changes, then one tap on the reason decides. */
function OptionsSheet({
  open,
  onClose,
  options,
  draftOf,
  whyChoices,
  leadName,
  pending,
  error,
  onDecide,
}: {
  open: boolean
  onClose: () => void
  options: Option[]
  draftOf: (o: Option) => Draft | undefined
  whyChoices: (o: Option) => string[]
  leadName: string
  pending: boolean
  error: string | null
  onDecide: (o: Option, why?: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [chosen, setChosen] = useState<Option | null>(options.length === 1 ? options[0] : null)
  const [writing, setWriting] = useState(false)
  const [own, setOwn] = useState("")

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const reset = () => {
    setChosen(options.length === 1 ? options[0] : null)
    setWriting(false)
    setOwn("")
  }

  const close = () => {
    onClose()
    reset()
  }

  const draft = chosen ? draftOf(chosen) : undefined
  const reasons = chosen ? whyChoices(chosen) : []

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={chosen ? chosen.label : "Other options"}
      onClose={() => {
        onClose()
        reset()
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="sheet-head">
        {chosen && options.length > 1 ? (
          <button type="button" className="link" onClick={() => (setChosen(null), setWriting(false))}>
            <Icon name="chevron-left" size={18} />
            Other options
          </button>
        ) : (
          <span />
        )}
        <span className="m title">{chosen ? "" : "Other options"}</span>
        <button type="button" className="btn btn-plain btn-small end" onClick={close}>
          Cancel
        </button>
      </div>

      {!chosen ? (
        <div className="sheet-body">
          {options.map((o) => (
            <button key={o.id} type="button" className="option" onClick={() => setChosen(o)}>
              <span>
                <span className="m title">{o.label}</span>
                <span className="s" style={{ display: "block", marginTop: 2 }}>{o.effect}</span>
              </span>
              <span className="chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sheet-body">
          <p className="m strong">{chosen.label}</p>
          <ul className="changes">
            {chosen.changes.map((c, i) => (
              <li key={i} className="m">
                {c.detail}
              </li>
            ))}
          </ul>
          {draft && (
            <details className="inline-disclosure">
              <summary>
                The {/e-?mail/i.test(draft.to) ? "email" : "message"} to {draft.to.split(",")[0]}
                {draft.language !== "en" ? `, in ${languageName(draft.language)}` : ""}
                <Icon name="chevron-right" size={16} />
              </summary>
              <div className="body stack">
                <p className="m draft-text" lang={draft.language}>
                  {draft.text}
                </p>
                {draft.translation && <p className="s">Translated: {draft.translation}</p>}
              </div>
            </details>
          )}

          <p className="m strong" style={{ marginTop: 28 }}>
            Why this instead?
          </p>
          <p className="s">Tap a reason to decide. {leadName} reviews it before the agent learns from it.</p>
          <div className="reasons">
            {reasons.map((r) => (
              <button key={r} type="button" className="reason m" disabled={pending} onClick={() => onDecide(chosen, r)}>
                {r}
              </button>
            ))}
            {!writing ? (
              <button type="button" className="reason m other" onClick={() => setWriting(true)}>
                Something else
              </button>
            ) : (
              <form
                style={{ marginTop: 8, display: "flex", gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (own.trim()) onDecide(chosen, own.trim())
                }}
              >
                <input
                  className="text-input m"
                  autoFocus
                  value={own}
                  onChange={(e) => setOwn(e.target.value)}
                  placeholder="One sentence is enough"
                  aria-label="Why, in your own words"
                />
                <button type="submit" className="btn btn-primary" disabled={!own.trim() || pending}>
                  Decide
                </button>
              </form>
            )}
          </div>
          {error && <p className="m now" style={{ marginTop: 12 }}>{error}</p>}
          <div className="sheet-foot">
            <button type="button" className="btn btn-plain" disabled={pending} onClick={() => onDecide(chosen)}>
              Decide without a reason
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

/** A short receipt after a decision on the desk; it leaves on its own. */
export function Toast({ text }: { text: string }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShown(false), 9000)
    return () => clearTimeout(t)
  }, [])
  if (!shown) return null
  return (
    <div className="toast m" role="status">
      <span>{text}</span>
      <button type="button" aria-label="Close" onClick={() => setShown(false)}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
