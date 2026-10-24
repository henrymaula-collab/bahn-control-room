"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** J and K walk the queue without going back to the desk (Linear and Stripe review queues do the same). */
export function QueueKeys({ prevHref, nextHref }: { prevHref?: string; nextHref?: string }) {
  const router = useRouter()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.closest("input, textarea, select, [contenteditable]") || t.isContentEditable))) return
      if (e.key === "j" && nextHref) router.push(nextHref)
      if (e.key === "k" && prevHref) router.push(prevHref)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, prevHref, nextHref])
  return null
}
