"use client"

import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { WelcomePanelProps } from "../../../_ui/overview-view"
import { Icon } from "../../../_ui/icons"
import { isNow, liftOn, n, useBoth, useFit, useKeep, when } from "../shared"
import "./arrival.css"

const SETTLE = 1150 // ms: the greeting holds alone, then settles into the panel
const COUNT_AT = 2000 // the key rises from about 2.1 s (arrival.css: rows wait for the greeting to land)
const COUNT_MS = 900

/** A number that counts up from zero once, from `at` ms after mount (the key arriving). */
function useCountUp(value: number, run: boolean, at = COUNT_AT): number {
  const [v, setV] = useState(value)
  useEffect(() => {
    if (!run) {
      setV(value)
      return
    }
    setV(0)
    let raf = 0
    const t0 = performance.now() + at
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / COUNT_MS))
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, run, at])
  return v
}

/** The greeting arrives alone over a veiled map, then settles into the panel; rows and counts follow. */
export function Arrival({ panelRef, firstName, tasks, now, counts, lift, setLift }: WelcomePanelProps) {
  const keep = useKeep()
  const box = useRef<HTMLElement | null>(null)
  const ref = useBoth(panelRef, box)
  const h1 = useRef<HTMLHeadingElement>(null)
  const ghost = useRef<HTMLParagraphElement>(null)
  const fit = useFit(box, Math.min(tasks.length, 6), 1)
  const shown = tasks.slice(0, fit)
  const rest = tasks.length - shown.length
  const [stage, setStage] = useState<"pre" | "run" | "done">("pre")

  // FLIP with a stand-in: a copy of the greeting is laid exactly over the real one, starts centred
  // over the map, and glides home; then the real greeting takes over (the panel can keep its clip).
  useLayoutEffect(() => {
    const el = h1.current
    const g = ghost.current
    const room = box.current?.parentElement
    if (!el || !g || !room || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage("done")
      return
    }
    const a = el.getBoundingClientRect()
    const r = room.getBoundingClientRect()
    g.style.left = `${a.left - r.left}px`
    g.style.top = `${a.top - r.top}px`
    g.style.width = `${a.width}px`
    g.style.setProperty("--dx", `${r.width / 2 - (a.left - r.left + a.width / 2)}px`)
    g.style.setProperty("--dy", `${r.height * 0.44 - (a.top - r.top + a.height / 2)}px`)
    g.style.setProperty("--s", "1.3")
    setStage("run")
    const id = window.setTimeout(() => setStage("done"), SETTLE + 2000)
    return () => window.clearTimeout(id)
  }, [])

  const onPlan = useCountUp(counts.onPlan, stage === "run")
  const agent = useCountUp(counts.agentWorking, stage === "run", COUNT_AT + 80)
  const red = useCountUp(counts.needsPerson, stage === "run", COUNT_AT + 160)

  return (
    <>
      <div className={`lab-welcome lab-welcome-12-veil ${stage}`} aria-hidden="true" />
      {stage !== "done" && (
        <div className="lab-welcome lab-welcome-12-stage" aria-hidden="true">
          <p ref={ghost} className={`lw-display ghost ${stage}`}>
            Welcome back to <em>Bahn Express</em>, {firstName}.
          </p>
        </div>
      )}
      <section ref={ref} className={`lab-welcome lab-welcome-12 lw-panel ${stage}`} aria-label="Today">
        <h1 ref={h1} className="lw-display">Welcome back to <em>Bahn Express</em>, {firstName}.</h1>

        <div className="after" style={{ ["--i" as string]: 0 }}>
          <Link href={keep(tasks[0] ? `/tasks/${tasks[0].caseId}` : "/tasks")} className={`lw-pill go${tasks.length ? "" : " quiet"}`}>
            <span>{tasks.length ? `${n(tasks.length)} task${tasks.length === 1 ? "" : "s"} for you to get started` : "Nothing for you right now"}</span>
            <Icon name="chevron-right" size={20} />
          </Link>
        </div>

        {tasks.length > 0 && (
          <ul className="lw-rows">
            {shown.map((r, i) => (
              <li key={r.caseId} className="after" style={{ ["--i" as string]: i + 1 }}>
                <Link href={keep(`/tasks/${r.caseId}`)} className={`lw-row${lift === r.orderId ? " lift" : ""}`} {...liftOn(r.orderId, setLift)}>
                  <span className="lw-v">{r.vehicle}</span>
                  <span className="lw-p">{r.place}</span>
                  {r.decideBy && <time className={`lw-t${isNow(r, now) ? " now" : ""}`}>{when(r.decideBy, now)}</time>}
                </Link>
              </li>
            ))}
            {rest > 0 && (
              <li className="after" style={{ ["--i" as string]: shown.length + 1 }}>
                <Link href={keep("/tasks")} className="lw-row lw-more">
                  <span>{n(rest)} more in Your tasks</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            )}
          </ul>
        )}

        <div className="lw-key after" style={{ ["--i" as string]: shown.length + 2 }} aria-label="The map's colours">
          <p className="lw-state"><span className="dot dot-green" /><span>On plan</span><span className="lw-n">{n(onPlan)}</span></p>
          <p className="lw-state"><span className="dot dot-agent" /><span>Agent working</span><span className="lw-n">{n(agent)}</span></p>
          <p className="lw-state"><span className="dot dot-red" /><span>Needs a person</span><span className="lw-n">{n(red)}</span></p>
        </div>
      </section>
    </>
  )
}
