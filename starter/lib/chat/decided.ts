// A decided case in the chat's own words: who decided, when, what went out, and what the agent does
// next. The prompt states it (so the model can never say nothing was sent), and the thread gets the
// same line as a stored agent message the moment the decision is saved (actions.ts decide), whichever
// way it was made: the chat's yes, the card's button or the email sheet.

import type { ChatMessage } from "@/lib/control-room/types-chat"
import type { ChatCaseContext } from "./context"
import { caseOptions, draftOf, nextWords } from "./tools"

const LANG: Record<string, string> = { de: "German", da: "Danish", sv: "Swedish", fr: "French", fi: "Finnish", en: "English", nl: "Dutch" }
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })

/** The chat message that marks a decision in the thread (rendered as the "Decided at" line). */
export type DecidedMessage = ChatMessage & { decided: { at: string; by: string } }
export const isDecided = (m: ChatMessage): m is DecidedMessage => !!(m as Partial<DecidedMessage>).decided

export interface DecidedFacts {
  by: string
  at: string // "12:26", Helsinki
  iso: string
  label: string
  sent?: string // "The email in German to Kovellin Automobilhandel"
  next: string // "Next, the agent calls Calverona Hamburg. The agent checks ...", or the call it made
  edited?: string // the person's own text of the email, when they changed it
}

/** The latest decision on this case, or null while it waits. */
export function decidedFacts(ctx: ChatCaseContext): DecidedFacts | null {
  const d = [...ctx.snap.decisions].reverse().find((x) => x.caseId === ctx.case.id)
  if (!d || ctx.case.status === "waiting_for_person") return null
  const option = caseOptions(ctx).find((o) => o.id === d.optionId)
  const draft = option ? draftOf(ctx, option) : undefined
  const by = ctx.people.find((p) => p.id === d.personId || p.id.replace(/^p-/, "") === d.personId.replace(/^p-/, ""))?.name ?? "a person"
  const who = draft?.to.split(/,\s*/)[0]
  const noun = draft && /e-?mail/i.test(draft.to) ? "email" : "message"
  const sent = draft
    ? `The ${noun}${draft.language !== "en" ? ` in ${LANG[draft.language] ?? draft.language}` : ""} to ${who}${d.editedDetail ? `, with ${by}'s own changes,` : ""}`
    : undefined
  // Once the call-back has run (the thread read again, a reload): what the agent did, in its own words,
  // as the receipt says it. The steps after the agent's last proposal are what it did after the decision.
  const steps = ctx.case.agentSteps
  let last = -1
  steps.forEach((step, i) => step.kind === "propose" && !/^Brought a person/.test(step.summary) && (last = i))
  const call = last >= 0 ? steps.slice(last + 1).find((step) => step.kind === "call") : undefined
  const next = [call ? call.summary : `Next, the agent calls ${ctx.order.pickup.name}.`, option ? nextWords(option) : ""].filter(Boolean).join(" ")
  return { by, at: hhmm(d.at), iso: d.at, label: option?.label ?? "Something else", sent, next, edited: d.editedDetail }
}

/** "Decided by Aino at 12:26: Ask the customer ... The email in German to Kovellin Automobilhandel went out at 12:26. Next, ..." */
export function decidedLine(f: DecidedFacts): string {
  return `Decided by ${f.by} at ${f.at}: ${f.label.replace(/[.?]$/, "")}.${f.sent ? ` ${f.sent} went out at ${f.at}.` : ""} ${f.next}`.trim()
}

/** For the prompt: the decision as settled fact, with what the model must never say. */
export function decidedBlock(ctx: ChatCaseContext): string {
  const f = decidedFacts(ctx)
  if (!f) return ""
  return [
    `# The decision (settled)`,
    `${decidedLine(f)}`,
    `This case is decided and no longer waits for anyone. ${f.sent ? `${f.sent} has been sent. ` : ""}Never say that nothing was sent or that it still waits for a tap, and never offer an option. Earlier lines in this conversation such as "Sending the email" or "nothing happens before you tap" were before the decision.`,
  ].join("\n")
}
