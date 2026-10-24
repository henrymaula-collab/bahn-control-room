// Fixtures for the case chat ("Talk it through"), in the shapes of ../types-chat.ts.
// Three demo states on the seeded cases, so the card can be built before the chat
// API (branch v4-chat) is merged:
//   new   case-420458, Aino: a seller's hold on the car. Nobody has decided one before.
//   once  case-420015, Aino: nobody confirms who releases the car. Mikko decided one, once.
//   known case-420516, Sofie: nobody can name the key holder. 14 of 16 agreeing answers, 3 people.
// The opener follows the person: someone with a record on the kind gets two lines,
// everyone else a short explanation of the problem and the options.
// Precedents, people and dates are made up (the team in people.ts is made up too).
// Replies are scripted: a few questions per case, matched by words, and one answer
// for anything else. The agent never acts from the chat; the decision button does.

import type { CaseKnowledge, ChatEvent, ChatMessage, ChatThread, ChatToolStep, Precedent } from "../types-chat"
import { hel, ROOM_NOW, today } from "./clock"

/** Agreeing answers needed before the agent may offer to handle a kind alone (the loop track's gate). */
export const NEEDED = 16

type Step = { tool: string; label: string }
type Reply = { match?: RegExp; steps: Step[]; text: string }

interface CaseScript {
  knowledge: Omit<CaseKnowledge, "needed">
  /** People with a record on this kind: they get the two-line opener. */
  experienced: string[]
  opener: { steps: Step[]; text: (personId: string) => string; short?: (personId: string) => string }
  replies: Reply[]
  fallback: Reply
}

const precedent = (p: Omit<Precedent, "caseId"> & { caseId?: string }): Precedent => ({ caseId: p.caseId ?? `case-${p.reference.slice(3)}`, ...p })

