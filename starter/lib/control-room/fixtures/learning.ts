import type { Lesson, TrackRecord, TrustRule } from "../types"
import type { EvidenceRow, LessonSource } from "../views"
import { hel, today } from "./clock"

// Lessons, trust rules and the team's track record. The track record is a
// synthetic history of past decisions (before the dataset snapshot); counts only,
// never scores.

export const LESSONS: Lesson[] = [
  // In use: the agents rely on these.
  {
    id: "lesson-kovellin-german",
    scope: { caseType: "readiness.release_document_missing", customerId: "cus-030", country: "DE" },
    text: "Kovellin answers within a day when the email about a seller's hold is written in German.",
    fromDecisionIds: ["dec-hist-1014-aino"],
    status: "accepted",
    reviewedBy: "kaisa",
    createdAt: hel("2026-10-14", "15:20"),
  },
  {
    id: "lesson-velantora-stock",
    scope: { caseType: "readiness.keys_or_access", placeId: "site-001" },
    text: "Velantora Helsinki's stock control rarely calls back the same day. Ask the customer to name the key holder.",
    fromDecisionIds: ["dec-hist-1009-sofie"],
    status: "accepted",
    reviewedBy: "kaisa",
    createdAt: hel("2026-10-09", "10:05"),
  },
  // Waiting for the shift lead's review.
  {
    id: "lesson-calverona-desk",
    scope: { caseType: "readiness.release_document_missing", placeId: "site-042" },
    text: "Calverona Hamburg checks the signed release at the branch desk. Email it to the desk, not only to the customer.",
    fromDecisionIds: ["dec-hist-1016-lea"],
    status: "proposed",
    createdAt: hel("2026-10-16", "14:12"),
  },
  {
    id: "lesson-arvelano-yard",
    scope: { caseType: "readiness.facts_disagree", placeId: "site-047" },
    text: "Arvelano Hamburg's showroom and yard lists often disagree. Ask stock control before the gig is posted.",
    fromDecisionIds: ["dec-hist-1020-mikko"],
    status: "proposed",
    createdAt: hel("2026-10-20", "16:40"),
  },
  {
    id: "lesson-empty-pickup-wait",
    scope: { caseType: "readiness.car_not_ready", country: "FI" },
    text: "When a driver offers to wait at the pickup place, write back within 15 minutes, even if nothing is known yet.",
    fromDecisionIds: ["dec-hist-1019-jonas"],
    status: "proposed",
    createdAt: hel("2026-10-19", "17:02"),
  },
]

export const LESSON_SOURCES: Record<string, LessonSource> = {
  "lesson-kovellin-german": { personName: "Aino", at: hel("2026-10-14", "15:20"), placeName: "Kovellin Automobilhandel" },
  "lesson-velantora-stock": { personName: "Sofie", at: hel("2026-10-09", "10:05"), placeName: "Velantora Helsinki" },
  "lesson-calverona-desk": { personName: "Lea", at: hel("2026-10-16", "14:12"), placeName: "Calverona Hamburg" },
  "lesson-arvelano-yard": { personName: "Mikko", at: hel("2026-10-20", "16:40"), placeName: "Arvelano Hamburg" },
  "lesson-empty-pickup-wait": { personName: "Jonas", at: hel("2026-10-19", "17:02"), placeName: "pickup places in Finland" },
}

export const TRUST_RULES: TrustRule[] = [
  {
    id: "rule-arvellumio-fee",
    caseType: "readiness.fee_requested",
    scope: { placeId: "site-074" },
    when: "Arvellumio Vehicle Hub Hamburg asks for a storage fee up to €40",
    then: "Accept the fee and confirm the pickup",
    evidence: { matched: 9, total: 9, caseIds: [] },
    status: "on",
    changedBy: "kaisa",
    changedAt: hel("2026-10-16", "09:30"),
  },
  {
    id: "rule-de-storage-fee",
    caseType: "readiness.fee_requested",
    scope: { country: "DE" },
    when: "A pickup place in Germany asks for a storage fee up to €50",
    then: "Accept the fee and confirm the pickup",
    evidence: {
      matched: 14,
      total: 14,
      caseIds: Array.from({ length: 14 }, (_, i) => `case-hist-fee-${i + 1}`),
    },
    status: "suggested",
  },
]

export const RULE_DISPLAY: Record<string, { placeName?: string; usedCount?: number }> = {
  "rule-arvellumio-fee": { placeName: "Arvellumio Vehicle Hub Hamburg", usedCount: 4 },
  "rule-de-storage-fee": {},
}

// The 14 past decisions behind the suggested rule. Places are pickup places in
// Germany from the dataset; the decisions themselves are the synthetic track record.
// No order references: these past orders are not in the dataset snapshot.
const FEE_ROWS: [string, string, string, number][] = [
  ["Arvellumio Vehicle Hub Hamburg", "2026-09-02", "Mikko", 35],
  ["Calverona Hamburg", "2026-09-04", "Jonas", 40],
  ["Arvelano Hamburg", "2026-09-09", "Mikko", 25],
  ["Kovellin Hamburg", "2026-09-11", "Aino", 50],
  ["Arvellumio Vehicle Hub Hamburg", "2026-09-15", "Jonas", 35],
  ["Norvarken Cologne", "2026-09-18", "Mikko", 30],
  ["Rovellavio Hamburg", "2026-09-22", "Aino", 45],
  ["Arvellumio Vehicle Hub Hamburg", "2026-09-25", "Mikko", 35],
  ["Calverona Hamburg", "2026-09-30", "Jonas", 40],
  ["Arvelano Hamburg", "2026-10-02", "Aino", 20],
  ["Arvellumio Vehicle Hub Hamburg", "2026-10-07", "Mikko", 35],
  ["Norvarken Cologne", "2026-10-09", "Jonas", 30],
  ["Kovellin Hamburg", "2026-10-13", "Aino", 50],
  ["Arvellumio Vehicle Hub Hamburg", "2026-10-15", "Mikko", 35],
]

