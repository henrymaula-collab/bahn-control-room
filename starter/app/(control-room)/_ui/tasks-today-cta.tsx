import Link from "next/link"
import { Icon } from "./icons"

/**
 * The one way on from the Overview: the signed-in person's tasks today, as Bahn's black
 * pill ("Get a quote" on bahnexpress.com). Track 5 sends the live count and owns the
 * route; this component only draws it. With nothing waiting it steps back to a quiet pill.
 */
export function TasksTodayCta({ count, href = "/work", size = "l" }: { count: number; href?: string; size?: "l" | "m" }) {
  const label = count === 0 ? "Nothing for you right now" : `${count} task${count === 1 ? "" : "s"} for you today`
  return (
    <Link href={href} className={`tasks-today tasks-today-${size}${count === 0 ? " tasks-today-none" : ""}`}>
      <span>{label}</span>
      <Icon name="chevron-right" size={size === "l" ? 22 : 18} />
    </Link>
  )
}
