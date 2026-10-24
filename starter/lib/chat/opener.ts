// The agent's first message, shaped to the person and to how well Bahn knows
// this kind of case. Deterministic and instant (the thread opens with it
// already there); the model only answers what the person asks next.
//
//   known kind + strong record   two lines: why this suggestion, what it rests on
//   known kind + little record   the problem, why it needs a person, the options, what people did
//   decided once                 who decided, what, why; with one case it is your call
//   rare (2 to 4)                who decided, the last one, few cases so your call
//   new kind                     says plainly it has not happened before

import type { Case } from "@/lib/control-room/types"
import type { CaseKnowledge, ChatMessage, ChatToolStep, Precedent } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { isExperienced, recordOf, type PersonRecord } from "./knowledge"
import { chosePhrase, day, lc, names, needsYou, plural, restsOn, sentence } from "./words"

export type OpenerVariant = "known_experienced" | "known_newer" | "once" | "rare" | "new"

export interface OpenerShape {
  variant: OpenerVariant
  experienced: boolean
  record: PersonRecord
}

export function openerShape(ctx: ChatCaseContext, k: CaseKnowledge): OpenerShape {
  const record = recordOf(ctx.history, ctx.person.id, k.kindKey, { excludeCaseId: ctx.case.id })
  // On a new kind nobody has a record; a strong record on the same case type still means the person knows the ground.
  const typeRecord: PersonRecord = (() => {
    const rows = ctx.history.filter((d) => d.personId === ctx.person.id && d.caseType === ctx.case.type && d.caseId !== ctx.case.id)
    return { decided: rows.length, laterChanged: rows.filter((d) => d.laterChanged).length, onTime: rows.filter((d) => d.onTime).length }
  })()
  const experienced = k.novelty === "new" ? isExperienced(typeRecord) : isExperienced(record)
  const variant: OpenerVariant =
    k.novelty === "new" ? "new" : k.decided === 1 ? "once" : k.novelty === "rare" ? "rare" : experienced ? "known_experienced" : "known_newer"
  return { variant, experienced, record }
}

function optionsLine(c: Case): string {
  const alts = c.alternatives.filter(Boolean).map((a) => lc(a.label))
  return `You can ${lc(c.suggestion.label)} (my suggestion)${alts.length ? `, or ${alts.join(", or ")}` : ""}.`
}

function suggestionLine(c: Case, tail = ""): string {
  return `My suggestion${tail}: ${lc(sentence(c.suggestion.label))}`
}

/** Less than 70 % agreeing: people answer this kind differently, and the opener says so. */
const split = (k: CaseKnowledge) => k.decided > 0 && k.sameAsSuggestion / k.decided < 0.7

function agreement(k: CaseKnowledge): string {
  if (k.sameAsSuggestion === 0) return `${k.decided} earlier cases of this kind, where people chose otherwise`
  if (split(k)) return `${k.sameAsSuggestion} of ${k.decided} earlier cases of this kind, though people answer this differently`
  return `${k.sameAsSuggestion} of ${k.decided} earlier cases of this kind, where people chose the same`
}

function lastTime(p: Precedent): string {
  return `${p.decidedBy} decided it on ${day(p.at)} at ${p.place} and ${chosePhrase(p.choice)}.`
}

function reasonLine(p: Precedent): string {
  return p.why ? `The reason given: "${p.why.replace(/^"|"$/g, "").trim()}"` : "No reason was written down."
}

export function openerText(ctx: ChatCaseContext, k: CaseKnowledge, shape: OpenerShape): string {
  const c = ctx.case
  const basis = restsOn(c.facts)
  const problem = sentence(c.headline)
  const needs = needsYou(c.reasons)
  const last = k.precedents[0]
  const lines: string[] = []

  switch (shape.variant) {
    case "known_experienced": {
      lines.push(`${suggestionLine(c)} ${problem}`)
      const one = restsOn(c.facts, 1)
      lines.push(`It rests on ${one ? `${one}, and on ` : ""}${agreement(k)}. Your call.`)
      break
    }
    case "known_newer": {
      lines.push(`Here is the problem: ${problem}`)
      if (needs) lines.push(needs)
      lines.push(optionsLine(c))
      lines.push(`People at Bahn have decided this kind of case ${plural(k.decided, "time")}, and ${k.sameAsSuggestion} of them chose my suggestion${split(k) ? ", so people answer this differently" : ""}.${last ? ` The last time, ${lastTime(last)}` : ""}`)
      lines.push(`My suggestion rests on ${basis ?? "the facts below"}. Ask me anything about it. The decision is yours.`)
      break
    }
    case "once": {
      lines.push(`This has happened once before. ${last ? lastTime(last) : ""}`.trim())
      if (last) lines.push(reasonLine(last))
      if (!shape.experienced) {
        lines.push(`Here it is the same problem: ${problem}`)
        lines.push(optionsLine(c))
      }
      lines.push(`${suggestionLine(c, " here")} With one case behind it, it is your call.`)
      break
    }
    case "rare": {
      const who = names(k.precedents.map((p) => p.decidedBy))
      lines.push(`This has happened ${plural(k.decided, "time")} before, decided by ${who}. ${k.sameAsSuggestion} of them chose my suggestion.`)
      if (last) lines.push(`The last time, ${lastTime(last)} ${reasonLine(last)}`)
      if (!shape.experienced) {
        lines.push(`Here is the problem: ${problem}`)
        lines.push(optionsLine(c))
      }
      lines.push(`${suggestionLine(c)} With so few cases behind it, it is your call.`)
      break
    }
    case "new": {
      lines.push(`This has not happened before: nobody at Bahn has decided a case like this yet (${lc(k.kindLabel)}).`)
      lines.push(problem)
      if (!shape.experienced) {
        if (needs) lines.push(needs)
        lines.push(optionsLine(c))
      }
      lines.push(`${suggestionLine(c)} It rests on ${basis ?? "the facts the agent found today"}, not on earlier cases.`)
      lines.push("Your answer will be the first one for this kind. The decision is yours.")
      break
    }
  }
  return lines.filter(Boolean).join("\n")
}

/** What the opener looked at, shown as quiet steps above it. */
function openerSteps(ctx: ChatCaseContext, k: CaseKnowledge): ChatToolStep[] {
  const steps: ChatToolStep[] = [{ id: "opener-read-case", tool: "read_case", label: "Read the case", status: "done" }]
  if (ctx.calls.length) steps.push({ id: "opener-calls", tool: "get_calls", label: ctx.calls.length === 1 ? `Read the call with ${ctx.order.pickup.name}` : `Read ${ctx.calls.length} calls`, status: "done" })
  steps.push({
    id: "opener-precedents",
    tool: "get_precedents",
    label: k.decided ? `Looked up ${plural(k.decided, "earlier case")} of this kind` : "Looked up earlier cases of this kind: none",
    status: "done",
  })
  return steps
}

export function buildOpener(ctx: ChatCaseContext, k: CaseKnowledge, at = new Date().toISOString()): ChatMessage & { variant: OpenerVariant } {
  const shape = openerShape(ctx, k)
  return {
    id: `opener-${ctx.case.id}-${ctx.person.id}`,
    caseId: ctx.case.id,
    role: "agent",
    text: openerText(ctx, k, shape),
    via: "text",
    at,
    toolSteps: openerSteps(ctx, k),
    variant: shape.variant,
  }
}
