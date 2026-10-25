import type { Metadata } from "next"
import { DemoResetButton } from "../_ui/demo-reset-button"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Team" }
export const dynamic = "force-dynamic"

export default function TeamPage() {
  return <TitlePage title="Team" icon="users">{process.env.CR_DEMO_TOOLS === "1" && <DemoResetButton />}</TitlePage>
}
