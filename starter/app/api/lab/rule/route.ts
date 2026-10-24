import { NextResponse } from "next/server"
import { listTrustRules, saveTrustRule } from "@/lib/control-room/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Night lab only (cr_lab): POST /api/lab/rule puts the demo's trust-rule proposal back to
 * "suggested", so Kaisa's proposal can be turned on again. shots.mjs calls it before rule shots.
 */
export async function POST() {
  if (!/\/cr_lab(\?|$)/.test(process.env.DATABASE_URL ?? "")) return NextResponse.json({ error: "lab database only" }, { status: 403 })
  const rules = await listTrustRules()
  const rule = rules.find((r) => r.id.startsWith("rule-kind-facts_disagree_open_gig"))
  if (!rule) return NextResponse.json({ error: "no proposal" }, { status: 404 })
  await saveTrustRule({ ...rule, status: "suggested", changedBy: undefined, changedAt: undefined })
  return NextResponse.json({ id: rule.id, status: "suggested" })
}
