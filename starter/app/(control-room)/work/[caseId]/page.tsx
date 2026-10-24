import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getWork, getWorkCase } from "@/lib/control-room/client-v3"
import { clock } from "@/lib/control-room/format"
import { dueFor } from "../../_ui/lines"
import { Question } from "../../_ui/question"
import { currentPersonId } from "../../_ui/session"
import { Keep } from "../../_ui/text"
import { CaseRows } from "../../_ui/work-case"

type Params = Promise<{ caseId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { caseId } = await params
  const w = await getWorkCase(caseId, await currentPersonId())
  return { title: w ? `${w.detail.card.order.vehicle}, Work` : "Work" }
}

/** One case in Work: flow 1's decision card, then two rows, The situation and Why it came to you. */
export default async function WorkCasePage({ params }: { params: Params }) {
  const { caseId } = await params
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
  const queue = lists.needYou
  const at = queue.findIndex((r) => r.caseId === caseId)
  const nextId = at >= 0 ? queue[at + 1]?.caseId : queue.find((r) => r.caseId !== caseId)?.caseId

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
          nextHref={nextId ? `/work/${nextId}` : undefined}
          next={extras?.next}
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
          <p className="l ask quiet">{c.status === "agent_working" ? c.agentSteps.at(-1)?.summary : c.suggestion.effect}</p>
        </section>
      )}

      <CaseRows
        situation={extras?.situation}
        why={extras?.why ?? []}
        whyTitle={asks ? (mine ? "Why it came to you" : `Why it went to ${owner?.name}`) : undefined}
        now={now}
      />
    </div>
  )
}
