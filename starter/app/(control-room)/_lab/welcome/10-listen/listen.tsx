"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, Key, liftOn, n, plural, useBoth, useFit, useKeep, when, word } from "../shared"
import "./listen.css"

const TZ = "Europe/Helsinki" // the room's clock
const dayTitle = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso))
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date(iso)))

/** A dated title and Listen: the brief is read aloud, and each row (and its pin) lights as it is read. */
export function Listen({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const [can, setCan] = useState(false)
  const [reading, setReading] = useState<number | null>(null) // -1 the opening line, -2 the closing line
  useEffect(() => {
    setCan("speechSynthesis" in window)
    return () => window.speechSynthesis?.cancel()
  }, [])

  function play() {
    const s = window.speechSynthesis
    if (reading !== null) {
      s.cancel()
      setReading(null)
      setLift(null)
      return
    }
    s.cancel()
    const h = hourOf(now)
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
    const read = tasks.slice(0, 4)
    const last = tasks.reduce<string | undefined>((m, r) => (r.decideBy && (!m || r.decideBy > m) ? r.decideBy : m), undefined)
    const lines: { text: string; i: number }[] = [
      {
        text: tasks.length
          ? `${greet}, ${firstName}. ${word(tasks.length)} ${plural(tasks.length, "car needs", "cars need")} you${last && tasks.length <= 4 ? `, all by ${when(last, now)}` : ""}.`
          : `${greet}, ${firstName}. Nothing needs you right now.`,
        i: -1,
      },
      ...read.map((r, i) => ({
        text: `${i === 0 ? "First" : i === read.length - 1 && i > 0 ? "And" : "Then"}, the ${r.vehicle} at ${r.place}${r.decideBy ? `, by ${when(r.decideBy, now)}` : ""}.`,
        i,
      })),
      { text: `${tasks.length > read.length ? `${word(tasks.length - read.length)} more are in Your tasks. ` : ""}The agent is on ${counts.agentWorking} other cars.`, i: -2 },
    ]
    const voice = s.getVoices().find((v) => v.lang === "en-GB" && /Daniel|Serena|Kate|Stephanie/.test(v.name)) ?? s.getVoices().find((v) => v.lang === "en-GB")
    lines.forEach((l, k) => {
      const u = new SpeechSynthesisUtterance(l.text)
      u.lang = "en-GB"
      u.rate = 1.02
      if (voice) u.voice = voice
      u.onstart = () => {
        setReading(l.i)
        setLift(l.i >= 0 ? read[l.i].orderId : null)
      }
      if (k === lines.length - 1) u.onend = () => (setReading(null), setLift(null))
      s.speak(u)
    })
    setReading(-1)
  }

  return (
    <section ref={ref} className="lab-welcome lab-welcome-10 lw-panel" aria-label="Today">
      <div className="lw10-head">
        <p className="date">{dayTitle(now)}</p>
        {can && (
          <button type="button" className={`listen${reading !== null ? " on" : ""}`} onClick={play} aria-pressed={reading !== null}>
            {reading !== null ? (
              <span className="bars" aria-hidden="true"><i /><i /><i /></span>
            ) : (
              <Icon name="play" size={14} />
            )}
            <span>{reading !== null ? "Stop" : "Listen"}</span>
          </button>
        )}
      </div>
      <h1 className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

      <Link href={keep(tasks[0] ? `/tasks/${tasks[0].caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
        <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
        <Icon name="chevron-right" size={20} />
      </Link>

      {tasks.length > 0 && (
        <ul className="lw-rows">
          {shown.map((r, i) => (
            <li key={r.caseId}>
              <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}${reading === i ? " reading" : ""}`} {...liftOn(r.orderId, setLift)}>
                <span className="lw-v">{r.vehicle}</span>
                <span className="lw-p">{r.place}</span>
                {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
              </Link>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <Link href={keep("/tasks")} className="lw-row lw-more">
                <span>{n(rest)} more in Your tasks</span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          )}
        </ul>
      )}

      <Key counts={counts} className={reading === -2 ? "reading" : ""} />
    </section>
  )
}
