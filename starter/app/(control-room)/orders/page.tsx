import type { Metadata } from "next"
import { TitlePage } from "../_ui/title-page"

export const metadata: Metadata = { title: "Orders" }

export default function OrdersPage() {
  return <TitlePage title="Orders" icon="car" />
}
