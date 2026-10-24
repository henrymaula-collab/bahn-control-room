import { NextResponse } from "next/server"
import { chatEventStream, SSE_HEADERS } from "@/lib/control-room/chat-sse"
import { fixtureReply, fixtureThread } from "@/lib/control-room/fixtures/chat"
import { body, fail } from "../../../_util"

// The case chat on fixtures (branch v4-chatui). The chat API branch (v4-chat) owns this
// path and serves the engine; at merge its route wins, and in CR_DATA=fixtures mode it
// can hand over to fixtureThread / fixtureReply from lib/control-room/fixtures/chat.ts.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** GET /api/cr/cases/:id/chat?person=<id> -> ChatThread */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const person = new URL(request.url).searchParams.get("person")
  if (!person) return fail("Say who is asking: ?person=<id>")
  const thread = fixtureThread(decodeURIComponent(id), person)
  if (!thread) return fail("No conversation for this case", 404)
  return NextResponse.json(thread)
}

/** POST /api/cr/cases/:id/chat { person, text, via } -> text/event-stream of ChatEvent */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const b = await body<{ person: string; text: string; via: "text" | "voice" }>(request)
  const text = typeof b.text === "string" ? b.text.trim() : ""
  if (!b.person || !text) return fail("Send { person, text, via }")
  if (text.length > 2000) return fail("Keep it under 2000 characters")
  const caseId = decodeURIComponent(id)
  if (!fixtureThread(caseId, b.person)) return fail("No conversation for this case", 404)
  const via = b.via === "voice" ? "voice" : "text"
  return new Response(chatEventStream(fixtureReply(caseId, b.person, text, via)), { headers: SSE_HEADERS })
}
