// Our own tables for the control room. Kept apart from lib/schema.ts (the
// seeded dataset) on purpose: no foreign keys into seeded tables, so
// `npm run db:seed` can replace the dataset at any time and these rows stay.
// Every table is prefixed `cr_` so it can never collide with a dataset table.
//
// Rich objects are stored as jsonb in the shape of the contract types in
// ./types.ts. A few fields are copied out into columns so we can filter and
// count without opening the jsonb.

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { AgentRun, Call, Case, Decision, Lesson, OpsPerson, TrustRule } from "./types"

/** The made-up ops team. Fiction: no real people. */
export const crOpsPeople = pgTable("cr_ops_people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // "ops" | "shift_lead"
  onShift: boolean("on_shift").notNull(),
  data: jsonb("data").$type<OpsPerson>().notNull(),
})

/**
 * Every decision a person made, live or (for the made-up past) synthetic.
 * Track records are counted from this table, never stored as a number.
 */
export const crDecisions = pgTable("cr_decisions", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  personId: text("person_id").notNull(),
  optionId: text("option_id").notNull(),
  caseType: text("case_type").notNull(),
  placeId: text("place_id"),
  customerId: text("customer_id"),
  country: text("country"),
  /** The person chose the agent's suggestion. */
  tookSuggestion: boolean("took_suggestion").notNull(),
  /** The decision had to be undone or redone later. */
  laterChanged: boolean("later_changed").notNull().default(false),
  /** The delivery kept its promise after the decision. */
  onTime: boolean("on_time").notNull().default(true),
  synthetic: boolean("synthetic").notNull().default(false),
  at: timestamp("at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<Decision>().notNull(),
}, (table) => [
  index("cr_decisions_type_idx").on(table.caseType, table.placeId),
  index("cr_decisions_person_idx").on(table.personId, table.caseType),
])

/**
 * Cases that were saved: by the agent, or because a person decided a case the
 * engine derived from the dataset. Derived cases that nobody touched are not
 * stored; they are computed from the data on every read.
 */
export const crCases = pgTable("cr_cases", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  desk: text("desk").notNull(),
  caseType: text("case_type").notNull(),
  status: text("status").notNull(),
  routedTo: text("routed_to"),
  placeId: text("place_id"),
  source: text("source").notNull(), // "derived" | "agent"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<Case>().notNull(),
}, (table) => [index("cr_cases_order_idx").on(table.orderId), index("cr_cases_routed_idx").on(table.routedTo, table.status)])

export const crLessons = pgTable("cr_lessons", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  caseType: text("case_type").notNull(),
  placeId: text("place_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<Lesson>().notNull(),
})

export const crTrustRules = pgTable("cr_trust_rules", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  caseType: text("case_type").notNull(),
  placeId: text("place_id"),
  /** The option the agent would take under this rule (semantic option id). */
  optionId: text("option_id").notNull(),
  data: jsonb("data").$type<TrustRule>().notNull(),
})

export const crCalls = pgTable("cr_calls", {
  id: text("id").primaryKey(),
  caseId: text("case_id"),
  orderId: text("order_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<Call>().notNull(),
}, (table) => [index("cr_calls_case_idx").on(table.caseId), index("cr_calls_order_idx").on(table.orderId)])

export const crAgentRuns = pgTable("cr_agent_runs", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  caseId: text("case_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  stepCount: integer("step_count").notNull().default(0),
  data: jsonb("data").$type<AgentRun>().notNull(),
}, (table) => [index("cr_agent_runs_order_idx").on(table.orderId)])