const SCRIPTS: Record<string, CaseScript> = {
  // Round 1: a new kind. The only seller's hold in the dataset.
  "case-420458": {
    knowledge: {
      kindKey: "seller_hold",
      kindLabel: "Seller hold on the car",
      novelty: "new",
      decided: 0,
      sameAsSuggestion: 0,
      peopleCount: 0,
      precedents: [],
    },
    experienced: [],
    opener: {
      steps: [
        { tool: "get_order", label: "Read the order" },
        { tool: "get_conversations", label: "Read the call with Calverona Hamburg" },
        { tool: "find_precedents", label: "Looked for earlier seller holds" },
      ],
      text: () =>
        [
          "This has not happened before. Nobody here has decided a seller's hold on a car.",
          "The seller stopped the handover until an invoice is paid, and Calverona's desk turns away any driver without a signed release. Only Kovellin can get the hold lifted, so I suggest emailing them and booking no driver until the release arrives.",
          "Or move the pickup to Wed 28 Oct, if Kovellin agrees to a later delivery. It is your call.",
        ].join("\n\n"),
    },
    replies: [
      {
        match: /\b(driver|book|booked|booking|anyway|monday|send someone)\b/i,
        steps: [
          { tool: "get_pickup_place", label: "Read Calverona Hamburg's pickup rules" },
          { tool: "get_conversations", label: "Read the call with Calverona Hamburg" },
        ],
        text: "The desk would send the driver away. On the call at 11:38 they said they refuse the handover until the seller clears the hold and sends a signed release, even if the old collection note is still visible. Booking now most likely means an empty pickup, but the call is yours.",
      },
      {
        match: /\b(wednesday|wed|28|move|later|push)\b/i,
        steps: [
          { tool: "get_time_windows", label: "Checked the pickup and delivery times" },
          { tool: "get_conversations", label: "Read the emails with Kovellin" },
        ],
        text: "Moving to Wed 28 Oct only helps if the seller clears the hold by then, and nobody has said they will. Kovellin would also have to agree to a later delivery.\n\nEmailing Kovellin now keeps Monday open, and you can still move the date on Friday if the release has not come. Which way is up to you.",
      },
      {
        match: /\b(how long|when|soon|wait|release|invoice|paid)\b/i,
        steps: [
          { tool: "get_conversations", label: "Read the emails with Kovellin" },
          { tool: "get_documents", label: "Checked the documents" },
        ],
        text: "Nobody can say yet. On Mon 19 Oct Kovellin asked the seller and heard the release might come that afternoon, but two days later no signed release is on the order. The customer can hand over from Mon 26 Oct, so there is still time if it comes this week. How long to wait is your call.",
      },
    ],
    fallback: {
      steps: [{ tool: "get_order", label: "Read the order again" }],
      text: "I can answer from this order, its calls and messages, and earlier cases. Here the seller's hold is what stops the pickup, and only Kovellin can get it lifted. What to do about it is up to you.",
    },
  },

  // Round 2's shape: a kind decided once. "Last time Mikko did this, and why. It is your call."
  "case-420015": {
    knowledge: {
      kindKey: "release_contact_unconfirmed",
      kindLabel: "Nobody confirms who releases the car",
      novelty: "rare",
      decided: 1,
      sameAsSuggestion: 1,
      peopleCount: 1,
      precedents: [
        precedent({
          reference: "CD-420277",
          place: "Tervavio Tampere",
          decidedBy: "Mikko",
          at: hel("2026-10-16", "15:10"),
          choice: "Tell the customer we are still calling the branch",
          why: "The customer could not reach the branch either. A new date only moves the problem.",
          weight: 0.5,
        }),
      ],
    },
    experienced: ["mikko"],
    opener: {
      steps: [
        { tool: "get_order", label: "Read the order" },
        { tool: "get_conversations", label: "Read the WhatsApp thread with Suvellio" },
        { tool: "find_precedents", label: "Found one earlier case like this" },
      ],
      text: (personId) =>
        [
          personId === "mikko"
            ? "This has happened once, to you. On Fri 16 Oct Tervavio Tampere would not say who releases a car either, and you told the customer we were still calling the branch."
            : "This has happened once. On Fri 16 Oct Tervavio Tampere would not say who releases a car either. Mikko told the customer we were still calling the branch and kept the pickup: the customer could not reach the branch either, so a new date would only move the problem.",
          "One case is not a pattern, so it is your call. I suggest the same here: tell Suvellio we are still calling Mervikko Espoo.",
        ].join("\n\n"),
    },
    replies: [
      {
        match: /\b(mikko|last time|before|earlier|why)\b/i,
        steps: [{ tool: "find_precedents", label: "Opened Mikko's case at Tervavio Tampere" }],
        text: "Mikko kept the pickup and told the customer we were still calling. His reason: the customer could not reach the branch either, so a new date would only move the problem. The branch named the person the next morning. It has happened once, so it is your call.",
      },
      {
        match: /\b(friday|fri|23|move|later)\b/i,
        steps: [{ tool: "get_time_windows", label: "Checked the pickup and delivery times" }],
        text: "Moving to Fri 23 Oct gives the branch a day, but Suvellio has to agree to a later delivery, and Mervikko Espoo has not answered anyone yet, us or the customer. Your call.",
      },
    ],
    fallback: {
      steps: [{ tool: "get_order", label: "Read the order again" }],
      text: "The branch has not answered twice today, and the release contact on the order has never been confirmed. The customer is waiting to hear from us; what we tell them is up to you.",
    },
  },

  // A known kind: enough answers that experienced people get two lines and decide.
  "case-420516": {
    knowledge: {
      kindKey: "key_holder_unknown",
      kindLabel: "Nobody can name the key holder",
      novelty: "known",
      decided: 15,
      sameAsSuggestion: 14,
      peopleCount: 3,
      precedents: [
        precedent({ reference: "CD-420122", place: "Velantora Helsinki", decidedBy: "Sofie", at: hel("2026-10-19", "10:40"), choice: "Ask the customer to name the key holder", why: "Stock control had not called back by noon the last time either.", weight: 0.9 }),
        precedent({ reference: "CD-420088", place: "Kervalin Frankfurt", decidedBy: "Jonas", at: hel("2026-10-14", "13:05"), choice: "Ask the customer to name the key holder", why: "The branch had three cars in transfer and no names.", weight: 0.8 }),
        precedent({ reference: "CD-420061", place: "Tervavio Tampere", decidedBy: "Emil", at: hel("2026-10-12", "09:20"), choice: "Ask the customer to name the key holder", weight: 0.6 }),
        precedent({ reference: "CD-420047", place: "Velantora Helsinki", decidedBy: "Sofie", at: hel("2026-10-09", "09:50"), choice: "Ask the customer to name the key holder", why: "Velantora's stock control rarely calls back the same day.", weight: 0.9 }),
        precedent({ reference: "CD-420019", place: "Velantora Helsinki", decidedBy: "Jonas", at: hel("2026-10-02", "14:30"), choice: "Wait for stock control", why: "The customer could not be reached that afternoon.", weight: 0.8 }),
      ],
    },
    experienced: ["sofie", "jonas"],
    opener: {
      steps: [
        { tool: "get_conversations", label: "Read the call with Velantora Helsinki" },
        { tool: "find_precedents", label: "Checked 15 earlier key cases" },
      ],
      short: (personId) =>
        [
          "Ask Auvelloria to name the key holder. Velantora's stock control gave no time for a call back, and it rarely calls the same day.",
          `This rests on the call at 11:24 and on ${personId === "sofie" ? "your" : "Sofie's"} lesson from 9 Oct.`,
        ].join("\n\n"),
      text: () =>
        [
          "Nobody at Velantora Helsinki can say who has the keys. Reception does not have them, stock control gave no time for a call back, and the customer still says reception has them.",
          "In cases like this, people almost always ask the customer to name the key holder, because stock control rarely calls back the same day. Waiting until 14:00 is the other way. It is your call.",
        ].join("\n\n"),
    },
    replies: [
      {
        match: /\b(anyone|ever|different|differently|other way|wait)\b/i,
        steps: [{ tool: "find_precedents", label: "Checked 15 earlier key cases" }],
        text: "Once. On Fri 2 Oct Jonas waited for stock control at Velantora, because the customer could not be reached that afternoon. The other 14 asked the customer to name the key holder. Your call.",
      },
    ],
    fallback: {
      steps: [{ tool: "get_conversations", label: "Read the call with Velantora Helsinki" }],
      text: "Reception has no keys and stock control gave no time, so the customer is the quickest way to a name. Up to you.",
    },
  },

  // The other two seeded cases get a plain thread, so every card can talk.
  "case-420347": {
    knowledge: {
      kindKey: "place_and_order_disagree",
      kindLabel: "Pickup place and order disagree",
      novelty: "known",
      decided: 14,
      sameAsSuggestion: 13,
      peopleCount: 3,
      precedents: [
        precedent({ reference: "CD-420301", place: "Arvelano Hamburg", decidedBy: "Lea", at: hel("2026-10-16", "13:40"), choice: "Pause the gig until the pickup place confirms", why: "The yard and the showroom are two addresses. A driver at the wrong one waits an hour.", weight: 0.8 }),
        precedent({ reference: "CD-420233", place: "Arvelano Hamburg", decidedBy: "Mikko", at: hel("2026-10-13", "10:15"), choice: "Pause the gig until the pickup place confirms", weight: 0.7 }),
      ],
    },
    experienced: ["mikko", "lea"],
    opener: {
      steps: [{ tool: "get_conversations", label: "Read this morning's call with Arvelano Hamburg" }],
      short: () =>
        [
          "Withdraw the gig until stock control calls back. Nobody can say if the car is at the showroom or the yard, and a driver could book the gig any minute.",
          "This rests on the call at 09:42 and on Lea's lesson about Arvelano's yard.",
        ].join("\n\n"),
      text: () =>
        [
          "The booking says showroom handover, the handover sheet says the nearby yard, and nobody at Arvelano Hamburg can confirm which. The gig is still posted, so a driver could book it now.",
          "People who decided cases like this almost always withdrew the gig until the place confirmed. Keeping it posted is the other way. It is your call.",
        ].join("\n\n"),
    },
    replies: [],
    fallback: {
      steps: [{ tool: "get_conversations", label: "Read the call with Arvelano Hamburg" }],
      text: "Stock control will call back by 15:00, 14:00 in Hamburg. Until then nobody knows which gate the car is behind. Your call.",
    },
  },
  "case-420593": {
    knowledge: {
      kindKey: "car_not_at_place",
      kindLabel: "Car not at the pickup place",
      novelty: "known",
      decided: 9,
      sameAsSuggestion: 8,
      peopleCount: 2,
      precedents: [
        precedent({ reference: "CD-420201", place: "Vellendor Munich", decidedBy: "Jonas", at: today("11:31"), choice: "Release the driver and pay it as an empty pickup", why: "The branch could not find the car and the customer cancelled.", weight: 0.8 }),
        precedent({ reference: "CD-420164", place: "Velantora Helsinki", decidedBy: "Emil", at: hel("2026-10-15", "12:10"), choice: "Release the driver and pay it as an empty pickup", weight: 0.6 }),
      ],
    },
    experienced: ["jonas"],
    opener: {
      steps: [{ tool: "get_conversations", label: "Read the chat with Yara" }],
      short: () =>
        [
          "Release Yara and pay it as an empty pickup. The car is not in Velantora's release queue, and her 30 minutes ran out at 11:27.",
          "This rests on the desk's answer and on Yara's last message.",
        ].join("\n\n"),
      text: () =>
        [
          "Yara has waited two hours at Velantora Helsinki and the BMW M4 is not there. The desk sees a similar car but will not hand it over, and the customer is asking their stock team.",
          "People usually release the driver and pay an empty pickup here. Asking Yara to wait until 12:30 is the other way. It is your call.",
        ].join("\n\n"),
    },
    replies: [],
    fallback: {
      steps: [{ tool: "get_conversations", label: "Read the chat with Yara" }],
      text: "Yara said she could wait 30 more minutes, and that ran out at 11:27. Nobody has written to her since. Whether she waits longer is up to you.",
    },
  },
}

