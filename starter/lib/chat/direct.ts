// "Send the email" and "show me the email" answered without a model: the words are a command, not a
// question, so the agent reads the order (a real lookup, shown as the step line), offers the option
// that sends the email (the same propose_option check the model's offer goes through) and says one
// short sentence. The panel does the rest: "send" runs the send window and then the card's decision,
// "show" puts the email in the conversation. Anything the case cannot do this way goes to the model.

import type { Option } from "@/lib/control-room/types"
import { type AnswerInput, type AnswerResult, Steps } from "./brain"
import { type ChatDraft, type ChatIntent, type ChatOffer, sendsOnly } from "./intent"
import { buttonLabel, caseOptions, chatSummary, draftOf, proposeOption } from "./tools"

/**
 * The option "send the email" names: one whose whole button is "Send the email" (or "message"). For
 * "show me the email" without one, the suggestion's own message, if it sends one.
 */
export function emailOption(input: Pick<AnswerInput, "ctx">, intent: ChatIntent): Option | undefined {
  const options = caseOptions(input.ctx)
  const send = options.find((o) => !!draftOf(input.ctx, o) && sendsOnly(buttonLabel(o)))
  if (send || intent === "send") return send
  return draftOf(input.ctx, input.ctx.case.suggestion) ? input.ctx.case.suggestion : undefined
}

const languages: Record<string, string> = {
  de: "German",
  da: "Danish",
  sv: "Swedish",
  fr: "French",
  fi: "Finnish",
  en: "English",
  nl: "Dutch",
  it: "Italian",
  es: "Spanish",
  pl: "Polish",
}

export async function directAnswer(input: AnswerInput, intent: ChatIntent): Promise<AnswerResult | null> {
  const { ctx } = input
  if (ctx.case.status !== "waiting_for_person") return intent === "show" ? sentEmail(input) : null
  const option = emailOption(input, intent)
  if (!option) return null
  const steps = new Steps(ctx, input.emit)
  await steps.call("get_order")
  const asked = [...input.history.filter((m) => m.role === "person").map((m) => m.text), input.text]
  const p = proposeOption(ctx, { option_id: option.id, summary: chatSummary(asked) }, chatSummary(asked))
  const action = p.action as ChatOffer | undefined
  if (!action?.draft) return null
  input.emit({ type: "action", action })
  const { who, lang, noun } = words(action.draft)
  const text =
    intent === "send"
      ? `Sending the ${noun} to ${who}${lang}. You can take it back for a few seconds.`
      : `Here is the ${noun} to ${who}${lang}. Send it from here, or see it whole to change the words first.`
  stream(input, text)
  return { text, toolSteps: steps.list, action, email: intent === "show" ? action.draft : undefined, provider: "mock", model: "direct" }
}

/** A decided case (History): the email that went, with the person's own changes, and when. */
async function sentEmail(input: AnswerInput): Promise<AnswerResult | null> {
  const { ctx } = input
  const decision = [...ctx.snap.decisions].reverse().find((d) => d.caseId === ctx.case.id)
  const option = decision && caseOptions(ctx).find((o) => o.id === decision.optionId)
  const draft = option && draftOf(ctx, option)
  if (!decision || !draft) return null
  const steps = new Steps(ctx, input.emit)
  await steps.call("get_order")
  const email = decision.editedDetail ? { ...draft, text: decision.editedDetail, translation: undefined } : draft
  const { who, lang, noun } = words(email)
  const text = `Here is the ${noun} that went to ${who}${lang}, at ${clock(decision.at)}.`
  stream(input, text)
  return { text, toolSteps: steps.list, email, provider: "mock", model: "direct" }
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Helsinki" })

function words(draft: ChatDraft) {
  return {
    who: draft.to.split(/,\s*/)[0],
    lang: draft.language !== "en" ? `, in ${languages[draft.language] ?? draft.language}` : "",
    noun: /e-?mail/i.test(draft.to) ? "email" : "message",
  }
}

function stream(input: AnswerInput, text: string) {
  for (const part of text.match(/\S+\s*/g) ?? [text]) input.emit({ type: "delta", text: part })
}
