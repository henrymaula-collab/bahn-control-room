// Night lab fixtures: a believable "Talk it through" thread for CD-420458 (Aino, Ferrari Roma at
// Calverona Hamburg), so chat shots need no API call. The answers are verbatim from the real chat
// path (app-notes/v4-depth-demo-qa.md, "The real chat path ... CD-420458", claude-code).
import type { ChatAction, ChatMessage, ChatToolStep } from "@/lib/control-room/types-chat"

export const FIXTURE_CASE = "case-ord-00458-agent"

const at = (min: number) => new Date(Date.parse("2026-10-21T10:00:00Z") + min * 60_000).toISOString()
const step = (id: string, tool: string, label: string): ChatToolStep => ({ id, tool, label, status: "done" })
const person = (id: string, text: string, min: number): ChatMessage => ({
  id, caseId: FIXTURE_CASE, role: "person", personId: "p-aino", text, via: "text", at: at(min),
})
const agent = (id: string, text: string, min: number, toolSteps: ChatToolStep[]): ChatMessage => ({
  id, caseId: FIXTURE_CASE, role: "agent", text, via: "text", at: at(min), toolSteps,
})

/** ?chat=thread: two questions and their answers after the opener. */
export const FIXTURE_MESSAGES: ChatMessage[] = [
  person("lab-q1", "How did earlier pickups at Calverona go?", 1),
  agent(
    "lab-a1",
    "Four earlier pickups at Calverona Hamburg went fine, but none involved a seller hold. On 19 Oct, Kaisa followed the branch on the handover point, and the pickup ran on time. On 29 Sep, Jonas held the driver until the workshop named Lukas Brandt, and the car left 40 minutes late. On 25 Sep, Lea paused the gig, and the branch confirmed within the hour. On 10 Aug, Jonas moved the pickup one day, and delivery was a day late. The workshop answers the phone, but the site desk can't say whether a release has arrived. Your call.",
    1,
    [step("lab-a1-s1", "get_place_history", "Looked up earlier cases at Calverona Hamburg")],
  ),
  person("lab-q2", "Who is the contact at the pickup place and how do I reach them?", 2),
  agent(
    "lab-a2",
    "Your contact is Lukas Brandt, who works in the workshop (Werkstatt) and is the storekeeper who releases cars. His number is +49 40 555 0142, and his email is werkstatt@calverona.example. He answered our call on Wed 21 Oct at 12:00 and said, \"Wir brauchen die unterschriebene Freigabe des Verkäufers per E-Mail\" (\"We need the seller's signed release by email\"). He added that the hold stays until it is lifted.\n\nThe other contact is Jasper Alderfield at the site desk, for bookings. His number is +49 40 555 0140, and his email is site-042@example.test. The site desk can't say whether a release has arrived. Releases sent to the general site address are not seen by the workshop the same day.\n\nThe workshop is open Mon to Fri 08:30 to 19:00 and Sat 09:00 to 13:00. Bahn promised Lukas an answer within the hour. Your call.",
    2,
    [step("lab-a2-s1", "get_place", "Looked up Calverona Hamburg"), step("lab-a2-s2", "get_calls", "Read the call with Calverona Hamburg")],
  ),
]

/** ?chat=thinking: a third question, the agent mid-answer (two steps, the first words streaming). */
export const FIXTURE_THINKING = {
  question: person("lab-q3", "Tell me everything about who the seller is and what they want before the car can go.", 3),
  live: {
    steps: [
      step("lab-a3-s1", "read_case", "Read the order"),
      { id: "lab-a3-s2", tool: "get_conversations", label: "Read the messages on this order", status: "running" } as ChatToolStep,
    ],
    text: "The seller is Rotherbach Sportwagen GmbH. The contact is Ilka Vossberg in accounting,",
  },
}

/** ?chat=offer: the person asks the agent to do it; the agent offers the suggestion as one tap. */
export const FIXTURE_OFFER: { question: ChatMessage; answer: ChatMessage; action: ChatAction } = {
  // The answer is the chat's own "act" wording (lib/chat/mock.ts) for this option.
  question: person("lab-q4", "Send the email to the customer.", 4),
  answer: agent(
    "lab-a4",
    "I can do that. Tap \"Send the email\" below and it is decided; then the agent checks with the branch again at 10:00 and keeps the gig unpublished until the release and the lifted hold are confirmed. Nothing happens before you tap.",
    4,
    [step("lab-a4-s1", "read_case", "Read the order")],
  ),
  action: {
    optionId: "ask_customer_for_release",
    label: "Send the email",
    summary: "Asked the customer to clear the seller hold and have the seller email the signed release; Lukas Brandt at the workshop needs it by email.",
    next: "The agent checks with the branch again at 10:00 and keeps the gig unpublished until the release and the lifted hold are confirmed.",
  },
}

const THINKING_MESSAGES = [...FIXTURE_MESSAGES, FIXTURE_THINKING.question]
const OFFER_MESSAGES = [...FIXTURE_MESSAGES, FIXTURE_OFFER.question, FIXTURE_OFFER.answer]

/** The thread's messages for a lab chat state (CD-420458 only; other cases keep their own). Stable arrays. */
export function fixtureMessages(caseId: string, chat: "thread" | "thinking" | "offer" | undefined): ChatMessage[] | null {
  if (!chat || caseId !== FIXTURE_CASE) return null
  return chat === "thread" ? FIXTURE_MESSAGES : chat === "thinking" ? THINKING_MESSAGES : OFFER_MESSAGES
}
