// The card's time line (Henry, 25 Oct, h24 + h39): one horizontal line at the top of the card,
// read left to right: when the agent sent it to you, now, the deadline (red within the hour),
// then what the agent does after. Every time comes from the case: the agent's own "Brought a
// person one decision" step, the room clock and the case's decide-by. No hooks, so the server
// page builds the data and the client card draws it.

import { clock, minutesUntil, needsPersonNow, when } from "@/lib/control-room/format"
import type { AgentStep, Case } from "@/lib/control-room/types"
import { AgentMark } from "./agent-mark"

export type TimeLine = {
  agentAt?: string // "12:01": when the agent brought the case to a person
  sentTo: string // "Sent it to you", "Sent it to Sofie"
  due?: { at: string; left?: string; red: boolean; past: boolean }
  then?: string // the agent's next step, short
}

/** "60 min", "1 h 20 min", "5 h". */
function leftWords(min: number) {
  if (min <= 90) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** The step where the agent stopped and brought the case to a person (its first "propose"). */
export function pingStep(steps: AgentStep[]): AgentStep | undefined {
  const proposals = steps.filter((s) => s.kind === "propose")
  return proposals.find((s) => /^Brought a person/.test(s.summary)) ?? proposals[0]
}

/**
 * The next line, short enough for the line's last stop: its first clause, without "After a yes,"
 * and "The agent" (the line already says whose step it is). "The agent checks with the branch
 * again at 10:00 and keeps the gig unpublished until ..." -> "Checks with the branch again at 10:00".
 */
export function thenWords(next?: string): string | undefined {
  if (!next) return undefined
  let s = next.trim().replace(/^After a yes,\s*/i, "")
  const cut = s.search(/,?\s(and then|and|until|so that|so|because)\s/)
  if (cut > 0) s = s.slice(0, cut)
  s = s.replace(/^the agent\s+/i, "").replace(/[.;,]$/, "")
  // Still long for the line's last stop (Safari at 125 % gives it about 20 characters a line):
  // end before the last trailing phrase that keeps it within SHORT. "Asks the pickup place to name the
  // key holder at the collection bay desk" -> "Asks the pickup place to name the key holder".
  if (s.length > SHORT) {
    const ends = [...s.matchAll(/\s(?:at|about|in|on|for|from|with|by|before|after)\s/g)].map((m) => m.index ?? 0).filter((i) => i >= 20 && i <= SHORT)
    if (ends.length) s = s.slice(0, ends[ends.length - 1])
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined
}
const SHORT = 46

export function timeLineFor(c: Case, now: string, next: string | undefined, sentTo: string): TimeLine {
  const ping = pingStep(c.agentSteps)
  const left = c.decideBy ? minutesUntil(c.decideBy, now) : undefined
  const past = left != null && left <= 0
  return {
    agentAt: clock(ping?.at ?? c.createdAt),
    sentTo,
    due: c.decideBy
      ? {
          at: when(c.decideBy, now, undefined, true),
          left: left != null && left > 0 && left < 24 * 60 ? `in ${leftWords(Math.round(left))}` : undefined,
          red: past || needsPersonNow(c, now),
          past,
        }
      : undefined,
    then: thenWords(next),
  }
}

/** The line itself: agent, now, the deadline, then. Each stop a dot on the rail with its words under it. */
export function CardTimeLine({ line }: { line: TimeLine }) {
  const { due } = line
  return (
    <ol className="cline" aria-label="Time line">
      <li className="cline-stop cline-agent">
        <span className="cline-rail" aria-hidden="true">
          <AgentMark size={20} />
        </span>
        <span className="cline-what">
          <span className="cline-main">
            Agent <time className="num">{line.agentAt}</time>
          </span>
          <span className="cline-sub">{line.sentTo}</span>
        </span>
      </li>
      <li className={`cline-stop cline-now${due?.red ? " to-red" : ""}`}>
        <span className="cline-rail" aria-hidden="true">
          <span className="cline-dot" />
        </span>
        <span className="cline-what">
          <span className="cline-main">Now</span>
        </span>
      </li>
      {due && (
        <li className={`cline-stop cline-due${due.red ? " red" : ""}`}>
          <span className="cline-rail" aria-hidden="true">
            <span className="cline-dot" />
          </span>
          <span className="cline-what">
            <span className="cline-main">
              {due.past ? "Was due at" : "Decide by"} <time className="num">{due.at}</time>
            </span>
            {due.left && <span className="cline-sub">{due.left}</span>}
          </span>
        </li>
      )}
      {line.then && (
        <li className="cline-stop cline-then">
          <span className="cline-rail" aria-hidden="true">
            <span className="cline-dot" />
          </span>
          <span className="cline-what">
            <span className="cline-main">Then</span>
            <span className="cline-sub">{line.then}</span>
          </span>
        </li>
      )}
    </ol>
  )
}
