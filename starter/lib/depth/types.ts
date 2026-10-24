// Baseline depth for one order's case: the records a colleague would have on
// file beyond the challenge dataset (a short message thread, a call, a note,
// the documents, the pickup place's people, hours and earlier pickups). Made up
// and deterministic (lib/depth/generate.ts); stored in cr_case_depth by
// `npm run db:seed:cr`; read by the chat tools (lib/chat/tools.ts).

/** Bump when the generator's output changes, so stored rows are regenerated on read. */
export const DEPTH_VERSION = 1

export interface DepthMessage {
  id: string
  at: string
  from: string
  fromKind: "bahn" | "pickup_place" | "customer"
  to: string
  channel: "email" | "sms"
  language: string
  text: string
  /** English translation; absent when the text is English. */
  english?: string
}

export interface DepthCall {
  id: string
  startedAt: string
  /** Who at Bahn called (a desk, never a named colleague). */
  by: string
  with: string
  language: string
  outcome: "answered" | "no_answer" | "voicemail"
  minutes: number
  turns: { speaker: "bahn" | "pickup_place"; text: string; english?: string }[]
}

export interface DepthNote {
  at: string
  by: string
  text: string
}

export interface DepthDocument {
  name: string
  status: string
  detail: string
}

export interface DepthContact {
  name: string
  role: string
  phone: string
  email: string
  language: string
}

export interface DepthPickup {
  reference: string
  when: string
  car: string
  driver: string
  handedOverBy: string
  outcome: string
}

export interface CaseDepth {
  v: number
  orderId: string
  reference: string
  caseId: string | null
  caseType: string | null
  /** Always true: made-up baseline, never the challenge dataset. */
  synthetic: true
  car: { colour: string; mileageKm: number; keys: string; condition: string }
  customerContact: DepthContact
  place: {
    name: string
    phone: string
    email: string
    answersThePhone: string
    contacts: DepthContact[]
    openingHours: Record<string, string>
    hoursSource: string
    handoverRoutine: string
    quirks: string[]
  }
  /** Empty when the dataset already holds messages for the order (they stay the thread). */
  messages: DepthMessage[]
  calls: DepthCall[]
  notes: DepthNote[]
  documents: DepthDocument[]
  earlierPickups: DepthPickup[]
}
