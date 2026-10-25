import { NextRequest, NextResponse } from "next/server"
import { buildState, getCaseDetail, kindsOf } from "@/lib/control-room/service"
import { historyRows } from "@/lib/control-room/history"
import { kindOf } from "@/lib/control-room/kinds"
import { fail } from "../../_util"
import type { RuleView } from "./view"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UNDER_RULE = "Decided under a trust rule"

/**
 * GET /api/cr/lead/rule[?kind=<kindKey>] -> RuleView
 * The agent's proposal to handle one kind of case alone (default: the demo's kind), the case of
 * that kind waiting now and what happens to it, and the answers the proposal rests on.
 * Turning it on or off is POST /api/cr/trust-rules/:id.
 */
export async function GET(request: NextRequest) {
  const want = request.nextUrl.searchParams.get("kind") ?? "facts_disagree_open_gig"
  const state = await buildState()
  const rule = state.rules.find((r) => r.kindKey === want) ?? state.rules.find((r) => r.status !== "off") ?? state.rules[0]
  if (!rule) return fail("No proposal", 404)
  const key = rule.kindKey ?? want
  const kind = kindsOf(state).find((k) => k.kindKey === key || k.ruleId === rule.id)

  // The case of this kind waiting for a person now, or the one the agent just decided under the rule.
  const mine = state.cases.filter(
    (c) =>
      kindOf(c) === key &&
      (c.status === "waiting_for_person" ||
        (c.status === "handled_by_agent" && (c.handledUnderRuleId === rule.id || c.agentSteps.some((s) => s.summary.startsWith(UNDER_RULE))))),
  )
  const details = await Promise.all(mine.map((c) => getCaseDetail(c.id, state)))
  const waiting = details.flatMap((d) =>
    d
      ? [{
          caseId: d.case.id,
          reference: d.situation?.reference ?? d.order?.reference ?? "",
          vehicle: d.situation?.vehicle ?? "",
          place: d.situation?.pickup.place ?? d.order?.pickup.name ?? "",
          person: d.routedTo?.person?.name ?? "",
          handled: d.case.status === "handled_by_agent",
        }]
      : [],
  )

  const answers = historyRows(state).filter((row) => row.kindKey === key && row.by.id !== "agent")
  const same = (decision: string) => decision.toLowerCase() === rule.then.toLowerCase()
  const people = new Map<string, { id: string; name: string; n: number }>()
  for (const a of answers) {
    const p = people.get(a.by.id) ?? { id: a.by.id, name: a.by.name, n: 0 }
    p.n++
    people.set(a.by.id, p)
  }
  const words = new Map<string, number>()
  for (const a of answers) if (same(a.decision) && a.reason) words.set(a.reason, (words.get(a.reason) ?? 0) + 1)
  const said = [...words.entries()].sort((a, b) => b[1] - a[1])[0]
  const times = answers.map((a) => a.at).sort()
  const by = rule.changedBy ? state.people.find((p) => p.id === rule.changedBy || p.id === `p-${rule.changedBy}`) : undefined

  const view: RuleView = {
    rule: {
      id: rule.id,
      status: rule.status,
      when: rule.when,
      then: rule.then,
      ...(rule.changedBy ? { changedBy: { id: rule.changedBy, name: by?.name ?? rule.changedBy } } : {}),
      ...(rule.changedAt ? { changedAt: rule.changedAt } : {}),
    },
    kind: {
      key,
      label: kind?.label ?? rule.when,
      line: kind?.line ?? `${rule.evidence.matched} of ${rule.evidence.total} agree`,
      agreeing: kind?.agreeing ?? rule.evidence.matched,
      decided: kind?.decided ?? rule.evidence.total,
      people: kind?.peopleNames ?? [],
      medianMinutes: kind?.medianMinutes ?? null,
    },
    waiting,
    evidence: {
      people: [...people.values()].sort((a, b) => b.n - a.n),
      differ: answers.filter((a) => !same(a.decision)).map((a) => ({ name: a.by.name, decision: a.decision, ...(a.reason ? { reason: a.reason } : {}), at: a.at })),
      ...(said ? { said: { text: said[0], n: said[1] } } : {}),
      ...(times.length ? { first: times[0], last: times[times.length - 1] } : {}),
    },
  }
  return NextResponse.json(view)
}
