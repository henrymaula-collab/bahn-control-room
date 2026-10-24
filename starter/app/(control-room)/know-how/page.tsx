import type { Metadata } from "next"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Know-how" }

export default function KnowHowPage() {
  return <TitlePage title="Know-how" icon="book-open" />
}
