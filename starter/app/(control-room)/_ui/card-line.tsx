// The card's time line (Henry, 25 Oct, h24 + h39): one horizontal line at the top of the card,
// read left to right: when the agent sent it to you, now, the deadline (red within the hour),
// then what the agent does after. Every time comes from the case: the agent's own "Brought a
// person one decision" step, the room clock and the case's decide-by. No hooks, so the server
// page builds the data and the client card draws it.

import { hel } from "@/lib/control-room/fixtures/clock"
import { NOW_WINDOW_MINUTES, clock, dayKey, minutesUntil, when } from "@/lib/control-room/format"
import type { AgentStep, Case } from "@/lib/control-room/types"
import { AgentMark } from "./agent-mark"

export type TimeLine = {
  agentAt?: string // "12:01": when the agent brought the case to a person
  from?: { name: string; avatar?: string; at: string } // a colleague sent it on: they are the first stop, at their time
  sentTo: string // "Sent it to you", "Sent it to Sofie"
  due?: { at: string; left?: string; red: boolean; past: boolean }
  then?: { short: string; full: string } // the agent's next step: a few words, and the whole clause for hover
}

/** "59 min", "1 h 20 min", "5 h". */
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

const NAMES_A_DAY = /\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?\b|\btoday\b|\btomorrow\b|\b\d{1,2}\s(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i

/**
 * A clock time the agent wrote without a day or a zone ("checks with the branch again at 10:00") is
 * dropped: the line cannot say which day or whose clock it is (the Ferrari's 10:00 is the 12:00
 * Hamburg follow-up in UTC), and after "Decide by 13:00" it read as a time after 13:00. A time with
 * its day named stays.
 */
export function withoutBareTimes(text: string): string {
  if (NAMES_A_DAY.test(text)) return text
  return text.replace(/\s(?:at|from|by|before|after|around)\s\d{1,2}[:.]\d{2}(?:\s(?:local time|UTC|CET|CEST|EET|EEST))?/gi, "")
}

/** One line under "Then" in Henry's Safari at 125 %: about this many characters. */
const SHORT = 24

/**
 * The next line, short enough for one line under "Then": its first clause without "After a yes,",
 * "The agent" (the line already says whose step it is) and a time with no day; then, while too long,
 * cut before a trailing phrase (" to the customer", " again"). Always the case's own words, from the
 * start. "The agent checks with the branch again at 10:00 and keeps the gig unpublished until ..."
 * -> "Checks with the branch".
 */
export function thenWords(next?: string): { short: string; full: string } | undefined {
  if (!next) return undefined
  let s = withoutBareTimes(next.trim().replace(/^After a yes,\s*/i, ""))
  const cut = s.search(/,?\s(and then|and|until|so that|so|because|;)\s/)
  if (cut > 0) s = s.slice(0, cut)
  s = s.replace(/^the agent\s+/i, "").replace(/[.;,]$/, "").trim()
  if (!s) return undefined
  const full = s.charAt(0).toUpperCase() + s.slice(1)
  let short = full
  if (short.length > SHORT) {
    const ends = [...short.matchAll(/\s(?:to|for|about|at|in|on|with|from|by|before|after|again|until)\b/g)]
      .map((m) => m.index ?? 0)
      .filter((i) => i <= SHORT && short.slice(0, i).trim().split(/\s+/).length >= 2)
    if (ends.length) short = short.slice(0, ends[ends.length - 1])
  }
  return { short, full }
}

/** The ISO time cut to its minute, so the minutes left agree with the clock times shown. */
const toMinute = (iso: string) => new Date(Math.floor(Date.parse(iso) / 60_000) * 60_000).toISOString()

/**
 * Now is the room clock, but never before the agent's own ping: the agent brought the Ferrari at
 * 12:01 while the room clock reads 12:00, so the line counts from 12:01 ("in 59 min"), and every
 * time on the card (the line, the steps, the deadline) reads in order.
 */
export function timeLineFor(
  c: Case,
  roomNow: string,
  next: string | undefined,
  sentTo: string,
  from?: { name: string; avatar?: string; at: string }, // the colleague who sent it on (track N's hand-off)
): TimeLine {
  const ping = pingStep(c.agentSteps)
  // A hand-off carries the wall clock; one after the room clock goes on the room's day at its own time
  // of day, as History files live decisions (lib/control-room/history.ts), so 12:39 today reads 12:39
  // on the room's Wed 21 Oct and not as days after the deadline.
  const fromAt = from && Date.parse(from.at) > Date.parse(roomNow) ? hel(dayKey(roomNow), clock(from.at)) : from?.at
  // Who brought it here last: the colleague who sent it on, else the agent.
  const pingAt = fromAt ?? ping?.at ?? c.createdAt
  const now = toMinute(Date.parse(pingAt) > Date.parse(roomNow) ? pingAt : roomNow)
  const left = c.decideBy ? minutesUntil(c.decideBy, now) : undefined
  const past = left != null && left <= 0
  return {
    agentAt: clock(pingAt),
    ...(from && fromAt ? { from: { name: from.name, avatar: from.avatar, at: clock(fromAt) } } : {}),
    sentTo,
    due: c.decideBy
      ? {
          at: when(c.decideBy, now, undefined, true),
          left: left != null && left > 0 && left < 24 * 60 ? `in ${leftWords(Math.round(left))}` : undefined,
          red: past || (c.status === "waiting_for_person" && left != null && left <= NOW_WINDOW_MINUTES),
          past,
        }
      : undefined,
    then: thenWords(next),
  }
}

/**
 * The line itself: agent, now, the deadline, then. Each stop a mark on the rail with its words under
 * it: one line, and at most one grey line under that (master, 10:00: compact for Safari at 125 %).
 */
export function CardTimeLine({ line }: { line: TimeLine }) {
  const { due } = line
  return (
    <ol className="cline" aria-label="Time line">
      {line.from ? (
        <Stop
          cls="cline-agent cline-person"
          mark={line.from.avatar ? <img className="cline-avatar" src={line.from.avatar} alt="" width={20} height={20} /> : <span className="cline-initial">{line.from.name.charAt(0)}</span>}
          sub={line.sentTo}
        >
          <span className="cline-strong">{line.from.name}</span> <time className="num">{line.from.at}</time>
        </Stop>
      ) : (
        <Stop cls="cline-agent" mark={<AgentMark size={20} />} sub={line.sentTo}>
          <span className="cline-strong">Agent</span> <time className="num">{line.agentAt}</time>
        </Stop>
      )}
      <Stop cls={`cline-now${due?.red ? " to-red" : ""}`}>Now</Stop>
      {due && (
        <Stop cls={`cline-due${due.red ? " red" : ""}`} sub={due.left}>
          {due.past ? "Was due at" : "Decide by"} <time className="num">{due.at}</time>
        </Stop>
      )}
      {line.then && (
        <Stop cls="cline-then" sub={line.then.short} title={line.then.full !== line.then.short ? line.then.full : undefined}>
          Then
        </Stop>
      )}
    </ol>
  )
}

function Stop({ cls, mark, sub, title, children }: { cls: string; mark?: React.ReactNode; sub?: string; title?: string; children: React.ReactNode }) {
  return (
    <li className={`cline-stop ${cls}`} title={title}>
      <span className="cline-rail" aria-hidden="true">
        {mark ?? <span className="cline-dot" />}
      </span>
      <span className="cline-main">{children}</span>
      {sub && <span className="cline-sub">{sub}</span>}
    </li>
  )
}
