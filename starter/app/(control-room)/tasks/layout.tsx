import "./tasks.css"
import { cookies } from "next/headers"
import { dataSource, getSignedIn, getWork } from "@/lib/control-room/client"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import { labWork } from "../_lab/server"
import { currentPersonId } from "../_ui/session"
import { type RowTime, WorkFrame } from "../_ui/work-frame"

// The list stays mounted while you move between cases, so it keeps its scroll and tab.
export default async function WorkLayout({ children }: { children: React.ReactNode }) {
  const personId = await currentPersonId()
  // Fixture-only: the cookie cr-rows=40 adds copies to check that a long list stays calm.
  const rowsCookie = dataSource() === "fixtures" ? Number((await cookies()).get("cr-rows")?.value ?? 0) : 0
  const [real, signedIn] = await Promise.all([getWork(personId, { extraRows: Math.min(400, rowsCookie || 0) }), getSignedIn(personId)])
  const lists = await labWork(personId, real) // night lab: ?many=, ?rule=1 (none: unchanged)
  const now = signedIn.asOf
  const times: RowTime = {}
  for (const r of lists.needYou) {
    if (r.decideBy) times[r.caseId] = { text: when(r.decideBy, now), now: minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES }
  }
  return (
    <WorkFrame lists={lists} times={times}>
      {children}
    </WorkFrame>
  )
}
