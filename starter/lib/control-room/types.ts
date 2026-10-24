// Shared contract for the control room. Every workstream (engine, UI, agent)
// codes against these types. Change them only through the master.
//
// Words follow design/BAHN-VOCABULARY.md: order, pickup place, gig, driver,
// customer, release document, person (not "human"), desk names as in
// dataset/data/operators.jsonl.

/** Why an agent stopped and brought a person in. Bahn's own three gates, plus safety and our readiness reasons. */
export type CaseReason =
  | "costs_extra_money"
  | "moves_delivery_date"
  | "needs_the_customer"
  | "driver_safety"
  | "facts_disagree" // e.g. order says Tampere, notes say Helsinki
  | "pickup_place_not_answering"
  | "car_not_ready"
  | "papers_missing";

/** Readiness desk case types. Dotted so lessons and trust rules can match a family. */
export type CaseType =
  | "readiness.car_not_ready"
  | "readiness.facts_disagree"
  | "readiness.no_answer"
  | "readiness.release_document_missing"
  | "readiness.fee_requested"
  | "readiness.keys_or_access"
  | (string & {});

export type SourceKind =
  | "customer"
  | "pickup_place"
  | "driver"
  | "driver_app"
  | "person" // a Bahn ops person
  | "agent"
  | "record"; // a stored field in the dataset

/** A fact always says who said it, how, and when. */
export interface Fact {
  id: string;
  statement: string; // plain sentence, Bahn's words
  source: {
    kind: SourceKind;
    name?: string; // "Autohaus Becker, workshop", "Driver Jari", "Readiness agent"
    channel?: "call" | "message" | "email" | "app" | "record";
    recordRef?: string; // dataset table + id, e.g. "order_endpoint_details:oed-123"
    at: string; // ISO time
  };
  strength: "confirmed" | "stated" | "inferred" | "stale";
}

/** What the agent did before a person saw anything. */
export interface AgentStep {
  at: string;
  kind: "read" | "lookup" | "ask" | "call" | "message" | "wait" | "propose";
  summary: string; // "Called the pickup place. No answer.", past tense, short
  factIds?: string[];
  callId?: string;
}

/** A change an option would make. Anything but "none" needs a person's yes until a trust rule says otherwise. */
export interface Change {
  kind: "date" | "cost" | "booking" | "customer_message" | "driver_message" | "none";
  detail: string; // "Pickup moves from Thu 29 Oct to Fri 30 Oct"
  amountEur?: number;
}

export interface Option {
  id: string;
  label: string; // names the action: "Move pickup to Friday", never "Approve"
  effect: string; // what happens next, in one sentence
  changes: Change[];
}

export type CaseStatus =
  | "agent_working"
  | "waiting_for_person"
  | "decided" // a person chose; the agent carries it out
  | "done"
  | "handled_by_agent"; // a trust rule let the agent decide

export interface Case {
  id: string;
  orderId: string;
  desk: string; // operator desk id, e.g. "ops-readiness"
  type: CaseType;
  headline: string; // one sentence: what is wrong
  decideBy?: string; // ISO; the latest useful moment
  reasons: CaseReason[];
  facts: Fact[];
  agentSteps: AgentStep[];
  suggestion: Option;
  alternatives: Option[];
  status: CaseStatus;
  routedTo?: Routing;
  placeId?: string; // pickup place, so lessons can attach to it
  customerId?: string;
  lessonIdsUsed?: string[]; // lessons the agent applied to build this case
  createdAt: string;
}

/** Made-up ops team. No real people. */
export interface OpsPerson {
  id: string;
  name: string; // first name only
  role: "ops" | "shift_lead";
  desks: string[];
  languages: string[]; // "fi", "sv", "en", "de", "da"
  onShift: boolean;
}

/** A count, never a score or a rank (Henry + EU AI Act: no ranking lists). */
export interface TrackRecord {
  personId: string;
  caseType: CaseType;
  placeId?: string;
  country?: string;
  decided: number;
  laterChanged: number; // decisions that had to be undone or redone
  onTime: number; // deliveries that kept their promise after the decision
}

export interface Routing {
  personId: string;
  why: string; // "Sent to you because you have handled 6 empty pickups at this pickup place since August."
  mode: "best_record" | "learning" | "only_one_on_shift" | "monday_queue";
  at: string;
}

export interface Decision {
  id: string;
  caseId: string;
  personId: string;
  optionId: string | "other";
  editedDetail?: string; // what the person changed in the agent's suggestion
  why?: string; // one tap or one sentence, asked only when the person did not take the suggestion
  at: string;
}

/** A piece of know-how that came out of a decision. Reviewed by a shift lead before agents rely on it. */
export interface Lesson {
  id: string;
  scope: { caseType: CaseType; placeId?: string; customerId?: string; country?: string };
  text: string; // "Autohaus Becker releases cars only after the release document is e-mailed to the workshop."
  fromDecisionIds: string[];
  status: "proposed" | "accepted" | "retired";
  reviewedBy?: string;
  createdAt: string;
}

/** Earned trust: lets the agent decide one narrow kind of case alone. Always reversible. */
export interface TrustRule {
  id: string;
  caseType: CaseType;
  optionId?: string; // the option people kept choosing; matched against a case's options
  scope: { placeId?: string; customerId?: string; country?: string };
  when: string; // "The pickup place asks for a storage fee up to 50 EUR"
  then: string; // "Accept the fee and confirm pickup"
  evidence: { matched: number; total: number; caseIds: string[] }; // the agent would have decided like people did
  status: "suggested" | "on" | "off";
  changedBy?: string;
  changedAt?: string;
}

/** For every order, what was checked. "An order nobody checked is not fine." */
export interface OrderCheck {
  orderId: string;
  reference?: string; // Bahn's order reference, e.g. "CD-420593": show this, never the internal id
  state: "needs_person" | "checked_quiet" | "not_checked" | "agent_working";
  checkedAt?: string;
  checks: { label: string; ok: boolean; source: string; at?: string }[];
  caseId?: string;
}

/** One phone call made by the agent. The phone is simulated; the voices are real (ElevenLabs). */
export interface Call {
  id: string;
  caseId?: string;
  orderId: string;
  placeId?: string;
  language: string; // "de", "fi", "da", "en"
  startedAt: string;
  outcome: "answered" | "no_answer" | "voicemail";
  turns: { speaker: "agent" | "pickup_place"; text: string; translation?: string; at: string }[];
  audioUrl?: string; // pre-rendered mp3 under public/calls/
  factIds: string[]; // facts the call produced
}

/** One run of an agent, kept as a trace (Bahn asked for traces). */
export interface AgentRun {
  id: string;
  agent: "readiness";
  orderId: string;
  model: string;
  startedAt: string;
  endedAt?: string;
  steps: { at: string; type: "thinking" | "tool_call" | "tool_result" | "message"; name?: string; content: string }[];
  outcome: "case_for_person" | "resolved" | "waiting" | "error";
  caseId?: string;
}