// ---------- The fixture store: one thread per case and person ----------

const g = globalThis as unknown as { __crChatStore?: Map<string, ChatMessage[]> }
const store = () => (g.__crChatStore ??= new Map())
const key = (caseId: string, personId: string) => `${caseId}:${personId}`

/** Back to no messages (tests and the screenshot script). */
export function resetChatFixtures() {
  delete g.__crChatStore
}

/** The copies in a 40-row list talk like their original; engine ids ("p-aino") work too. */
const baseCase = (id: string) => id.replace(/-copy-\d+$/, "")
const basePerson = (id: string) => id.replace(/^p-/, "")

export function hasChat(caseId: string): boolean {
  return !!SCRIPTS[baseCase(caseId)]
}

const doneSteps = (caseId: string, steps: Step[]): ChatToolStep[] =>
  steps.map((s, i) => ({ id: `${caseId}-open-${i + 1}`, tool: s.tool, label: s.label, status: "done" }))

/** GET /api/cr/cases/:id/chat?person=<id> in fixture mode. */
export function fixtureThread(caseId: string, personId: string): ChatThread | null {
  const id = baseCase(caseId)
  const person = basePerson(personId)
  const s = SCRIPTS[id]
  if (!s) return null
  const twoLines = s.experienced.includes(person) && !!s.opener.short
  const opener: ChatMessage = {
    id: `${id}-opener-${person}`,
    caseId,
    role: "agent",
    text: twoLines ? s.opener.short!(person) : s.opener.text(person),
    via: "text",
    at: today("11:55"),
    toolSteps: doneSteps(id, s.opener.steps),
  }
  return {
    caseId,
    knowledge: { ...s.knowledge, needed: NEEDED },
    opener,
    messages: [...(store().get(key(id, person)) ?? [])],
  }
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve())

