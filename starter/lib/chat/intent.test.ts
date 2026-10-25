import assert from "node:assert/strict"
import { test } from "node:test"
import { chatIntent } from "./intent"

const cases: [string, "send" | "show" | null][] = [
  ["send the email", "send"], ["Send the email.", "send"], ["Send the email to the customer.", "send"],
  ["Okay. Then we send the email. Good.", "send"], ["can you send the email?", "send"], ["Please send it", "send"],
  ["ok send it", "send"], ["Go ahead and send the email", "send"], ["yes, send the message", "send"],
  ["can you show me the email", "show"], ["Show me the email", "show"], ["Can I see the email?", "show"], ["let me read the draft", "show"],
  ["should I send the email?", null], ["what happens if I send the email", null], ["don't send the email", null],
  ["Who is the contact at the pickup place?", null], ["Why would they not send a driver?", null], ["If I send it, when does the agent call?", null],
  ["Send the email. What happens then?", null], ["Send a driver", null],
]

test("send the email is the yes, show me the email asks for it, questions stay talk", () => {
  for (const [text, want] of cases) assert.equal(chatIntent(text), want, text)
})
