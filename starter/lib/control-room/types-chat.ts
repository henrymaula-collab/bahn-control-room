// Contract for the case chat ("talk it through with the agent") and the learning loop.
// The chat API serves these shapes; the chat UI builds on fixtures of the same shapes.
// Words in every string follow design/BAHN-VOCABULARY.md.

export type ChatRole = "person" | "agent";

/** One visible step the agent took while answering ("Read the order", "Looked up past cases at Calverona Hamburg"). */
export interface ChatToolStep {
  id: string;
  tool: string; // tool name in lib/agent
  label: string; // plain words for the person
  status: "running" | "done" | "failed";
}

export interface ChatMessage {
  id: string;
  caseId: string;
  role: ChatRole;
  personId?: string; // set on person messages
  text: string;
  via: "text" | "voice";
  at: string; // ISO
  toolSteps?: ChatToolStep[]; // agent messages only
}

/** One earlier decision on the same kind of case. */
export interface Precedent {
  caseId: string;
  reference: string; // "CD-420458"
  place: string; // "Calverona Hamburg"
  decidedBy: string; // first name
  at: string; // ISO
  choice: string; // the option label that was chosen
  why?: string; // the person's own reason, if given
  weight: number; // 0..1, how much this answer counts (track record in this kind of case)
}

/**
 * What the agent knows about this kind of case. "Kind" is a property of the case
 * (e.g. "Seller hold on the car"), not one pickup place.
 */
export interface CaseKnowledge {
  kindKey: string;
  kindLabel: string; // "Seller hold on the car"
  novelty: "new" | "rare" | "known"; // new = never decided before
  decided: number; // earlier decisions of this kind
  sameAsSuggestion: number; // of those, how many chose what the agent suggests now
  peopleCount: number; // how many different people decided them
  needed: number; // agreeing decisions needed before the agent may propose to do it alone
  precedents: Precedent[]; // newest first, at most 5
}

/** GET /api/cr/cases/:id/chat?person=<id> */
export interface ChatThread {
  caseId: string;
  knowledge: CaseKnowledge;
  opener: ChatMessage; // the agent's first message, shaped to the person's experience with this kind
  messages: ChatMessage[]; // earlier turns, oldest first
}

/**
 * The agent offers to carry out one of the case's own options (never a new one).
 * The chat shows it as one tap: the option's button label, plus "Not now".
 * Nothing happens until the person taps it; the tap is their decision.
 */
export interface ChatAction {
  optionId: string // the suggestion's or an alternative's id
  label: string // the option's own button label: "Send the email"
  summary: string // a short summary of the conversation, saved as the decision's reason
  next?: string // what the agent does once it is decided, from the option's effect
  draft?: { to: string; language: string; text: string; translation?: string } // the message this option sends, shown before the yes
}

/** POST /api/cr/cases/:id/chat  body { person, text, via } answers with text/event-stream of ChatEvent. */
export type ChatEvent =
  | { type: "thinking" }
  | { type: "tool"; step: ChatToolStep }
  | { type: "action"; action: ChatAction }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };
