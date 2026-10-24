import "./bx-tokens.css"
import "./control-room.css"
import { cookies } from "next/headers"
import { dataSource, getSignedIn, getWork } from "@/lib/control-room/client"
import { deskTitle } from "@/lib/control-room/format"
import { currentPersonId } from "./_ui/session"
import { Shell } from "./_ui/shell"

// The platform: one fixed frame (side menu, header) around every section.
export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const personId = await currentPersonId()
  // Fixture-only: cr-rows=40 adds copies to Needs you (see tasks/layout.tsx); the count follows.
  const extraRows = dataSource() === "fixtures" ? Math.min(400, Number((await cookies()).get("cr-rows")?.value ?? 0) || 0) : 0
  const [signedIn, work] = await Promise.all([getSignedIn(personId), getWork(personId, { extraRows })])
  const me = signedIn.person
  return (
    <Shell
      person={{ id: me.id, name: me.name, desk: deskTitle(me.desks[0]) }}
      people={signedIn.people.filter((p) => p.onShift).map((p) => ({ id: p.id, name: p.name, desk: deskTitle(p.desks[0]) }))}
      needYou={work.needYou.length}
    >
      {children}
    </Shell>
  )
}
