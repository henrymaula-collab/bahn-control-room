import "../rule.css"
import type { Metadata } from "next"
import { headers } from "next/headers"
import type { RuleView } from "@/app/api/cr/lead/rule/view"
import { dataSource, getSignedIn } from "@/lib/control-room/client"
import { RuleCard } from "../_ui/rule-card"
import { currentPersonId } from "../_ui/session"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Know-how" }
export const dynamic = "force-dynamic"

/** GET /api/cr/lead/rule on this app's own host, as lib/control-room/client.ts reads the API. */
async function ruleView(): Promise<RuleView | null> {
  if (dataSource() !== "api") return null
  const h = await headers()
  const base = process.env.CR_API_BASE ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? `127.0.0.1:${process.env.PORT ?? 3000}`}`
  try {
    const res = await fetch(`${base}/api/cr/lead/rule`, { cache: "no-store" })
    return res.ok ? ((await res.json()) as RuleView) : null
  } catch {
    return null
  }
}

/**
 * Know-how: what the agent has learned from people's answers. A shift lead meets the agent's
 * proposal here (rule:04): one click from anywhere in the menu, "Turn it on" the second.
 */
export default async function KnowHowPage() {
  const { person } = await getSignedIn(await currentPersonId())
  const view = person.role === "shift_lead" ? await ruleView() : null
  if (!view) return <TitlePage title="Know-how" icon="book-open" />
  return (
    <div className="rule-page">
      <div className="detail">
        <RuleCard view={view} personName={person.name} />
      </div>
    </div>
  )
}
