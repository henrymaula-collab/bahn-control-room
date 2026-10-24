// The chat's own table. Kept apart from lib/control-room/schema.ts so the
// learning-loop track can add its case records there without a clash. One row
// per message; a thread is (case, person): each person talks to the agent on
// their own, and the opener is computed fresh, never stored.

import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { ChatMessage } from "@/lib/control-room/types-chat"

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
