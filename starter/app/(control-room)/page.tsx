import type { Metadata } from "next"
import { getCase, getOverview } from "@/lib/control-room/client"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import { questionFor } from "./_ui/ask"
import type { RedInfo } from "./_ui/car-map"
import type { MapLook } from "./_ui/map-style"
import { OverviewView } from "./_ui/overview-view"
import { currentPersonId } from "./_ui/session"

export const metadata: Metadata = { title: "Overview" }

type Search = Promise<{ [k: string]: string | string[] | undefined }>

/** Overview: every car on the road today, and what needs a person. */
export default async function OverviewPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams
  const personId = await currentPersonId()
  const data = await getOverview(personId)
  // ?map=positron or ?map=liberty shows the raw OpenFreeMap styles, for comparing.
  const look: MapLook = sp.map === "positron" || sp.map === "liberty" ? sp.map : "bahn"

  // Each red pin's card: with a case, its one question (one read per case); without one, the order.
  const red: Record<string, RedInfo> = {}
  await Promise.all(
    data.cars
      .filter((c) => c.state === "needs_person")
      .map(async (c) => {
        const base = {
          orderId: c.orderId,
          vehicle: c.vehicle,
          place: c.caseId || c.from === c.to ? c.from : `${c.from} to ${c.to}`,
          // Without a case there is no decide-by time; a bare clock would be read as one.
          time: undefined as string | undefined,
          reason: c.reason,
          now: false,
          mine: false,
        }
        red[c.orderId] = base
        if (!c.caseId) return
        const detail = await getCase(c.caseId, personId)
        if (!detail) return
        const k = detail.card.case
        const due = k.decideBy ?? c.nextAt
        red[c.orderId] = {
          ...base,
          caseId: c.caseId,
          place: detail.card.order.pickup.placeName,
          time: due ? when(due, data.now) : undefined,
          now: !!due && minutesUntil(due, data.now) <= NOW_WINDOW_MINUTES,
          question: questionFor(k.suggestion),
          mine: k.routedTo?.personId === detail.person.id,
          owner: detail.people.find((p) => p.id === k.routedTo?.personId)?.name,
        }
      }),
  )
  return <OverviewView data={data} red={red} look={look} />
}
