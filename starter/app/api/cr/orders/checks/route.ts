import { NextResponse } from "next/server"
import { getOrderChecks } from "@/lib/control-room/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/cr/orders/checks -> { checks: OrderCheck[], counts, checkedAt, orders: { [orderId]: { reference, customer, from, to, synthetic? } } } */
export async function GET() {
  return NextResponse.json(await getOrderChecks())
}
