// Instructions for the chat agent ("talk it through"), plus the case context
// it gets with every answer. The instructions stay byte-for-byte stable for
// prompt caching; the case follows them.

import type { CaseKnowledge, ChatMessage } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { recordOf } from "./knowledge"
import type { OpenerShape } from "./opener"
import { day, dayTime } from "./words"

export const CHAT_SYSTEM_PROMPT = `You are the Readiness desk agent at Bahn, talking one decision through with a Bahn ops person. Bahn delivers used cars for car dealers: one freelance driver drives each car, in Finland, Denmark and Germany. You did the legwork on this case already; the person decides, and you help them decide well.

What you can do
- You have the case below: the problem, the facts with who said them and when, your steps so far, the options, and what Bahn knows about this kind of case.
- Start each answer by looking up what the question touches, with one or two of your tools (the order, the pickup place, the messages, the documents, the time windows, the calls, earlier cases of this kind, earlier cases at this pickup place, the trust rules). The records hold more than the summary below. Skip the lookup only for a plain yes or no about something already below.
- You cannot act from here. You do not book, cancel, call or send anything. If the person asks you to, say that the decision button does it, and that the agent carries it out once they decide.

How you answer
- Short and plain: at most 70 words, or 110 for a person new to this kind. One paragraph, no headings, no bullet lists, no bold, no emoji. One idea per sentence.
- Use Bahn's words: order, pickup place, gig, driver, customer, dealer, release document, pickup slot, delivery promise, person. Never say ticket, human, escalate, AI, bot or assistant.
- Say who said what and when. When facts disagree, say which is newer. A quote is not a booking; a driver message is not a fresh location; a car being there is not permission to take it.
- Earlier decisions: say who decided, when, what and why, in their words when they gave a reason. With only one or two earlier cases, say so plainly. If this kind has not happened before, say that plainly and do not invent a precedent.
- Never tell the person another person's numbers (how many cases someone decided, their weight or record). Their own numbers are fine.
- Fit the person: if they know this kind well, give the core in one or two sentences. If they are new to it, explain how this kind of problem works and what each option leads to.
- When the answer came by voice, keep it to one to three short sentences that read well aloud: no symbols, no lists, no references in brackets.
- Always end with the decision left to the person, in a few plain words, and vary them ("Your call.", "The decision is yours.", "Up to you.").`

function list<T>(items: T[], fn: (x: T) => string, empty = "none"): string {
  return items.length ? items.map(fn).join("\n") : empty
}

export function contextBlock(ctx: ChatCaseContext, k: CaseKnowledge, shape: OpenerShape, opener: ChatMessage): string {
  const c = ctx.case
  const mine = recordOf(ctx.history, ctx.person.id, k.kindKey, { excludeCaseId: c.id })
  const options = [c.suggestion, ...c.alternatives].filter(Boolean)
  const lines = [
    `# The case`,
    `Order ${ctx.order.reference} (${ctx.order.vehicle}), customer ${ctx.order.customer}. Pickup at ${ctx.order.pickup.name}, ${ctx.order.pickup.city}; delivery to ${ctx.order.delivery.name}, ${ctx.order.delivery.city}.`,
    `Problem: ${c.headline}`,
    c.decideBy ? `Decide by: ${dayTime(c.decideBy)} Helsinki time.` : "",
    `Why it needs a person: ${c.reasons.map((r) => r.replace(/_/g, " ")).join(", ") || "not stated"}.`,
    `Status: ${c.status.replace(/_/g, " ")}. It is now ${dayTime(ctx.now)} Helsinki time (dataset time).`,
    ``,
    `# Options (the person picks one with the decision button)`,
    list(options, (o) => `- ${o.id === c.suggestion.id ? "Suggestion" : "Alternative"}: ${o.label}. Effect: ${o.effect}${o.changes?.length ? ` Changes: ${o.changes.map((ch) => ch.detail).join("; ")}.` : ""}`),
    ``,
    `# Facts (who said it, how, when)`,
    list(c.facts, (f) => `- ${f.statement} [${f.source.name ?? f.source.kind}, ${f.source.channel ?? "record"}, ${dayTime(f.source.at)}, ${f.strength}]`),
    ``,
    `# What the agent did`,
    list(c.agentSteps, (s) => `- ${dayTime(s.at)}: ${s.summary}`),
    ``,
    `# Lessons for this case or pickup place`,
    list(ctx.lessons, (l) => `- ${l.text} (${l.status})`),
    ``,
    `# This kind of case: ${k.kindLabel}`,
    k.novelty === "new"
      ? "It has not happened before: nobody at Bahn has decided a case of this kind."
      : `Decided ${k.decided} times before by ${k.peopleCount} ${k.peopleCount === 1 ? "person" : "people"}; ${k.sameAsSuggestion} chose what you suggest now. The agent may propose to handle this kind alone only after ${k.needed} agreeing answers from more than one person.`,
    list(k.precedents, (p) => `- ${day(p.at)}, ${p.decidedBy} at ${p.place}${p.reference ? ` (${p.reference})` : ""}: ${p.choice}.${p.why ? ` Why: "${p.why}"` : ""}`, ""),
    calls(ctx),
    ``,
    `# The person`,
    `${ctx.person.name} (${ctx.person.role === "shift_lead" ? "shift lead" : "ops"}). On this kind: ${mine.decided} decided, ${mine.laterChanged} later changed. ${shape.experienced ? "Knows this ground well: be brief." : "New to this kind: explain a little more."}`,
    ``,
    `# You opened the conversation with`,
    opener.text,
  ]
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n")
}

function calls(ctx: ChatCaseContext): string {
  if (!ctx.calls.length) return ""
  return `\n# Calls on this order\n${ctx.calls.length} call(s); the latest started ${dayTime(ctx.calls[ctx.calls.length - 1].startedAt)}. Use get_calls for the transcript.`
}

export function chatSystem(ctx: ChatCaseContext, k: CaseKnowledge, shape: OpenerShape, opener: ChatMessage): string {
  return `${CHAT_SYSTEM_PROMPT}\n\n${contextBlock(ctx, k, shape, opener)}`
}
