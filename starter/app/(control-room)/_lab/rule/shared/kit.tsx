"use client"

// Slot `rule`, shared by variants 01 to 06: the proposal's evidence as History has it (every answer
// on the kind, who gave it, their own reason), the gate's numbers, the case of the kind that is
// waiting now (what changes next time), and the small parts every variant says the same way.
// Adopting a variant: copy its folder and this one (shared/kit.tsx + kit.css).

import { useEffect, useMemo, useState } from "react"
import { usePanel } from "../../../_ui/work-frame"
import { useLab } from "../../context"
import type { RuleProposal } from "../../server"
import type { RuleCardProps } from "../00-today/rule-card"
import "./kit.css"

export type { RuleCardProps }

/** "rule-kind-facts_disagree_open_gig-pause_gig" -> "facts_disagree_open_gig". */
export const kindKeyOf = (id: string) => id.split("-")[2] ?? ""

export type Answer = {
  caseId: string
  reference: string
  car: string
  place: string
  country: string
  by: { id: string; name: string }
  decision: string
  reason?: string
  at: string
  minutes?: number
  same: boolean // chose what the rule will do
}
export type Person = { id: string; name: string; avatar: string; n: number; same: number; answers: Answer[] }
export type Waiting = { caseId: string; reference: string; vehicle: string; place: string; person: string; handled: boolean }
export type Gate = { needed: number; minPeople: number; lowerBound: number }
export type RuleData = {
  loading: boolean
  answers: Answer[] // newest first
  people: Person[] // most answers first
  differ: Answer[]
  reasons: { text: string; n: number }[] // the agreeing answers' own words, most used first
  first?: string
  last?: string
  waiting: Waiting[]
  gate: Gate
}

const avatarOf = (id: string) => `/control-room/people/${id.replace(/^p-/, "")}.jpg`
const json = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { cache: "no-store" })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

type HistRow = { caseId: string; reference: string; car: string; place: string; country: string; kindKey?: string; decision: string; reason?: string; by: { id: string; name: string }; at: string; minutes?: number }
type CaseApi = { case: { id: string; status: string }; kind?: { key: string }; routedTo?: { person?: { name: string } }; situation?: { reference: string; vehicle: string; pickup: { place: string } } }

/** Everything the variants show, read from the lab database through the real routes. */
export function useRuleData(p: RuleProposal, personName: string): RuleData {
  const kindKey = kindKeyOf(p.id)
  const me = personName.split(" ")[0].toLowerCase()
  const [rows, setRows] = useState<HistRow[] | null>(null)
  const [waiting, setWaiting] = useState<Waiting[]>([])
  const [gate, setGate] = useState<Gate>({ needed: 16, minPeople: 2, lowerBound: 0.806 })

  useEffect(() => {
    let live = true
    json<{ rows: HistRow[] }>(`/api/cr/history?person=${encodeURIComponent(me)}&scope=everyone`).then((h) => live && setRows(h?.rows.filter((r) => r.kindKey === kindKey) ?? []))
    json<{ gate: Gate }>(`/api/cr/kinds`).then((k) => live && k?.gate && setGate(k.gate))
    // The case of this kind waiting for a person now (or just handled by the agent under the rule):
    // the Overview's cars that have a case, then each case's kind. Two requests deep, ~0.4 s.
    ;(async () => {
      const ov = await json<{ cars: { caseId?: string }[] }>(`/api/cr/overview?person=${encodeURIComponent(me)}`)
      const ids = [...new Set((ov?.cars ?? []).flatMap((c) => (c.caseId ? [c.caseId] : [])))]
      const cases = await Promise.all(ids.map((id) => json<CaseApi>(`/api/cr/cases/${encodeURIComponent(id)}?person=${encodeURIComponent(me)}`)))
      const found = cases
        .filter((c): c is CaseApi => !!c && c.kind?.key === kindKey && (c.case.status === "waiting_for_person" || c.case.status === "handled_by_agent"))
        .map((c) => ({ caseId: c.case.id, reference: c.situation?.reference ?? "", vehicle: c.situation?.vehicle ?? "", place: c.situation?.pickup.place ?? "", person: c.routedTo?.person?.name ?? "a person", handled: c.case.status === "handled_by_agent" }))
      if (live) setWaiting(found)
    })()
    return () => {
      live = false
    }
  }, [kindKey, me])

  return useMemo(() => {
    const answers: Answer[] = (rows ?? []).map((r) => ({ ...r, same: r.decision.toLowerCase() === p.then.toLowerCase() }))
    const by = new Map<string, Person>()
    for (const a of answers) {
      const x = by.get(a.by.id) ?? { id: a.by.id, name: a.by.name, avatar: avatarOf(a.by.id), n: 0, same: 0, answers: [] }
      x.n++
      if (a.same) x.same++
      x.answers.push(a)
      by.set(a.by.id, x)
    }
    const words = new Map<string, number>()
    for (const a of answers) if (a.same && a.reason) words.set(a.reason, (words.get(a.reason) ?? 0) + 1)
    const sorted = [...answers].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    return {
      loading: rows === null,
      answers,
      people: [...by.values()].sort((a, b) => b.n - a.n),
      differ: answers.filter((a) => !a.same),
      reasons: [...words.entries()].map(([text, n]) => ({ text, n })).sort((a, b) => b.n - a.n),
      first: sorted[0]?.at,
      last: sorted[sorted.length - 1]?.at,
      waiting,
      gate,
    }
  }, [rows, waiting, gate, p.then])
}

