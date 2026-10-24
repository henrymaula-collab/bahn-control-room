import "./overview.css"
import type { Metadata } from "next"
import { getCase, getLead } from "@/lib/control-room/client"
import { getOverview } from "@/lib/control-room/client-v3"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import { questionFor } from "./_ui/ask"
import type { RedInfo } from "./_ui/car-map"
import type { MapLook } from "./_ui/map-style"
import { figtree } from "./_ui/overview-fonts"
import { OverviewLooks, type Look, type Quote } from "./_ui/overview-looks"
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
  // ?look=a|b|c picks the website layout (DEFAULT_LOOK otherwise); ?look=v3 is the calm v3 panel.
  const asked = typeof sp.look === "string" ? sp.look : ""
  const page: Look | "v3" = asked === "v3" ? "v3" : LOOKS.includes(asked as Look) ? (asked as Look) : DEFAULT_LOOK

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
  if (page === "v3") return <OverviewView data={data} red={red} look={look} />
  const quote = page === "a" ? await latestLesson(personId) : undefined
  return (
    <div className={`${figtree.variable} ovx-root`}>
      <OverviewLooks look={page} data={data} red={red} mapLook={look} quote={quote} handledAlone={data.counts.handledByAgentToday} />
    </div>
  )
}

const LOOKS: Look[] = ["a", "b", "c"]
const DEFAULT_LOOK: Look = "b"

/** The newest know-how the agents use, with the person it came from (look a's quote card). */
async function latestLesson(personId: string): Promise<Quote | undefined> {
  try {
    const lead = await getLead(personId)
    const l = lead.lessons
      .filter((x) => x.status === "accepted" && x.source?.personName)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return l ? { text: l.text, who: l.source!.personName, where: l.source!.placeName } : undefined
  } catch {
    return undefined // the page stands without it
  }
}
