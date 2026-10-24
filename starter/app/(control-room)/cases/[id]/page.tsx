import { redirect } from "next/navigation"

// v1 and the agent link to /cases/<id>; the case now lives in Your tasks.
export default async function CaseRedirect({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/tasks/${encodeURIComponent((await params).id)}`)
}
