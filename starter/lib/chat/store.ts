// Where chat messages live: the cr_chat_messages table, or memory in fixture
// mode (CR_DATA=fixtures, no database), like the fixture store.

import type { ChatMessage } from "@/lib/control-room/types-chat"
import { fixtureMode } from "./context"

export interface ChatStore {
  list(caseId: string, personId: string): Promise<ChatMessage[]>
  add(message: ChatMessage, threadPersonId: string): Promise<void>
  /** Remove a thread (one person) or every thread on a case. Returns how many messages went. */
  clear(caseId: string, personId?: string): Promise<number>
}

const g = globalThis as unknown as { __crChatMemory?: Map<string, ChatMessage[]> }
const key = (caseId: string, personId: string) => `${caseId}::${personId}`

export const memoryStore: ChatStore = {
  async list(caseId, personId) {
    return [...(g.__crChatMemory?.get(key(caseId, personId)) ?? [])]
  },
  async add(message, personId) {
    g.__crChatMemory ??= new Map()
    const k = key(message.caseId, personId)
    g.__crChatMemory.set(k, [...(g.__crChatMemory.get(k) ?? []), message])
  },
  async clear(caseId, personId) {
    const m = g.__crChatMemory
    if (!m) return 0
    let n = 0
    for (const k of [...m.keys()]) {
      if (k === key(caseId, personId ?? "") || (!personId && k.startsWith(`${caseId}::`))) {
        n += m.get(k)?.length ?? 0
        m.delete(k)
      }
    }
    return n
  },
}

export const dbStore: ChatStore = {
  async list(caseId, personId) {
    const [{ crDb }, { crChatMessages }, { and, asc, eq }] = await Promise.all([import("@/lib/control-room/db"), import("./schema"), import("drizzle-orm")])
    const rows = await crDb.select().from(crChatMessages)
      .where(and(eq(crChatMessages.caseId, caseId), eq(crChatMessages.threadPersonId, personId)))
      .orderBy(asc(crChatMessages.at), asc(crChatMessages.id))
    return rows.map((r) => r.data)
  },
  async add(message, personId) {
    const [{ crDb }, { crChatMessages }] = await Promise.all([import("@/lib/control-room/db"), import("./schema")])
    await crDb.insert(crChatMessages).values({
      id: message.id, caseId: message.caseId, threadPersonId: personId, role: message.role, via: message.via, at: new Date(message.at), data: message,
    }).onConflictDoNothing()
  },
  async clear(caseId, personId) {
    const [{ crDb }, { crChatMessages }, { and, eq }] = await Promise.all([import("@/lib/control-room/db"), import("./schema"), import("drizzle-orm")])
    const where = personId ? and(eq(crChatMessages.caseId, caseId), eq(crChatMessages.threadPersonId, personId)) : eq(crChatMessages.caseId, caseId)
    const gone = await crDb.delete(crChatMessages).where(where).returning({ id: crChatMessages.id })
    return gone.length
  },
}

let override: ChatStore | undefined

/** Tests point the chat at the memory store. */
export function setChatStore(store: ChatStore | undefined): void {
  override = store
}

export function chatStore(): ChatStore {
  return override ?? (fixtureMode() ? memoryStore : dbStore)
}

export function messageId(prefix: "msg-p" | "msg-a"): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
