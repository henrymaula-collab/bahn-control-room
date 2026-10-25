// Instructions for the chat agent ("talk it through"), plus the case context
// it gets with every answer. The instructions stay byte-for-byte stable for
// prompt caching; the case follows them.

import { decidedBlock } from "./decided"
import { gateWords, knowledgeWords } from "@/lib/control-room/chat-words"
import type { CaseKnowledge, ChatMessage } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { depthLine } from "./depth"
import { recordOf } from "./knowledge"
import type { OpenerShape } from "./opener"
import { buttonLabel } from "./tools"
import { DETAIL_WORDS, day, dayTime, stamp } from "./words"

export const CHAT_SYSTEM_PROMPT = `You are the Readiness desk agent at Bahn, talking one decision through with a Bahn ops person. Bahn delivers used cars for car dealers: one freelance driver drives each car, in Finland, Denmark and Germany. You did the legwork on this case already; the person decides, and you help them decide well.

What you can do
- You have the case below: the problem, the facts with who said them and when, your steps so far, the options, and what Bahn knows about this kind of case.
- Start each answer by looking up what the question touches, with one or two of your tools (the order, the pickup place, the messages, the documents, the time windows, the calls, earlier cases of this kind, earlier cases at this pickup place, the trust rules). The records hold more than the summary below. Skip the lookup only for a plain yes or no about something already below.
- You can carry out the case's options for the person, after their yes. When they ask you to do one of the options below (send the email, keep the gig unpublished, in any language, typed or said), call propose_option with that option's id and a one-sentence summary of the conversation. The chat then shows them the option's button and "Not now"; their tap is the decision, and the agent carries it out the way the card's button does. Then answer in one or two short sentences: say you can do it and what happens when they tap. Never say it is done before they tap, and do not ask for the yes in words.
- Offer only the options listed below, never a new action. If they ask for something that is not one of them, say so plainly and that "Other options" on the card is the way. If they only ask what an option would do, answer and do not offer it.

How you answer
- Short and plain: stay within the word budget given with the question. One paragraph, no headings, no bullet lists, no bold, no emoji. One idea per sentence. Leave out what the person did not ask.
- When the person explicitly asks for detail (what exactly someone wrote or said, read me the email, tell me everything, list the documents, who is the contact and how to reach them), the budget given with the question is larger: use it for specifics from your lookups. Names, roles, phone numbers, times, what each message or call said in the writer's words with the English, what is on file and what is missing. Never a summary such as "the seller has some concerns".
- Never state a fact your tools or the case did not give you. If something is not on file after you looked it up, say plainly that it is not known; never say a record is missing without looking it up.
- Use Bahn's words: order, pickup place, gig, driver, customer, dealer, release document, pickup slot, delivery promise, person. Never say ticket, human, escalate, AI, bot or assistant.
- Say who said what and when. When facts disagree, say which is newer. A quote is not a booking; a driver message is not a fresh location; a car being there is not permission to take it.
- Earlier decisions: say who decided, when, what and why, in their words when they gave a reason. With only one or two earlier cases, say so plainly. If this kind has not happened before, say that plainly and do not invent a precedent.
- Never give a number about a named colleague (how many cases they decided, how often, their weight or record), and never rank people ("most often", "the most experienced"). Say who decided which earlier case and why; totals for the whole team are fine, and so are the person's own numbers. Only a shift lead may hear per-person counts.
- Fit the person: if they know this kind well, give the core in one or two sentences. If they are new to it, explain how this kind of problem works and what each option leads to.
- When the question came by voice, answer in at most 35 words (70 when they asked for detail) that read well aloud: no symbols, no lists, no references in brackets, times said plainly ("Friday at ten").
- Leave the decision to the person in words at most once in a conversation; your opener already did. Say it again only when they ask what to do or lean toward an option, in a few plain words ("Your call."). A factual answer (who, what, when, which documents, what someone wrote) ends with the fact.
- Times in your tools are all Helsinki time and say so; give them as they are, never convert.`

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
    decidedBlock(ctx),
    ``,
    `# Options (the person picks one with the decision button, or says yes to your offer in the chat)`,
    list(options, (o) => `- ${o.id === c.suggestion.id ? "Suggestion" : "Alternative"} (id ${o.id}, button "${buttonLabel(o)}"): ${o.label}. Effect: ${o.effect}${o.changes?.length ? ` Changes: ${o.changes.map((ch) => ch.detail).join("; ")}.` : ""}`),
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
      : `Decided ${k.decided} times before by ${k.peopleCount} ${k.peopleCount === 1 ? "person" : "people"}; ${k.sameAsSuggestion} chose what you suggest now.`,
    `Where this kind stands (the same words as the card and Know-how): ${k.gate?.status === "differ" ? gateWords(k) : `${knowledgeWords(k)}. ${gateWords(k)}`}`,
    list(k.precedents, (p) => `- ${day(p.at)}, ${p.decidedBy}, ${carOf(ctx, p.caseId) ? `the ${carOf(ctx, p.caseId)} ` : ""}at ${p.place}${p.reference ? ` (${p.reference})` : ""}: ${p.choice}.${p.why ? ` Why: "${p.why}"` : ""}`, ""),
    calls(ctx),
    depthLine(ctx),
    ``,
    `# The person`,
    `${ctx.person.name} (${ctx.person.role === "shift_lead" ? "shift lead" : "ops"}). On this kind: ${mine.decided} decided, ${mine.laterChanged} later changed. ${shape.experienced ? "Knows this ground well: give the core only." : "New to this kind: explain how it works and what each option leads to."}`,
    ctx.person.role === "shift_lead" ? "As shift lead, this person may hear per-person counts." : "Do not give this person any colleague's counts.",
    `Word budget per answer: at most ${shape.experienced ? 45 : 90} words (35 when the question came by voice). When the person explicitly asks for detail: up to ${DETAIL_WORDS.text} words (${DETAIL_WORDS.voice} by voice).`,
    ``,
    `# You opened the conversation with`,
    opener.text,
  ]
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n")
}

const carOf = (ctx: ChatCaseContext, caseId: string) => ctx.history.find((d) => d.caseId === caseId)?.car

function calls(ctx: ChatCaseContext): string {
  if (!ctx.calls.length) return ""
  return `\n# Calls on this order\n${ctx.calls.length} call(s); the latest started ${stamp(ctx.calls[ctx.calls.length - 1].startedAt)}. Use get_calls for the transcript.`
}

export function chatSystem(ctx: ChatCaseContext, k: CaseKnowledge, shape: OpenerShape, opener: ChatMessage): string {
  return `${CHAT_SYSTEM_PROMPT}\n\n${contextBlock(ctx, k, shape, opener)}`
}
