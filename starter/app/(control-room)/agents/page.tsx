import type { Metadata } from "next"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Agents" }

export default function AgentsPage() {
  return <TitlePage title="Agents" icon="headset" />
}
