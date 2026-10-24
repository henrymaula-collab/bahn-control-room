// The chat's own table. Kept apart from lib/control-room/schema.ts so the
// learning-loop track can add its case records there without a clash. One row
// per message; a thread is (case, person): each person talks to the agent on
// their own, and the opener is computed fresh, never stored.

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { ChatMessage } from "@/lib/control-room/types-chat"
import type { CaseDepth } from "@/lib/depth/types"

export const crChatMessages = pgTable("cr_chat_messages", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  /** Whose conversation this is: the person talking to the agent (agent messages carry it too). */
  threadPersonId: text("thread_person_id").notNull(),
  role: text("role").notNull(), // "person" | "agent"
  via: text("via").notNull(), // "text" | "voice"
  at: timestamp("at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<ChatMessage>().notNull(),
}, (table) => [index("cr_chat_messages_thread_idx").on(table.caseId, table.threadPersonId, table.at)])

/**
 * Baseline depth per order (lib/depth): a short message thread, a call, a note,
 * documents, the pickup place's people, hours and earlier pickups. Made up and
 * deterministic; written by `npm run db:seed:cr`, read by the chat tools. The
 * chat regenerates a row on read when it is missing or stale, so the table is
 * the inspectable copy, never a requirement. lib/demo may write its own rows here.
 */
export const crCaseDepth = pgTable("cr_case_depth", {
  orderId: text("order_id").primaryKey(),
  reference: text("reference").notNull(),
  caseId: text("case_id"),
  caseType: text("case_type"),
  version: integer("version").notNull(),
  synthetic: boolean("synthetic").notNull().default(true),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<CaseDepth>().notNull(),
})
