import { NextResponse } from "next/server"
import { clearThread, getThread, prepareTurn, type PostBody } from "@/lib/chat/service"
import type { ChatEvent } from "@/lib/control-room/types-chat"
import { body, fail } from "../../../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/cr/cases/:id/chat?person=<id> -> ChatThread (types-chat.ts). :id may also be an order reference (CD-420458). */
export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params
  const r = await getThread(decodeURIComponent(id), new URL(request.url).searchParams.get("person"))
  if (!r.ok) return fail(r.error, r.status)
  return NextResponse.json(r.thread, { headers: { "x-cr-opener": r.variant } })
}

/**
 * POST /api/cr/cases/:id/chat { person, text, via } -> text/event-stream.
 * Each frame is `data: <ChatEvent JSON>\n\n`: thinking, tool (running, then done/failed), delta..., then done or error.
 */
export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params
  const input = await body<PostBody>(request)
  const prep = await prepareTurn(decodeURIComponent(id), input)
  if (!prep.ok) return fail(prep.error, prep.status)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        } catch {
          // the client went away
        }
      }
      await prep.turn(send, request.signal)
      try {
        controller.close()
      } catch {
        // already closed
      }
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-cr-chat-provider": prep.provider,
    },
  })
}

/** DELETE /api/cr/cases/:id/chat[?person=<id>] -> { removed }: start the thread over (one person, or everyone on the case). */
export async function DELETE(request: Request, context: Ctx) {
  const { id } = await context.params
  const r = await clearThread(decodeURIComponent(id), new URL(request.url).searchParams.get("person"))
  if (!r.ok) return fail(r.error, r.status)
  return NextResponse.json({ removed: r.removed })
}
