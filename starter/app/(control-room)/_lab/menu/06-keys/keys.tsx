"use client"

// menu 06: go-to keys, as Linear does them: G, then a letter (G T is Your tasks). The key shows at
// the end of a row on hover or keyboard focus, and pressing G shows every key in the menu for a
// moment, so nobody has to learn them first. Never in a text field, never with a modifier
// (Safari's own Cmd+1..9 switch tabs), and every row stays a plain link (Primer: shortcuts are an
// enhancement, never the only way).
import "./keys.css"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { PersonSwitcher } from "../../../_ui/person-switcher"
import { Frame, Lockup, NavRow, NeedsMenu, SECTIONS, useHere, useKeep, type ShellProps } from "../kit/kit"

const KEYS: Record<string, string> = { "/": "O", "/tasks": "T", "/history": "H", "/orders": "R", "/agents": "A", "/know-how": "K", "/team": "M" }

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

export function KeysShell({ person, people, needYou, children }: ShellProps) {
  const { here } = useHere()
  const router = useRouter()
  const keep = useKeep()
  const keepRef = useRef(keep)
  keepRef.current = keep
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    let timer: number | undefined
    let on = false
    const arm = (v: boolean) => {
      on = v
      setArmed(v)
      window.clearTimeout(timer)
      if (v) timer = window.setTimeout(() => arm(false), 1600)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || e.repeat) return
      const k = e.key.toUpperCase()
      if (!on) {
        if (k === "G") arm(true)
        return
      }
      const href = Object.keys(KEYS).find((h) => KEYS[h] === k)
      arm(false)
      if (href) {
        // Capture phase + stop: G then K is Know-how, not also Your tasks' K (the previous task, work-frame).
        e.preventDefault()
        e.stopPropagation()
        router.push(keepRef.current(href))
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [router])
  return (
    <Frame
      root="lab-menu-06"
      here={here}
      attrs={armed ? { "data-armed": "" } : undefined}
      side={
        <>
          <Lockup />
          <nav className="nav">
            {SECTIONS.map((s) => (
              <NavRow
                key={s.href}
                s={s}
                here={here}
                needYou={needYou}
                title={`${s.label}: G then ${KEYS[s.href]}`}
                after={
                  <kbd className="lm06-k" aria-hidden="true">
                    <span>G</span>
                    <span>{KEYS[s.href]}</span>
                  </kbd>
                }
              />
            ))}
          </nav>
          <NeedsMenu />
          <div className="side-foot">
            <PersonSwitcher current={person} people={people} />
          </div>
        </>
      }
    >
      {children}
    </Frame>
  )
}
