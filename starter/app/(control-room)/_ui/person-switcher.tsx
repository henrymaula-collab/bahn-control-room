"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { choosePerson } from "../actions"
import { Icon } from "./icons"

type P = { id: string; name: string; desk: string; avatar: string } // desk = Bahn job title

/** Who is on shift on this screen. A switch for the demo, shaped like the portal's account menu. */
export function PersonSwitcher({ current, people }: { current: P; people: P[] }) {
  const [open, setOpen] = useState(false)
  const [, start] = useTransition()
  const router = useRouter()
  const path = usePathname() ?? "/"
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
      // Stay in the same section; in Your tasks, open the new person's own list.
      if (path.startsWith("/tasks")) router.push("/tasks")
      router.refresh()
    })
  }

  return (
    <div className="person" ref={ref}>
      <button type="button" className="person-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar" src={current.avatar} alt="" width={40} height={40} />
        <span className="person-name">
          <span>{current.name}</span>
          <span className="s">{current.desk}</span>
        </span>
        <Icon name="chevron-up" size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {people.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === current.id} className="menu-item" onClick={() => choose(p)}>
              <span className="menu-person">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar avatar-s" src={p.avatar} alt="" width={28} height={28} />
                <span>
                  {p.name}
                  <span className="s">{p.desk}</span>
                </span>
              </span>
              {p.id === current.id && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
