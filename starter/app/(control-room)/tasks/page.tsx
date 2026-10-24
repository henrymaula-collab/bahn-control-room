import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getDesk, getWork } from "@/lib/control-room/client"
import { clock, count } from "@/lib/control-room/format"
import { labWork } from "../_lab/server"
import { keepQuery } from "../_lab/slots"
import { currentPersonId } from "../_ui/session"
import { lookQuery } from "./look"

export const metadata: Metadata = { title: "Your tasks" }

/** Your tasks opens on the most urgent case that needs you; when nothing does, it says so once. */
export default async function WorkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const personId = await currentPersonId()
  const work = await labWork(personId, await getWork(personId))
  const sp = await searchParams
  const lab = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])))
  if (work.needYou.length) redirect(`/tasks/${work.needYou[0].caseId}${keepQuery(lab, lookQuery(sp.tasks))}`)
  const desk = await getDesk(personId)
  return (
    <section className="question detail-inner empty">
      <h1 className="l what">Nothing needs you right now.</h1>
      <p className="l ask quiet">
        The agents checked {count(desk.quiet.ordersChecked)} orders at {clock(desk.quiet.checkedAt)}.
      </p>
      <div className="answers">
        <Link href="/" className="btn btn-secondary">
          Open the overview
        </Link>
      </div>
    </section>
  )
}
