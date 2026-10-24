import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getDesk, getWork } from "@/lib/control-room/client"
import { clock, count } from "@/lib/control-room/format"
import { currentPersonId } from "../_ui/session"

export const metadata: Metadata = { title: "Your tasks" }

/** Your tasks opens on the most urgent case that needs you; when nothing does, it says so once. */
export default async function WorkPage() {
  const personId = await currentPersonId()
  const work = await getWork(personId)
  if (work.needYou.length) redirect(`/tasks/${work.needYou[0].caseId}`)
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
