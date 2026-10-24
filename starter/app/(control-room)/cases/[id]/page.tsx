import { redirect } from "next/navigation"

// v1 and the agent link to /cases/<id>; the case now lives in Work.
export default async function CaseRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/work/${encodeURIComponent((await params).id)}`)
}
