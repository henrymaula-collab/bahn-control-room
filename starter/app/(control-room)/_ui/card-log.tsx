// A step log in decide:07's style (Henry, 25 Oct, h20): a tick for done, a dot for the step at work,
// a grey dot for what is still to come, the title in ink, one grey line under it, a hairline joining
// the marks. Used by the agent's legwork under the situation and by the card after a decision.

import type { AgentStep } from "@/lib/control-room/types"
import { clock } from "@/lib/control-room/format"
import { Icon } from "./icons"

export type LogRow = { state: "done" | "live" | "next"; text: string; sub?: string; at?: string; short?: boolean /* the grey line kept to one line, whole on hover */ }

export function CardLog({ rows, id }: { rows: LogRow[]; id?: string }) {
  return (
    <ol className="clog" id={id}>
      {rows.map((r, i) => (
        <li key={i} className={`clog-row is-${r.state}${r.short ? " short" : ""}`} title={r.short && r.sub ? r.sub : undefined}>
          <span className="clog-mark" aria-hidden="true">
            {r.state === "done" ? <Icon name="check" size={12} /> : null}
          </span>
          <span className="clog-words">
            <span className="clog-text">{r.text}</span>
            {r.sub && <span className="clog-sub">{r.sub}</span>}
          </span>
          {r.at && <time className="clog-at num">{r.at}</time>}
        </li>
      ))}
    </ol>
  )
}

/** Sentences, split at . ! ? before a capital, never after a day number ("26. Oktober") or inside an address. */
export function sentences(text: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== "." && c !== "!" && c !== "?") continue
    const next = text.slice(i + 1).match(/^\s+(\S)/)
    if (!next || !/[A-ZÄÖÜÅ"„(]/.test(next[1])) continue
    if (c === "." && /(^|\s)\d{1,2}$/.test(text.slice(Math.max(0, i - 4), i))) continue
    out.push(text.slice(start, i + 1).trim())
    start = i + 1
  }
  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/** A step as a log row: its first sentence as the title, the rest as the grey line. */
export function stepRow(s: AgentStep, withTime = true): LogRow {
  const [first = s.summary, ...rest] = sentences(s.summary)
  return { state: "done", text: first.replace(/\.$/, ""), sub: rest.join(" ") || undefined, at: withTime ? clock(s.at) : undefined }
}

export type Legwork = { lead: string; more: number; rows: LogRow[] }

const WEIGHT: Record<string, number> = { call: 0, message: 1, ask: 1, lookup: 2, read: 3 }

/**
 * What the agent did before it brought the case to a person: everything before its first "propose"
 * step, less the follow-up it only planned ("wait"). The line names the step that says most (a call,
 * then a message, then the rest) with its time: "Called Calverona Hamburg in German at 12:01".
 */
export function legworkOf(steps: AgentStep[]): Legwork | undefined {
  const stop = steps.findIndex((s) => s.kind === "propose")
  const work = (stop >= 0 ? steps.slice(0, stop) : steps).filter((s) => s.kind !== "wait" && s.kind !== "propose")
  if (work.length === 0) return undefined
  const weight = (s: AgentStep) => (/^called\b/i.test(s.summary) ? 0 : (WEIGHT[s.kind] ?? 9))
  const lead = [...work].sort((a, b) => weight(a) - weight(b))[0]
  const first = (sentences(lead.summary)[0] ?? lead.summary).replace(/\.$/, "")
  return { lead: `${first} at ${clock(lead.at)}`, more: work.length - 1, rows: work.map((s) => stepRow(s)) }
}
