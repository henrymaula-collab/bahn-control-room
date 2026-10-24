// The scripted chat agent for tests and for a fresh clone without keys. It
// picks lookups the way the model would, runs them for real (read-only), and
// answers from the case, the lookups and the precedents in Bahn's words.

import type { CaseKnowledge } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { earlierOfKind } from "./knowledge"
import type { ChatToolName } from "./tools"
import { chosePhrase, day, dayTime, lc, names, plural, rankFacts, restsOn, sentence, sourcePhrase } from "./words"

export interface MockPlan {
  intent: "precedents" | "call" | "customer" | "documents" | "time" | "why" | "summary"
  tools: ChatToolName[]
}

export function mockPlan(text: string, ctx: ChatCaseContext): MockPlan {
  const t = text.toLowerCase()
  if (/\b(before|last time|earlier|usually|others|other people|precedents?|happened|who decided|did people|how did)\b/.test(t)) return { intent: "precedents", tools: ["get_precedents"] }
  if (/\b(call|called|said|say|says|phone|told|answer(ed)?)\b/.test(t)) return { intent: "call", tools: ctx.calls.length ? ["get_calls"] : ["get_conversations"] }
  if (/\b(customer|dealer|message|draft|email|e-mail|write|send)\b/.test(t)) return { intent: "customer", tools: ["get_conversations"] }
  if (/\b(document|documents|release|paper|papers|cmr)\b/.test(t)) return { intent: "documents", tools: ["get_documents", "get_pickup_place"] }
  if (/\b(when|time|deadline|slot|late|hours?|delivery date|promise|today|tomorrow)\b/.test(t)) return { intent: "time", tools: ["get_time_windows"] }
  if (/\b(why|suggest|suggestion|recommend|sure|instead|alternative|alternatives|option|options|what if|risk)\b/.test(t)) return { intent: "why", tools: ["get_precedents", "get_pickup_place"] }
  return { intent: "summary", tools: ["get_order", "get_precedents"] }
}

const ENDINGS = ["Your call.", "The decision is yours.", "Up to you."]

function parse(content: string | undefined): Record<string, unknown> {
  try {
    return content ? (JSON.parse(content) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const factStatements = (r: Record<string, unknown>): string[] => ((r.facts as { statement: string }[] | undefined) ?? []).map((f) => f.statement)

export function mockAnswer(input: {
  ctx: ChatCaseContext
  knowledge: CaseKnowledge
  plan: MockPlan
  results: Partial<Record<ChatToolName, string>>
  turn: number
  via: "text" | "voice"
  experienced: boolean
}): string {
  const { ctx, knowledge: k, plan, results } = input
  const c = ctx.case
  const s = c.suggestion
  const ending = ENDINGS[input.turn % ENDINGS.length]
  const basis = restsOn(c.facts)
  const earlier = earlierOfKind(ctx.history, k.kindKey, c.id)
  const last = earlier[0]
  const out: string[] = []

  switch (plan.intent) {
    case "precedents": {
      if (!earlier.length) {
        out.push(`Nobody at Bahn has decided a case of this kind before, so there is nothing to copy.`)
        out.push(`My suggestion rests on ${basis ?? "what the agent found today"}, and your answer will be the first one for this kind.`)
      } else if (earlier.length === 1) {
        out.push(`Once. ${last.personName} decided it on ${day(last.at)} at ${last.placeName} and ${chosePhrase(last.choice)}.`)
        out.push(last.why ? `The reason given: "${last.why}"` : "No reason was written down.")
        out.push("One case is not a rule yet.")
      } else {
        const people = new Set(earlier.map((d) => d.personName)).size
        out.push(`${plural(earlier.length, "time")} before, by ${plural(people, "person", "people")}, and ${k.sameAsSuggestion} of them ${chosePhrase(s.label)}.`)
        out.push(`The last time, ${last.personName} ${chosePhrase(last.choice)} at ${last.placeName} on ${day(last.at)}${last.why ? `, because "${last.why}"` : ""}.`)
      }
      break
    }
    case "call": {
      const call = ctx.calls[ctx.calls.length - 1]
      const placeTurns = call?.turns.filter((t) => t.speaker === "pickup_place") ?? []
      if (call && placeTurns.length) {
        const said = placeTurns.map((t) => t.translation ?? t.text).slice(-2).join(" ")
        out.push(`On the call on ${dayTime(call.startedAt)}, ${ctx.order.pickup.name} said: "${said.trim()}"`)
      } else {
        const spoken = rankFacts(c.facts).find((f) => f.source.channel && f.source.channel !== "record")
        out.push(spoken ? `The latest word is ${sourcePhrase(spoken)}: ${sentence(spoken.statement)}` : `Nobody has said more than the order record yet.`)
      }
      out.push(`That is why I suggest you ${lc(s.label)}.`)
      break
    }
    case "customer": {
      const opt = [s, ...c.alternatives].find((o) => o.draft || o.changes?.some((ch) => ch.kind === "customer_message"))
      if (opt) {
        const msg = opt.draft?.translation ?? opt.draft?.text ?? opt.changes.find((ch) => ch.kind === "customer_message")?.detail ?? ""
        out.push(`If you choose "${opt.label}", the agent sends ${opt.draft?.to ? `${opt.draft.to}` : "the customer"} this: "${msg.trim()}"`)
        out.push("Nothing goes to the customer before you decide.")
      } else {
        out.push(`None of the options writes to the customer; the agent never contacts a customer on its own.`)
        out.push(`If you want the customer asked, choose another step and say so.`)
      }
      break
    }
    case "documents": {
      const docs = factStatements(parse(results.get_documents))
      const place = factStatements(parse(results.get_pickup_place)).find((x) => /release document|rule at handover/i.test(x))
      out.push(docs.length ? docs.slice(0, 2).join(" ") : "There are no documents on the order.")
      if (place) out.push(place)
      break
    }
    case "time": {
      const tw = factStatements(parse(results.get_time_windows))
      if (c.decideBy) out.push(`The latest useful moment to decide is ${dayTime(c.decideBy)} Helsinki time.`)
      out.push(...tw.slice(0, 2))
      break
    }
    case "why": {
      out.push(`I suggest you ${lc(s.label)}. ${sentence(c.headline)}`)
      out.push(`It rests on ${basis ?? "the facts on the case"}${k.decided ? ` and on ${k.sameAsSuggestion} of ${k.decided} earlier cases of this kind` : ", not on earlier cases"}.`)
      const alt = c.alternatives[0]
      if (alt) out.push(`If you ${lc(alt.label)} instead: ${lc(alt.effect)}`)
      break
    }
    case "summary": {
      out.push(`In short: ${sentence(c.headline)}`)
      out.push(`You can ${lc(s.label)} (my suggestion)${c.alternatives.length ? `, or ${c.alternatives.map((a) => lc(a.label)).join(", or ")}` : ""}.`)
      if (k.novelty === "new") out.push("This kind has not happened before.")
      else out.push(`People decided this kind ${plural(k.decided, "time")} before${earlier.length ? `, most recently ${names([last.personName])} on ${day(last.at)}` : ""}.`)
      break
    }
  }
  let body = out.filter(Boolean).map((x) => sentence(x))
  if (input.via === "voice" || input.experienced) body = body.slice(0, 2)
  return `${body.join(" ")} ${ending}`.replace(/\s+/g, " ").trim()
}
