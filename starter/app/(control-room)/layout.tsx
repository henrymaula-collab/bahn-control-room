import "./bx-tokens.css"
import "./control-room.css"
import "./chat.css"
import "./shell.css"
import { cookies } from "next/headers"
import { dataSource, getSignedIn, getWork } from "@/lib/control-room/client"
import { avatarOf, jobTitle } from "@/lib/control-room/people-look"
import { minutesUntil, NOW_WINDOW_MINUTES, when } from "@/lib/control-room/format"
import { currentPersonId } from "./_ui/session"
import { LabShell } from "./_lab/mounts"
import { LabProvider } from "./_lab/provider"
import { labWork } from "./_lab/server"

// The platform: one fixed frame (side menu, header) around every section.
export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const personId = await currentPersonId()
  // Fixture-only: cr-rows=40 adds copies to Needs you (see tasks/layout.tsx); the count follows.
  const extraRows = dataSource() === "fixtures" ? Math.min(400, Number((await cookies()).get("cr-rows")?.value ?? 0) || 0) : 0
  const [signedIn, real] = await Promise.all([getSignedIn(personId), getWork(personId, { extraRows })])
  // Night lab: ?many= pads Needs you, ?rule=1 adds a shift lead's trust-rule proposal (none: unchanged).
  const work = await labWork(personId, real)
  const me = signedIn.person
  const times: Record<string, { text: string; now: boolean }> = {}
  for (const r of work.needYou) {
    if (r.decideBy) times[r.caseId] = { text: when(r.decideBy, signedIn.asOf), now: minutesUntil(r.decideBy, signedIn.asOf) <= NOW_WINDOW_MINUTES }
  }
  return (
    <>
      {/* Safari's page zoom: WebKit resolves vw/vh in font-size against the unzoomed window but
          in every other property against the zoomed viewport, so type sized from vw came out 1.25
          to 1.5 times too large for its boxes. The real viewport in CSS px, read before the first
          paint and on every resize (zooming fires one), drives --cr-u instead (shell.css). */}
      <script dangerouslySetInnerHTML={{ __html: VIEWPORT_SCRIPT }} />
      <LabProvider needs={{ rows: work.needYou, times }}>
      <LabShell
        person={{ id: me.id, name: me.name, desk: jobTitle(me), avatar: avatarOf(me) }}
        people={signedIn.people.filter((p) => p.onShift).map((p) => ({ id: p.id, name: p.name, desk: jobTitle(p), avatar: avatarOf(p) }))}
        needYou={work.needYou.length}
      >
        {children}
      </LabShell>
      </LabProvider>
    </>
  )
}

const VIEWPORT_SCRIPT = `(function(){if(window.__crvp)return;window.__crvp=1;var s=document.createElement("style");s.id="cr-viewport";document.head.appendChild(s);function f(){s.textContent=":root{--cr-vw:"+innerWidth+"px;--cr-vh:"+innerHeight+"px}"}f();addEventListener("resize",f)})()`
