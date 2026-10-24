// The case chat's wire format: ChatEvent (types-chat.ts) as server-sent events.
// One block per event: "event: <type>" and "data: <the event as JSON>". The reader
// also takes blocks with only a data line, so it plugs into any route that sends
// `data: {"type":...}` blocks. No Node imports: used by the route and the browser.

import type { ChatEvent } from "./types-chat"

const TYPES = new Set<ChatEvent["type"]>(["thinking", "tool", "action", "delta", "done", "error"])

/** One ChatEvent as one server-sent event block. */
export function encodeChatEvent(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/** A stream of ChatEvents as a text/event-stream body. A failure ends with one error event. */
export function chatEventStream(events: AsyncIterable<ChatEvent>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const it = events[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await it.next()
        if (next.done) return controller.close()
        controller.enqueue(enc.encode(encodeChatEvent(next.value)))
      } catch {
        controller.enqueue(enc.encode(encodeChatEvent({ type: "error", message: "The agent stopped answering." })))
        controller.close()
      }
    },
    async cancel() {
      await it.return?.()
    },
  })
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const

/** Reads ChatEvents from a text/event-stream body as they arrive. */
export async function* readChatEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  try {
    for (;;) {
      const { value, done } = await reader.read()
      buf += done ? dec.decode() : dec.decode(value, { stream: true })
      for (let m = /\r?\n\r?\n/.exec(buf); m; m = /\r?\n\r?\n/.exec(buf)) {
        const event = parseBlock(buf.slice(0, m.index))
        buf = buf.slice(m.index + m[0].length)
        if (event) yield event
      }
      if (done) {
        const event = parseBlock(buf)
        if (event) yield event
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseBlock(block: string): ChatEvent | null {
  let name: string | undefined
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue
    const at = line.indexOf(":")
    const field = at < 0 ? line : line.slice(0, at)
    const value = at < 0 ? "" : line.slice(at + 1).replace(/^ /, "")
    if (field === "event") name = value
    else if (field === "data") data.push(value)
  }
  if (!data.length) return null
  const raw = data.join("\n")
  try {
    const obj = JSON.parse(raw) as Partial<ChatEvent> & Record<string, unknown>
    if (obj && typeof obj === "object") {
      const type = (obj.type ?? name) as ChatEvent["type"] | undefined
      if (type && TYPES.has(type)) return { ...obj, type } as ChatEvent
    }
  } catch {
    if (name === "delta") return { type: "delta", text: raw }
  }
  return null
}
