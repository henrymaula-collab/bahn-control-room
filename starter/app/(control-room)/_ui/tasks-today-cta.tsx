import Link from "next/link"
import { Icon } from "./icons"

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/**
 * The Overview's one line to Your tasks: "2 tasks for you today ›". `count` is the signed-in
 * person's Needs you, the same number as the side menu. Kept as one small component so a
 * restyled Overview can place it anywhere; with nothing waiting it says so once, without a link.
 */
export function TasksTodayCta({ count, href }: { count: number; href: string }) {
  if (count <= 0) return <p className="none m">No tasks for you right now</p>
  return (
    <Link href={href} className="need-head m">
      {n(count)} {count === 1 ? "task" : "tasks"} for you today
      <Icon name="chevron-right" size={18} />
    </Link>
  )
}
