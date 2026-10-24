import type { Metadata } from "next"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Team" }

export default function TeamPage() {
  return <TitlePage title="Team" icon="users" />
}