/**
 * Whether the waiting case has left its person's list. ?rulestate=on shows the moment as it is
 * once saved (nothing is saved there); after a real "Turn it on" the case is read again.
 */
export function useHandled(status: RuleCardProps["status"], waiting: Waiting[]): boolean {
  const lab = useLab()
  const [handled, setHandled] = useState(false)
  const id = waiting[0]?.caseId
  useEffect(() => {
    if (status !== "on" || !id || lab.ruleState === "on" || waiting[0]?.handled) return
    let live = true
    const t = setTimeout(async () => {
      const c = await json<CaseApi>(`/api/cr/cases/${encodeURIComponent(id)}?person=kaisa`)
      if (live) setHandled(c?.case.status === "handled_by_agent")
    }, 500)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [status, id, lab.ruleState])
  return status === "on" && (lab.ruleState === "on" || handled || !!waiting[0]?.handled)
}

/** The rule page has no situation: give the panel's room back so the card centres. */
export function useNoPanel() {
  const { reset } = usePanel()
  useEffect(() => reset(null), [reset])
}

const HEL = "Europe/Helsinki"
/** "12 Aug" */
export const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: HEL }) : "")
/** "Tue 6 Oct" */
export const dayW = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: HEL }).replace(",", "") : "")
/** "August" */
export const month = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { month: "long", timeZone: HEL }) : "")

/** "Pause the gig until..." -> "pause the gig until..." */
export const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** "When the pickup place..." -> "the pickup place..." */
export const whenText = (s: string) => s.replace(/^When /, "")

/** "Jonas, Mikko, Lea and Sofie" */
export const names = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)

/** "Turned on by Kaisa at 12:04" */
export function changedWords(status: RuleCardProps["status"], changed: RuleCardProps["changed"]): string {
  const who = changed?.by.split(" ")[0]
  const verb = status === "on" ? "Turned on" : "Turned off"
  return `${verb}${who ? ` by ${who}` : ""}${changed?.at ? ` at ${changed.at}` : ""}`
}

/** One sentence on what just happened to the case waiting now, or what happens from now on. */
export function afterWords(p: RuleProposal, waiting: Waiting[], handled: boolean): string {
  const w = waiting[0]
  if (w && handled) return `The agent paused the gig for the ${w.vehicle} at ${w.place}, and it left ${w.person}'s tasks.`
  if (w) return `The agent pauses the gig for the ${w.vehicle} at ${w.place} now, and it leaves ${w.person}'s tasks.`
  return `From now on the agent will ${lower(p.then)} on its own.`
}

/** A portrait, round, with the name for screen readers. */
export function Face({ person, size = "1.9em" }: { person: Pick<Person, "id" | "name">; size?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="rk-face" src={avatarOf(person.id)} alt="" width={40} height={40} style={{ width: size, height: size }} />
}

/** Overlapping portraits, the way GitHub shows reviewers: the people, not a number. */
export function Faces({ people, size }: { people: Pick<Person, "id" | "name">[]; size?: string }) {
  return (
    <span className="rk-faces" aria-label={names(people.map((x) => x.name))}>
      {people.map((x) => (
        <Face key={x.id} person={x} size={size} />
      ))}
    </span>
  )
}

/** History, filtered to this kind and everyone's answers; `open` opens one row there. */
export const historyHref = (p: RuleProposal, open?: string) => `/history?kind=${kindKeyOf(p.id)}&who=all${open ? `&open=${encodeURIComponent(open)}` : ""}`
