import "./bx-tokens.css"
import "./control-room.css"
import { getDesk } from "@/lib/control-room/client"
import { getWork } from "@/lib/control-room/client-v3"
import { deskTitle } from "@/lib/control-room/format"
import { currentPersonId } from "./_ui/session"
import { Shell } from "./_ui/shell"

// The platform: one fixed frame (side menu, header) around every section.
export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const personId = await currentPersonId()
  const [desk, work] = await Promise.all([getDesk(personId), getWork(personId)])
  const me = desk.person
  return (
    <Shell
      person={{ id: me.id, name: me.name, desk: deskTitle(me.desks[0]) }}
      people={desk.people.filter((p) => p.onShift).map((p) => ({ id: p.id, name: p.name, desk: deskTitle(p.desks[0]) }))}
      needYou={work.needYou.length}
    >
      {children}
    </Shell>
  )
}
