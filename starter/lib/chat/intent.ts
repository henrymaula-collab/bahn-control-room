// What a person's words ask the chat to do with the case's email, before any model reads them
// (Henry, 25 Oct: saying "send the email" sends it; "can you show me the email" puts it in the chat).
// Pure, so the server (which answers) and the panel (which runs the send window) read the same words.

import type { ChatAction } from "@/lib/control-room/types-chat"

export type ChatIntent = "send" | "show"

/** The message an option sends, with the subject line when it is an email ("Ferrari Roma, CD-420458"). */
export type ChatDraft = NonNullable<ChatAction["draft"]> & { subject?: string }
/** The chat's offer as the server sends it: who the agent calls once it is decided (the pickup place), for the receipt. */
export type ChatOffer = Omit<ChatAction, "draft"> & {
  draft?: ChatDraft
  calls?: string
}

const MESSAGE = String.raw`(?:e-?mail|mail|message|draft|it)`
// A question about sending, a "not", or a condition is talk, never the yes.
const TALK = /\b(?:don'?t|do not|not|never|no|should|shall i|would it|what|why|how|when|whether|if|before|instead|later|wait)\b/i
const LEAD = String.raw`(?:ok(?:ay)?|yes|yeah|sure|good|great|fine|then|right|alright|so|please|go ahead and|go ahead|let'?s|we(?:'ll| will| can)?|i(?:'d| would) like to|i want you to|can you|could you|would you|will you|you can|just|and|now)`
const SEND = new RegExp(String.raw`^(?:${LEAD}[\s,.!]*)*send\b[^.?!]{0,40}?\b${MESSAGE}\b`, "i")
const SHOW = new RegExp(String.raw`\b(?:show|see|read|open|view)\b[^.?!]{0,24}?\b(?:the|that|this|your)\s+${MESSAGE}\b`, "i")

/** "send the email" (typed or said) is the yes; "show me the email" asks for the email itself; anything else is a question. */
export function chatIntent(raw: string): ChatIntent | null {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text || text.length > 160) return null
  // Several sentences ("Okay. Then we send the email. Good."): the last one that asks for something decides;
  // a question after it ("... What happens then?") keeps it talk.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .reverse()
  for (const s of sentences) {
    const polite = s.replace(/^(?:(?:ok(?:ay)?|yes|so|and)[\s,.!]*)?(?:can|could|would|will) you\b/i, "")
    if (SHOW.test(s) && !/\b(?:don'?t|not|never)\b/i.test(s)) return "show"
    if (SEND.test(s)) return TALK.test(polite) ? null : "send"
    if (/\?\s*$/.test(s)) return null
  }
  return null
}

/** Only an option whose whole button is "Send the email" (or "message") may be decided by saying so; "Release the driver" never. */
export const sendsOnly = (label: string) => /^send the (?:e-?mail|message)$/i.test(label.trim())
