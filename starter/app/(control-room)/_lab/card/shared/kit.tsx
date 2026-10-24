"use client"

// The card slot's shared kit (builder C). Not a variant: the shot pipeline only reads NN-slug
// folders. Every card variant lays out its own visible parts and keeps today's behaviour through
// this kit: the save, the email preview, the Other options sheet and the done state, all picked
// through _lab/parts.tsx so ?v=card:07,decide:03,rows:02 still combines.
// On adoption into v4: copy this file with the variant and replace each Slot* with today's part.

import { useEffect, useRef, useState } from "react"
import type { Option } from "@/lib/control-room/types"
import { answerFor, questionFor } from "../../../_ui/ask"
import { useQuestion, type QuestionProps } from "../../../_ui/question"
import { useNeedsYou } from "../../../_ui/work-frame"
import { SlotDone, SlotOptionsSheet, SlotSendPreview } from "../../parts"

export type CardProps = QuestionProps

/** Today's logic plus what every variant shows: the question and the default answer's verb. */
export function useCard(props: CardProps) {
  const q = useQuestion(props)
  // An alternative picked from a variant's own list opens the sheet on it (its reason step).
  const [picked, setPicked] = useState<Option | null>(null)
  const openSheet = (o?: Option) => {
    setPicked(o ?? null)
    q.setSheetOpen(true)
  }
  // The default keeps today's verb ("Send the email"); an alternative keeps its label up to the
  // first "and"/"until", so "Ask the driver to wait 30 minutes more" is not cut to "Ask the driver".
  const verbOf = (o: Option) => (o.id === props.suggestion.id ? answerFor(o, q.draftOf(o)) : shortLabel(o))
  return {
    ...q,
    ask: questionFor(props.suggestion),
    answer: verbOf(props.suggestion),
    verbOf,
    picked,
    openSheet,
    closeSheet: () => (q.setSheetOpen(false), setPicked(null)),
    /** Choose an option: the suggestion goes the default way (email first, else save); another asks why. */
    choose: (o: Option) => (o.id === props.suggestion.id ? q.onPrimary() : openSheet(o)),
  }
}
export type Card = ReturnType<typeof useCard>

/** An option's label up to its first "and", "until", "so" or "because". */
export function shortLabel(o: Option) {
  const words = o.label.trim().replace(/[.?]$/, "")
  const cut = words.search(/\s(and|until|so|because|instead)\s/)
  return cut > 0 ? words.slice(0, cut) : words
}

/** The moment after a decision: decide's or needs' Done, else today's. */
export function CardDone({ props, q }: { props: CardProps; q: Card }) {
  if (!q.done) return null
  return (
    <SlotDone
      headline={props.headline}
      option={q.chosen ?? props.suggestion}
      suggestion={props.suggestion}
      done={q.done}
      leadName={props.leadName}
      nextHref={props.nextHref}
    />
  )
}

/** What every card carries besides its look: the error, the desk's disclosure, the email preview, the sheet. */
export function CardTail({ props, q }: { props: CardProps; q: Card }) {
  const options = q.picked ? [q.picked] : props.alternatives
  return (
    <>
      {q.error && <p className="lc-error">{q.error}</p>}
      {props.children}
      {q.preview && (
        <SlotSendPreview
          draft={q.preview}
          subject={props.subject}
          verb={q.answer}
          pending={q.pending}
          error={q.error}
          onSend={(edited: string | undefined) => q.save(props.suggestion, undefined, edited)}
          returnFocus={() => q.primary.current?.focus()}
        />
      )}
      <SlotOptionsSheet
        key={q.picked?.id ?? "all"}
        open={q.sheetOpen}
        onClose={q.closeSheet}
        options={options}
        draftOf={q.draftOf}
        whyChoices={(o: Option) => props.whyChoices[o.id] ?? o.whyChoices ?? []}
        leadName={props.leadName}
        pending={q.pending}
        error={q.error}
        onDecide={q.save}
      />
    </>
  )
}

/** The deadline line: red and semibold within the hour, with the map's red dot. */
export function Due({ due, className = "" }: { due?: CardProps["due"]; className?: string }) {
  if (!due) return null
  return (
    <p className={`lc-due${due.now ? " now" : ""} ${className}`.trim()}>
      {due.now && <span className="lc-dot" aria-hidden="true" />}
      {due.text}
    </p>
  )
}

// ---------------------------------------------------------------- data one tap away

export type CaseData = {
  case: {
    id: string
    decideBy?: string
    headline: string
    agentSteps: { at: string; kind: string; summary: string }[]
    facts: { id: string; statement: string; strength: string; source: { name?: string; channel?: string; at: string; kind?: string } }[]
  }
  order: { pickup: { name: string }; delivery: { name: string }; customer: { name: string } }
  calls: { id: string; language?: string; startedAt?: string; turns: { at: string; speaker: string; text: string; translation?: string }[] }[]
  knowledge?: { kindLabel: string; novelty: string; decided: number; sameAsSuggestion: number; peopleCount: number; gate?: { line?: string } }
  routedTo?: { why?: string }
  check?: { checkedAt?: string }
}