/** Words in small groups, as a model streams them. */
function chunks(text: string): string[] {
  const words = text.split(/(?<=\s)/)
  const out: string[] = []
  for (let i = 0; i < words.length; i += 2) out.push(words.slice(i, i + 2).join(""))
  return out
}

/**
 * POST /api/cr/cases/:id/chat in fixture mode: saves the person's message, then
 * thinking, each tool step (running, then done), the answer in small deltas, done.
 * `pace` scales the pauses (1 = demo speed, 0 = none, for tests).
 */
export async function* fixtureReply(
  caseId: string,
  personId: string,
  text: string,
  via: "text" | "voice",
  pace = 1,
): AsyncGenerator<ChatEvent> {
  const id = baseCase(caseId)
  const person = basePerson(personId)
  const s = SCRIPTS[id]
  if (!s) {
    yield { type: "error", message: "There is no conversation for this case." }
    return
  }
  const thread = store().get(key(id, person)) ?? []
  store().set(key(id, person), thread)
  thread.push({ id: nextId("msg"), caseId, role: "person", personId: person, text: text.trim(), via, at: ROOM_NOW })

  yield { type: "thinking" }
  await sleep(700 * pace)

  const reply = s.replies.find((r) => r.match?.test(text)) ?? s.fallback
  const steps: ChatToolStep[] = []
  for (const [i, st] of reply.steps.entries()) {
    const step: ChatToolStep = { id: nextId(`step${i + 1}`), tool: st.tool, label: st.label, status: "running" }
    yield { type: "tool", step }
    await sleep((650 + 250 * (i % 2)) * pace)
    const done: ChatToolStep = { ...step, status: "done" }
    steps.push(done)
    yield { type: "tool", step: done }
    await sleep(120 * pace)
  }

  for (const part of chunks(reply.text)) {
    yield { type: "delta", text: part }
    await sleep(38 * pace)
  }

  const message: ChatMessage = { id: nextId("msg"), caseId, role: "agent", text: reply.text, via, at: ROOM_NOW, toolSteps: steps }
  thread.push(message)
  yield { type: "done", message }
}
