"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { choosePerson } from "../actions"
import { Icon } from "./icons"

type P = { id: string; name: string; desk: string; lead?: boolean }

/** Who is on shift on this screen. A switch for the demo, shaped like the portal's account menu. */
export function PersonSwitcher({ current, people }: { current: P; people: P[] }) {
  const [open, setOpen] = useState(false)
  const [, start] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const choose = (p: P) => {
    setOpen(false)
    start(async () => {
      await choosePerson(p.id)
      router.push(p.lead ? "/lead" : "/")
      router.refresh()
    })
  }

  return (
    <div className="person" ref={ref}>
      <button type="button" className="person-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>
          {current.name}
          <span className="desk">, {current.desk}</span>
        </span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-label">On shift now</p>
          {people.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === current.id} className="menu-item" onClick={() => choose(p)}>
              <span>
                {p.name}
                <span className="desk">, {p.desk}</span>
              </span>
              {p.id === current.id && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