const cache = new Map<string, Promise<CaseData | null>>()
const fetchCase = (caseId: string) => {
  if (!cache.has(caseId))
    cache.set(
      caseId,
      fetch(`/api/cr/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<CaseData>) : null))
        .catch(() => null),
    )
  return cache.get(caseId)!
}

/** The case's record (calls, facts, the agent's steps), fetched when `on` first turns true. */
export function useCaseData(caseId: string, on = true) {
  const [data, setData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!on || data) return
    let live = true
    setLoading(true)
    fetchCase(caseId).then((d) => live && (setData(d), setLoading(false)))
    return () => {
      live = false
    }
  }, [caseId, on, data])
  return { data, loading }
}

let roomNow: Promise<string | null> | null = null
/** The room's clock (the dataset's "now", 12:00 in the demo) plus the real minutes since the page opened. */
export function useMinutesLeft(caseId: string) {
  const needs = useNeedsYou()
  const row = needs.rows.find((r) => r.caseId === caseId)
  const [decideBy, setDecideBy] = useState<string | undefined>(row?.decideBy)
  const [now, setNow] = useState<string | null>(null)
  const opened = useRef(Date.now())
  const [tick, setTick] = useState(0)
  useEffect(() => {
    // The room's clock is the same for every person; the overview route only needs some person to answer.
    roomNow ??= fetch("/api/cr/overview?person=p-aino", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.now as string) ?? null)
      .catch(() => null)
    let live = true
    roomNow.then((n) => live && setNow(n))
    if (!decideBy) fetchCase(caseId).then((d) => live && d?.case.decideBy && setDecideBy(d.case.decideBy))
    const t = setInterval(() => setTick((x) => x + 1), 15_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [caseId, decideBy])
  if (!now || !decideBy) return null
  void tick
  const left = (Date.parse(decideBy) - Date.parse(now) - (Date.now() - opened.current)) / 60_000
  return Math.ceil(left)
}

/** "60 min", "1 h 20 min", "2 h". */
export function leftWords(min: number) {
  if (min <= 0) return "Now"
  if (min <= 90) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// ---------------------------------------------------------------- words

export const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })

/** Sentences, kept whole ("12:00" and "EUR 134." stay intact). */
export const sentences = (text?: string) =>
  (text ?? "")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)

/** "Pickup moves from Mon 26 Oct 09:00-12:00 to Tue 27 Oct from 12:00 (...)" -> new, was. */
export function wasNow(detail: string): { subject: string; now: string; was: string } | null {
  const m = detail.match(/^(.*?)\s+moves from\s+(.+?)\s+to\s+(.+?)(?:\s*\((.*?)\))?\.?$/)
  if (!m) return null
  return { subject: m[1], was: m[2], now: m[3] }
}

/** The first-hand words behind the situation: the pickup place on the call, else the latest message from a person. */
export function sourceQuote(d: CaseData | null): { text: string; who: string; at: string; how: string } | null {
  if (!d) return null
  const callFact = d.case.facts.find((f) => f.source.channel === "call" && f.source.name)
  const call = d.calls[0]
  if (call) {
    const theirs = call.turns.filter((t) => t.speaker !== "agent")
    const turn = theirs[1] ?? theirs[0]
    if (turn)
      return {
        text: (turn.translation ?? turn.text).trim(),
        who: callFact?.source.name ?? d.order.pickup.name,
        at: hm(turn.at),
        how: "on the call",
      }
  }
  const firstHand = d.case.facts
    .filter((f) => ["call", "email", "message"].includes(f.source.channel ?? "") && f.source.name)
    .sort((a, b) => {
      const place = (f: typeof a) => (f.source.name?.startsWith(d.order.pickup.name) ? 0 : 1)
      return place(a) - place(b) || Date.parse(b.source.at) - Date.parse(a.source.at)
    })[0]
  if (!firstHand) return null
  const how = firstHand.source.channel === "call" ? "on a call" : firstHand.source.channel === "email" ? "by email" : "in a message"
  return { text: firstHand.statement, who: firstHand.source.name!, at: hm(firstHand.source.at), how }
}

/** The facts a person said or wrote (not the agent's own notes), newest first. */
export function firstHandFacts(d: CaseData | null, n = 3) {
  if (!d) return []
  return d.case.facts
    .filter((f) => ["call", "email", "message", "app"].includes(f.source.channel ?? "") && f.source.name)
    .slice(0, n)
}

/** The kind's record in one plain sentence (Stripe states confidence as a chance; here, as people). */
export function recordLine(d: CaseData | null): string | null {
  const k = d?.knowledge
  if (!k) return null
  if (k.novelty === "new" || k.decided === 0) return `Nobody has decided a ${k.kindLabel.toLowerCase()} before.`
  return `${k.kindLabel}: ${k.decided} decided before by ${k.peopleCount} people, ${k.sameAsSuggestion} of them this way.`
}
