import { NextResponse } from "next/server"
import { listTraces } from "@/lib/agent/trace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/agent/runs?order=CD-420516 -> recorded agent runs, newest first. */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order")?.toUpperCase()
  const runs = listTraces()
    .filter((t) => !order || t.orderRef.toUpperCase() === order || t.orderId.toUpperCase() === order)
    .map(({ file: _file, ...t }) => t)
  return NextResponse.json({ runs })
}
