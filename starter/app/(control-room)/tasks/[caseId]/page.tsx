import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getWork, getWorkCase } from "@/lib/control-room/client"
import { clock } from "@/lib/control-room/format"
import type { Case } from "@/lib/control-room/types"
import { timeLineFor } from "../../_ui/card-line"
import { legworkOf } from "../../_ui/card-log"
import { dueFor } from "../../_ui/lines"
import { Question } from "../../_ui/question"
import { currentPersonId } from "../../_ui/session"
import { Keep } from "../../_ui/text"
import { nextCase } from "@/lib/handoff/order"
import { CaseRows } from "../../_ui/work-case"
import { lookQuery } from "../look"

type Params = Promise<{ caseId: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { caseId } = await params
  const w = await getWorkCase(caseId, await currentPersonId())
  return { title: w ? `${w.detail.card.order.vehicle}, Your tasks` : "Your tasks" }
}

/** One case in Your tasks: flow 1's decision card, then two rows, The situation and Why it came to you. */
export default async function WorkCasePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { caseId } = await params
  const look = lookQuery((await searchParams).tasks)
  const personId = await currentPersonId()
  const [w, lists] = await Promise.all([getWorkCase(decodeURIComponent(caseId), personId), getWork(personId)])
  if (!w) notFound()

  const { detail, extras } = w
  const c = detail.card.case
  const now = detail.asOf
  const lead = detail.people.find((p) => p.role === "shift_lead")
  const owner = detail.people.find((p) => p.id === c.routedTo?.personId)
  const mine = !owner || owner.id === detail.person.id
  const asks = c.status === "waiting_for_person" || !!detail.decision
  // Next case: the same order the dock walks (track N, lib/handoff/order.ts).
  // Sent on by a colleague (track N's hand-off, kept on the case): they, not the agent, brought it here.
  const handoff = (c as Case & { handoffs?: { from: string; to: string; note?: string; at: string }[] }).handoffs?.at(-1)
  const passed = handoff && handoff.to === c.routedTo?.personId ? handoff : undefined
  const sender = passed ? detail.people.find((p) => p.id === passed.from) : undefined
  const nextId = nextCase(lists.needYou, { caseId: c.id, decideBy: c.decideBy })?.caseId

  return (
    <div className="detail-inner">
      {asks ? (
        <Question
          key={c.id}
          variant="case"
          caseId={c.id}
          due={dueFor(c, now)}
          headline={c.headline}
          suggestion={c.suggestion}
          alternatives={c.alternatives}
          drafts={detail.drafts}
          whyChoices={detail.whyChoices}
          leadName={lead?.name ?? "The shift lead"}
          personName={detail.person.name}
          nextHref={nextId ? `/tasks/${nextId}${look}` : undefined}
          next={extras?.next}
          line={timeLineFor(
            c,
            now,
            extras?.next,
            mine ? "Sent it to you" : `Sent it to ${owner?.name}`,
            passed && sender ? { name: sender.name, avatar: sender.avatar, at: passed.at } : undefined,
          )}
          legwork={legworkOf(c.agentSteps)}
          place={extras?.situation?.pickup.place}
          subject={`${detail.card.order.vehicle}, ${detail.card.order.reference}`}
          existing={
            detail.decision
              ? {
                  optionId: detail.decision.optionId,
                  why: detail.decision.why,
                  timeWords: clock(detail.decision.at),
                  personName: detail.decidedBy?.name ?? "a person",
                }
              : undefined
          }
        />
      ) : (
        <section className="question">
          <p className="m state-line">
            <span className={`dot ${c.status === "agent_working" ? "dot-agent" : "dot-green"}`} />
            {c.status === "agent_working" ? "Agent working" : "Handled by the agent"}
          </p>
          <h1 className="l what">
            <Keep text={c.headline} />
          </h1>
          {agentLine(c) && <p className="l ask quiet">{agentLine(c)}</p>}
        </section>
      )}

      <CaseRows
        caseId={c.id}
        personId={detail.person.id}
        situation={extras?.situation}
        why={extras?.why ?? []}
        whyTitle={asks ? (mine ? "Why it came to you" : `Why it went to ${owner?.name}`) : undefined}
        canSend={c.status === "waiting_for_person" && mine && !detail.decision}
        note={passed?.note && sender ? { from: sender.name, text: passed.note } : undefined}
        routedWhy={mine && !passed ? c.routedTo?.why : undefined}
        now={now}
      />
    </div>
  )
}

const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\d:]+/gu) ?? []

/**
 * The grey line under the headline when nobody is asked: what the agent does or did, from the
 * suggestion's effect. Never a repeat of the headline (a sentence whose words are mostly in it)
 * and never a rule's internal id.
 */
function agentLine(c: Case): string | undefined {
  const head = new Set(wordsOf(c.headline))
  const kept = c.suggestion.effect
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/\brule-[\w-]+/.test(sentence))
    .filter((sentence) => {
      const w = wordsOf(sentence)
      return w.length > 0 && w.filter((x) => head.has(x)).length / w.length < 0.7
    })
  return kept.join(" ").trim() || undefined
}
