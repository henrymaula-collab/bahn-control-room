import type { Option } from "@/lib/control-room/types"
import type { Draft } from "@/lib/control-room/views"

// The decision asked as a question, answered by a short verb (iOS alerts and
// notification actions: the button names the result, never "OK" or "Approve").
// Built from the option itself, so it works for any case the engine or the agent
// writes; nothing here knows a particular order.

/** "Email Kovellin and keep the pickup unbooked until the release arrives?" */
export function questionFor(option: Option): string {
  const label = option.label.trim().replace(/[.?]$/, "")
  return `${label}?`
}

/** The default answer as a short verb: "Send the email", "Withdraw the gig", "Release Yara". */
export function answerFor(option: Option, draft?: Draft): string {
  const kinds = option.changes.map((c) => c.kind).filter((k) => k !== "none")
  const onlyAMessage = kinds.length === 1 && (kinds[0] === "customer_message" || kinds[0] === "driver_message")
  if (onlyAMessage) {
    const channel = `${draft?.to ?? ""} ${option.changes[0]?.detail ?? ""}`.toLowerCase()
    return /e-?mail/.test(channel) ? "Send the email" : "Send the message"
  }
  const words = option.label.trim().replace(/[.?]$/, "")
  const cut = words.search(/\s(to|and|until|so|we|because|instead|as)\s/)
  const head = cut > 0 ? words.slice(0, cut) : words
  return head.split(/\s+/).length >= 2 ? head : words
}
