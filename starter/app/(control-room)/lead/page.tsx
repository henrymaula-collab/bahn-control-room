import { redirect } from "next/navigation"

// The v1 shift lead page; its parts move to Team and Know-how.
export default function LeadRedirect() {
  redirect("/team")
}
