// View shapes the screens read. They are built only from the contract types in
// ./types.ts plus a few display fields (names, order summary) that the screens
// need and the contract does not carry. The foundation API (/api/cr/*) should
// return exactly these shapes; see app-notes/ui.md for the mapping.

import type { Call, Case, Decision, Lesson, OpsPerson, TrackRecord, TrustRule } from "./types"

/** The few order facts a person needs to recognise an order. Built from the seeded dataset. */
export interface OrderSummary {
  orderId: string // "ord-00458"
  reference: string // "CD-420458"
  vehicle: string // "Ferrari Roma"
  vehicleDetail?: string // "2023, petrol"
  plate?: string
  vin?: string
  customer: { id: string; name: string; country: string }
  status: string // Bahn's portal words: "New", "Confirmed", "Finding a driver", "Driver booked", "Waiting for pickup"
  routeKind: "Domestic" | "Import"
  distanceKm?: number
  pickup: Endpoint
  delivery: Endpoint
  driver?: { name: string; feeEur?: number }
  gig?: { feeEur: number; state: string } // "Gig posted", "Driver booked"
  documents?: { label: string; state: string }[] // "Release document", "Missing"
}

export interface Endpoint {
  placeId?: string
  placeName: string // "Calverona Hamburg" or "Private address"
  address: string
  city: string
  country: string // ISO 2
  timezone: string // IANA
  contact?: string // "Jasper Alderfield, site desk. Not confirmed."
  hours?: string // "Mon to Fri 08:30–19:00, Sat 09:00–13:00"
  instruction?: string
  window?: { start: string; end: string; label: string } // label: "Pickup slot" | "Delivery promise"
}

/** A case with what a row or a panel needs around it. */
export interface CaseCard {
  case: Case
  order: OrderSummary
  ruleUsed?: TrustRule // set when status is handled_by_agent
}

export interface DeskView {
  asOf: string // the room clock
  person: OpsPerson
  people: OpsPerson[] // for the person switcher
  decision: CaseCard | null // the one decision in the middle
  queue: CaseCard[] // the rest of this person's cases, most urgent first
  agentWorking: CaseCard[] // cases the agent is still working on for this desk
  handledByAgent: CaseCard[] // cases a trust rule let the agent decide today
  quiet: { ordersChecked: number; checkedAt: string; notChecked: number }
}

/** Text the agent drafted for a message option, in the recipient's language with an English line. */
export interface Draft {
  to: string // "Kovellin Automobilhandel, by email"
  language: string // "de"
  text: string
  translation?: string // English, shown as "Translated"
}

export interface CaseDetail {
  asOf: string
  person: OpsPerson
  people: OpsPerson[]
  card: CaseCard
  calls: Call[]
  lessonsUsed: (Lesson & { source?: LessonSource })[]
  drafts: Record<string, Draft> // by option id
  whyChoices: Record<string, string[]> // by option id: three likely reasons, written as reusable rules
  decision?: Decision // the decision already taken, if any
  decidedBy?: OpsPerson
  queue?: { index: number; total: number; prevId?: string; nextId?: string } // position in this person's queue
}

/** Who and what a lesson came from, for the line under it. */
export interface LessonSource {
  personName: string
  at: string
  orderReference?: string
  placeName?: string
}

export interface EvidenceRow {
  caseId: string
  orderReference?: string
  placeName: string
  at: string
  personName: string
  personChose: string // "Accepted the €35 fee"
  agentWouldHave: string // same wording when it matched
  matched: boolean
}

export interface LeadView {
  asOf: string
  person: OpsPerson
  people: OpsPerson[]
  today: {
    since: string // shift start, ISO
    ordersChecked: number
    checkedAt: string
    casesToPeople: number
    decided: number
    waiting: number
    handledByAgent: number
    medianMinutesToDecide: number | null
  }
  trackRecords: TrackRecord[]
  caseTypes: { type: string; label: string; country?: string; phrase?: string }[] // the rows of the coverage table
  lessons: (Lesson & { source?: LessonSource })[]
  trustRules: (TrustRule & { placeName?: string; usedCount?: number })[]
  evidence: Record<string, EvidenceRow[]> // by trust rule id
  money: { wastedTripsAvoided: number; costPerWastedTrip: number; basis: string }
}
