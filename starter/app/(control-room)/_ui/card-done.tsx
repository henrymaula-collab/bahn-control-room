"use client"

// The card after a decision (decide:07's agent feed; Henry, 25 Oct, h25/h28/h29: "in principle
// perfect for how it looks after the decision"): who decided and when, then the log of what that
// set going, read back from the case: the person's decision, the email sent, where the kind now
// stands, what the agent has carried out, what it does next. A black "Next case" under it.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { languageName } from "@/lib/control-room/format"
import type { AgentStep, Option } from "@/lib/control-room/types"
import { withoutBareTimes } from "./card-line"
import { CardLog, type LogRow, sentences, stepRow } from "./card-log"
import { Keep } from "./text"
import { useNextCase } from "./work-frame"

type Gate = { status: "new" | "learning" | "ready" | "differ"; line: string; agreeing: number; needed: number }
type CaseBack = {
  case: { status: string; agentSteps: AgentStep[] }
  decision: { at: string; optionId: string } | null
  knowledge: { kindLabel: string; gate: Gate } | null
  situation?: { pickup?: { place?: string } }
}

/** The case read back after the decision; looks again a few times while the agent is still carrying it out. */
function useCaseBack(caseId: string) {
  const [data, setData] = useState<CaseBack | null>(null)
  useEffect(() => {
    let alive = true
    let n = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () =>
      fetch(`/api/cr/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<CaseBack>) : null))
        .then((d) => {
          if (!alive || !d) return
          setData(d)
          if ((!d.decision || d.case.status !== "done") && n++ < 8) timer = setTimeout(load, 1500)
        })
        .catch(() => {})
    load()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [caseId])
  return data
}

/** "Kovellin Automobilhandel, by email" -> the name, and whether it is an email. */
function recipient(to: string) {
  return { name: to.split(/,\s*/)[0].trim(), email: /e-?mail/i.test(to) }
}

/** What the agent does after the yes, from the option's effect: its sentences about the agent (a time without its day dropped, as on the time line). */
function agentPlan(o: Option): string[] {
  return sentences(o.effect)
    .filter((s) => !/^A person sends/i.test(s))
    .map((s) => withoutBareTimes(s.replace(/^After a yes,\s*/i, "")))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}

/** The kind after this decision: "1 of 16" while it learns; nothing when the answer differed from the agent's. */
function kindRow(k: CaseBack["knowledge"]): LogRow | null {
  if (!k) return null
  const g = k.gate
  if (g.status === "differ") return null
  if (g.status === "ready") return { state: "done", text: `${k.kindLabel}, ${g.line}`, sub: "The agent learns from every answer." }
  const first = g.agreeing <= 1
  return {
    state: "done",
    text: `${k.kindLabel}, ${Math.max(1, g.agreeing)} of ${g.needed}`,
    sub: first ? "The first answer to this kind. The agent learns from it." : "The agent learns from every answer.",
  }
}

/** The agent's carry-out: its steps after the person's decision, the calls and messages (not its reading). */
function carriedOut(steps: AgentStep[]): AgentStep[] {
  let at = -1
  steps.forEach((s, i) => s.kind === "propose" && !/^Brought a person/.test(s.summary) && (at = i))
  if (at < 0) return []
  return steps.slice(at + 1).filter((s) => (s.kind === "call" || s.kind === "message") && !/^Carried out the decision/i.test(s.summary))
}

export function CardDone({
  caseId,
  headline,
  option,
  done,
  note,
  nextHref,
  place,
}: {
  caseId: string
  headline: string
  option: Option
  done: { personName: string; timeWords: string }
  note?: string // a reason given for another option goes to the shift lead first
  nextHref?: string
  place?: string
}) {
  const router = useRouter()
  const back = useCaseBack(caseId)
  // The dock's order (track N): the case that followed this one, remembered after it left the list.
  const next = useNextCase().href ?? nextHref
  const saved = !!back?.decision

  // Return opens the next case (the default button), unless focus is on another control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && el !== document.body && el.closest("a, button, input, textarea, select, summary, [contenteditable], dialog")) return
      e.preventDefault()
      router.push(next ?? "/tasks")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, next])

  const sent = option.draft ? recipient(option.draft.to) : null
  const where = back?.situation?.pickup?.place ?? place ?? "the pickup place"
  const rows: LogRow[] = [{ state: "done", text: `${done.personName} decided`, sub: `${option.label.replace(/\.$/, "")}${note ? `. ${note}` : ""}` }] // the time is in the line above
  if (sent && option.draft)
    rows.push({
      state: "done",
      text: `The ${sent.email ? "email" : "message"} to ${sent.name}`,
      sub: `Sent at ${done.timeWords}${option.draft.language !== "en" ? `, in ${languageName(option.draft.language)}` : ""}`,
    })
  const kind = saved ? kindRow(back!.knowledge) : null
  if (kind) rows.push(kind)
  const out = saved ? carriedOut(back!.case.agentSteps) : []
  for (const s of out) rows.push({ ...stepRow(s, false), short: true })
  if (!saved || back!.case.status !== "done") {
    rows.push(out.length ? { state: "live", text: "The agent is still at work" } : { state: "live", text: `The agent calls ${where}`, sub: "To tell them what was decided" })
  }
  for (const p of agentPlan(option)) rows.push({ state: "next", text: p })

  return (
    <section className="question card-done" aria-live="polite">
      <p className="m due">
        Decided by {done.personName} at {done.timeWords}
      </p>
      <h1 className="l what">
        <Keep text={headline} />
      </h1>
      <div className="card-done-log">
        <CardLog rows={rows} />
      </div>
      <div className="answers">
        <Link href={next ?? "/tasks"} className="btn btn-primary" aria-keyshortcuts="Enter">
          {next ? "Next case" : "Back to your tasks"}
        </Link>
      </div>
    </section>
  )
}
