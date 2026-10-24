import type { Metadata } from "next"
import { ORDERS } from "@/lib/control-room/fixtures/orders"
import { TitlePage } from "../../_ui/title-page"

type Params = Promise<{ orderId: string }>

const titleFor = (orderId: string) => {
  const o = ORDERS[orderId]
  return o ? `${o.reference}, ${o.vehicle}` : orderId
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: titleFor((await params).orderId) }
}

/** The order's own page. Title only until the Orders section is built. */
export default async function OrderPage({ params }: { params: Params }) {
  return <TitlePage title={titleFor((await params).orderId)} icon="car" />
}
