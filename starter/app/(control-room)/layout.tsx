import "./bx-tokens.css"
import "./control-room.css"
import "./chat.css"
import "./shell.css"
import { cookies } from "next/headers"
import { dataSource, getSignedIn, getWork } from "@/lib/control-room/client"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import { avatarOf, jobTitle } from "@/lib/control-room/people-look"
import { currentPersonId } from "./_ui/session"
import { type NavTask, Shell } from "./_ui/shell"

// The platform: one fixed frame (side menu, header) around every section.
export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const personId = await currentPersonId()
  // Fixture-only: cr-rows=40 adds copies to Needs you (see tasks/layout.tsx); the count follows.
  const extraRows = dataSource() === "fixtures" ? Math.min(400, Number((await cookies()).get("cr-rows")?.value ?? 0) || 0) : 0
  const [signedIn, work] = await Promise.all([getSignedIn(personId), getWork(personId, { extraRows })])
  const me = signedIn.person
  // The same rows the count comes from, nested under Your tasks in the side menu; the time in
  // red within the hour, as in the task list (tasks/layout.tsx).
  const now = signedIn.asOf
  const tasks: NavTask[] = work.needYou.map((r) => ({
    caseId: r.caseId,
    vehicle: r.vehicle,
    place: r.place,
    time: r.decideBy ? { text: when(r.decideBy, now), now: minutesUntil(r.decideBy, now) <= NOW_WINDOW_MINUTES } : undefined,
  }))
  return (
    <>
      {/* Safari's page zoom: WebKit resolves vw/vh in font-size against the unzoomed window but
          in every other property against the zoomed viewport, so type sized from vw came out 1.25
          to 1.5 times too large for its boxes. The real viewport in CSS px, read before the first
          paint and on every resize (zooming fires one), drives --cr-u instead (shell.css). */}
      <script dangerouslySetInnerHTML={{ __html: VIEWPORT_SCRIPT }} />
      <Shell
        person={{ id: me.id, name: me.name, desk: jobTitle(me), avatar: avatarOf(me) }}
        people={signedIn.people.filter((p) => p.onShift).map((p) => ({ id: p.id, name: p.name, desk: jobTitle(p), avatar: avatarOf(p) }))}
        needYou={work.needYou.length}
        tasks={tasks}
      >
        {children}
      </Shell>
    </>
  )
}

const VIEWPORT_SCRIPT = `(function(){if(window.__crvp)return;window.__crvp=1;var s=document.createElement("style");s.id="cr-viewport";document.head.appendChild(s);function f(){s.textContent=":root{--cr-vw:"+innerWidth+"px;--cr-vh:"+innerHeight+"px}"}f();addEventListener("resize",f)})()`
