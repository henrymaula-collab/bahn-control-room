"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import type { Option } from "@/lib/control-room/types"
import type { Draft } from "@/lib/control-room/views"
import { decide } from "../actions"
import { Icon } from "./icons"

export interface LessonNote {
  id: string
  text: string
  personName?: string
  dayWords?: string // "on 14 Oct"
}

interface Props {
  variant: "desk" | "case"
  caseId: string
  suggestion: Option
  alternatives: Option[]
  drafts?: Record<string, Draft>
  whyChoices: Record<string, string[]>
  lessons?: LessonNote[]
  personName: string
  leadName: string
  caseHref?: string // desk: where the case opens
  nextHref?: string // case: the next case in this person's queue
  existing?: { optionId: string; why?: string; timeWords: string; personName: string }
}

type Decided = { id: string; optionId: string; timeWords: string; personName: string; whyState?: "saved" | "skipped" }

export function DecisionControls(props: Props) {
  const { variant, caseId, suggestion, alternatives } = props
  const all = [suggestion, ...alternatives]
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selectedId, setSelectedId] = useState(suggestion.id)
  const [decided, setDecided] = useState<Decided | null>(
    props.existing
      ? { id: "", optionId: props.existing.optionId, timeWords: props.existing.timeWords, personName: props.existing.personName, whyState: props.existing.why ? "saved" : "skipped" }
      : null,
  )
  const [error, setError] = useState<string | null>(null)

  const selected = all.find((o) => o.id === selectedId) ?? suggestion

  const commit = (option: Option) => {
    setError(null)
    const id = `dec-${caseId}-${Date.now().toString(36)}`
    start(async () => {
      try {
        const d = await decide({ id, caseId, optionId: option.id })
        const at = new Date(d.at)
        const timeWords = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })
        setDecided({ id, optionId: option.id, timeWords, personName: props.personName })
      } catch {
        setError("This was not saved. Nothing was sent or booked. Try again.")
      }
    })
  }

  if (decided) {
    const option = all.find((o) => o.id === decided.optionId) ?? suggestion
    const tookSuggestion = option.id === suggestion.id
    return (
      <div className="receipt" aria-live="polite">
        <p className="t-label">
          Decided by {decided.personName} at {decided.timeWords}
        </p>
        <p className="t-lead">{option.label}</p>
        <p className="t-body">{option.effect}</p>
        {!tookSuggestion && decided.id && !decided.whyState && (
          <WhyPrompt
            caseId={caseId}
            decisionId={decided.id}
            optionId={option.id}
            choices={props.whyChoices[option.id] ?? []}
            leadName={props.leadName}
            onDone={(why) => setDecided({ ...decided, whyState: why ? "saved" : "skipped" })}
          />
        )}
        {!tookSuggestion && decided.whyState === "saved" && (
          <p className="t-2" style={{ marginTop: 8 }}>
            Saved as a lesson. {props.leadName} reviews it before the agent relies on it.
          </p>
        )}
        {(tookSuggestion || decided.whyState) && (
          <div className="actions" style={{ marginTop: 16 }}>
            {variant === "desk" ? (
              <button type="button" className="btn btn-secondary" onClick={() => router.refresh()}>
                Next for you
              </button>
            ) : props.nextHref ? (
              <Link href={props.nextHref} className="btn btn-secondary">
                Next case <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <Link href="/" className="btn btn-secondary">
                Back to your desk
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  if (variant === "desk") {
    return (
      <div>
        <p className="t-label suggests-label">The agent suggests</p>
        <p className="t-body">{suggestion.effect}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => commit(suggestion)}>
            {suggestion.label}
          </button>
          <Link href={`${props.caseHref}#options`} className="btn btn-secondary">
            Choose another step
          </Link>
          <Link href={props.caseHref ?? "#"} className="btn-text">
            Open the order
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        {error && <p className="t-2 t-now" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    )
  }

  const isSuggestion = selected.id === suggestion.id
  const draft = props.drafts?.[selected.id]
  const others = alternatives.filter((o) => o.id !== selected.id)
  return (
    <div>
      <div className="block">
        <p className="t-label">{isSuggestion ? "The agent suggests" : "Another step"}</p>
        <p className="t-lead">{selected.label}</p>
      </div>
      <div className="block">
        <p className="t-label">What will change</p>
        <ul className="changes">
          {selected.changes.map((ch, i) => (
            <li key={i} className="t-body">
              {ch.detail}
            </li>
          ))}
        </ul>
        {draft && <DraftCard draft={draft} />}
      </div>
      <div className="block">
        <p className="t-label">What happens next</p>
        <p className="t-body">{selected.effect}</p>
      </div>
      {isSuggestion && props.lessons && props.lessons.length > 0 && (
        <div className="block">
          <p className="t-label">Learned before</p>
          {props.lessons.map((l) => (
            <p key={l.id} className="t-body">
              {l.text}{" "}
              {l.personName && (
                <span className="t-2">
                  From {l.personName}&apos;s decision {l.dayWords}.
                </span>
              )}
            </p>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={pending} onClick={() => commit(selected)}>
        {selected.label}
      </button>
      {error && <p className="t-2 t-now" style={{ marginTop: 12 }}>{error}</p>}
      {!isSuggestion && (
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <button type="button" className="btn-text" onClick={() => setSelectedId(suggestion.id)}>
            Back to the agent&apos;s suggestion
          </button>
        </div>
      )}
      {isSuggestion && others.length > 0 && (
        <div className="other-options" id="options">
          <p className="t-label">Or choose another step</p>
          <div className="option-list">
            {others.map((o) => (
              <button key={o.id} type="button" className="btn btn-secondary btn-block btn-left" onClick={() => setSelectedId(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DraftCard({ draft }: { draft: Draft }) {
  const lang = { de: "German", fi: "Finnish", sv: "Swedish", da: "Danish", fr: "French", en: "English" }[draft.language] ?? draft.language
  return (
    <div className="draft">
      <p className="to">
        To {draft.to}
        {draft.language !== "en" ? `, in ${lang}` : ""}
      </p>
      <p className="original">{draft.text}</p>
      {draft.translation && <p className="translated">Translated: {draft.translation}</p>}
    </div>
  )
}

/** Asked only when the person did not take the suggestion. One tap, or Skip. */
function WhyPrompt({
  caseId,
  decisionId,
  optionId,
  choices,
  leadName,
  onDone,
}: {
  caseId: string
  decisionId: string
  optionId: string
  choices: string[]
  leadName: string
  onDone: (why: string | null) => void
}) {
  const name = useId()
  const [choice, setChoice] = useState<string | null>(null)
  const [other, setOther] = useState("")
  const [pending, start] = useTransition()
  const OTHER = "__other"
  const why = choice === OTHER ? other.trim() : choice

  const save = () => {
    if (!why) return
    start(async () => {
      await decide({ id: decisionId, caseId, optionId, why })
      onDone(why)
    })
  }

  return (
    <div className="why">
      <p className="t-heading">Tell the agent why</p>
      <p className="t-2" style={{ marginTop: 4 }}>
        Optional. It helps the next person and the agent. {leadName} reviews it first.
      </p>
      <fieldset>
        <legend className="sr-only">Why you chose another step</legend>
        {choices.map((c) => (
          <label key={c} className="radio">
            <input type="radio" name={name} checked={choice === c} onChange={() => setChoice(c)} />
            <span>{c}</span>
          </label>
        ))}
        <label className="radio">
          <input type="radio" name={name} checked={choice === OTHER} onChange={() => setChoice(OTHER)} />
          <span>Something else</span>
        </label>
        {choice === OTHER && (
          <input
            className="text-input"
            autoFocus
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="One sentence is enough"
            aria-label="Why, in your own words"
          />
        )}
      </fieldset>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!why || pending} onClick={save}>
          Save
        </button>
        <button type="button" className="btn-text" onClick={() => onDone(null)}>
          Skip
        </button>
      </div>
    </div>
  )
}