export const EVIDENCE: Record<string, EvidenceRow[]> = {
  "rule-de-storage-fee": FEE_ROWS.map(([place, day, person, fee], i) => ({
    caseId: `case-hist-fee-${i + 1}`,
    placeName: place,
    at: hel(day, "10:00"),
    personName: person,
    personChose: `Accepted the €${fee} fee`,
    agentWouldHave: `Accept the €${fee} fee`,
    matched: true,
  })),
}

/** Counts of past decisions per person and case type. Never a score or a rank. */
export const TRACK_RECORDS: TrackRecord[] = [
  // Release documents at German pickup places: only Aino so far, Lea is learning.
  { personId: "aino", caseType: "readiness.release_document_missing", country: "DE", decided: 8, laterChanged: 0, onTime: 8 },
  { personId: "lea", caseType: "readiness.release_document_missing", country: "DE", decided: 1, laterChanged: 0, onTime: 1 },
  // Release documents in Finland.
  { personId: "aino", caseType: "readiness.release_document_missing", country: "FI", decided: 5, laterChanged: 0, onTime: 5 },
  { personId: "mikko", caseType: "readiness.release_document_missing", country: "FI", decided: 4, laterChanged: 1, onTime: 4 },
  { personId: "sofie", caseType: "readiness.release_document_missing", country: "FI", decided: 3, laterChanged: 0, onTime: 3 },
  // Keys and access.
  { personId: "sofie", caseType: "readiness.keys_or_access", decided: 9, laterChanged: 0, onTime: 9 },
  { personId: "aino", caseType: "readiness.keys_or_access", decided: 4, laterChanged: 0, onTime: 4 },
  { personId: "mikko", caseType: "readiness.keys_or_access", decided: 3, laterChanged: 1, onTime: 2 },
  { personId: "emil", caseType: "readiness.keys_or_access", decided: 1, laterChanged: 0, onTime: 1 },
  // Car not ready, empty pickups.
  { personId: "jonas", caseType: "readiness.car_not_ready", decided: 7, laterChanged: 0, onTime: 6 },
  { personId: "aino", caseType: "readiness.car_not_ready", decided: 4, laterChanged: 0, onTime: 4 },
  { personId: "sofie", caseType: "readiness.car_not_ready", decided: 3, laterChanged: 0, onTime: 3 },
  // Facts disagree.
  { personId: "mikko", caseType: "readiness.facts_disagree", decided: 6, laterChanged: 0, onTime: 6 },
  { personId: "aino", caseType: "readiness.facts_disagree", decided: 3, laterChanged: 0, onTime: 3 },
  { personId: "emil", caseType: "readiness.facts_disagree", decided: 2, laterChanged: 0, onTime: 2 },
  // Pickup place not answering.
  { personId: "aino", caseType: "readiness.no_answer", decided: 6, laterChanged: 0, onTime: 6 },
  { personId: "emil", caseType: "readiness.no_answer", decided: 5, laterChanged: 0, onTime: 5 },
  { personId: "sofie", caseType: "readiness.no_answer", decided: 4, laterChanged: 0, onTime: 4 },
  { personId: "jonas", caseType: "readiness.no_answer", decided: 3, laterChanged: 0, onTime: 3 },
  // Storage fees.
  { personId: "mikko", caseType: "readiness.fee_requested", decided: 7, laterChanged: 0, onTime: 7 },
  { personId: "jonas", caseType: "readiness.fee_requested", decided: 4, laterChanged: 0, onTime: 4 },
  { personId: "aino", caseType: "readiness.fee_requested", decided: 4, laterChanged: 0, onTime: 4 },
]

/** The rows of the coverage table, in the order a shift lead reads them. */
export const CASE_TYPE_ROWS = [
  { type: "readiness.release_document_missing", label: "Release document missing, German pickup places", country: "DE", phrase: "release documents at German pickup places" },
  { type: "readiness.release_document_missing", label: "Release document missing, Finland", country: "FI", phrase: "release documents in Finland" },
  { type: "readiness.keys_or_access", label: "Keys or access unclear" },
  { type: "readiness.car_not_ready", label: "Car not ready, empty pickups" },
  { type: "readiness.facts_disagree", label: "Facts disagree" },
  { type: "readiness.no_answer", label: "Pickup place not answering" },
  { type: "readiness.fee_requested", label: "Storage fee asked" },
]

export const TODAY_STATS = {
  since: today("06:00"),
  ordersChecked: 286,
  checkedAt: today("11:56"),
  medianMinutesToDecide: 11,
}

export const MONEY = {
  line: "This week the Readiness desk held 3 drivers before a wasted trip.",
  detail: "A wasted cross-border pickup costs a driver fee, travel and a working day.",
  basis: "A wasted cross-border pickup costs a driver fee, travel and a working day.",
}
