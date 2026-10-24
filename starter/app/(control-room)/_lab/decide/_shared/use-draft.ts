"use client"

// Slot `decide`, shared (not a variant): the draft's local state every preview needs (the English,
// the edit, the edited text) and the rect of the card's column for things that float over it.

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { Draft } from "@/lib/control-room/views"
import { recipient } from "./helpers"

export function useDraft(draft: Draft, shown: boolean) {
  // Lab photo state ?english=1: the English already shown (how each variant offers the translation).
  const startEnglish = useSearchParams()?.get("english") === "1"
  const [english, setEnglish] = useState(startEnglish)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(draft.text)
  useEffect(() => {
    if (!shown) {
      setEditing(false)
      if (!startEnglish) setEnglish(false)
    }
  }, [shown, startEnglish])
  const edited = text.trim() !== draft.text.trim()
  const who = recipient(draft.to)
  return {
    english,
    setEnglish,
    editing,
    setEditing,
    text,
    setText,
    edited,
    /** The text the card's onSend gets: undefined when unchanged (today's contract). */
    out: edited ? text.trim() : undefined,
    foreign: draft.language !== "en" && !!draft.translation,
    who,
    noun: who.email ? "email" : "message",
  }
}

/** Where the card's column is on screen, for a pill or bar that floats over its foot. */
export function useColumn(on = true) {
  const [rect, setRect] = useState<{ left: number; width: number; bottom: number } | null>(null)
  useEffect(() => {
    if (!on) return
    const measure = () => {
      const el = document.querySelector<HTMLElement>(".work .detail") ?? document.querySelector<HTMLElement>(".main")
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ left: r.left, width: r.width, bottom: window.innerHeight - r.bottom })
    }
    measure()
    const ro = new ResizeObserver(measure)
    const el = document.querySelector(".work .detail")
    if (el) ro.observe(el)
    window.addEventListener("resize", measure)
    // The card's column changes width when the side panel slides in or out.
    const t = setInterval(measure, 400)
    return () => (ro.disconnect(), window.removeEventListener("resize", measure), clearInterval(t))
  }, [on])
  return rect
}
