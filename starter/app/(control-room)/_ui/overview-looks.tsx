"use client"

import Link from "next/link"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { when } from "@/lib/control-room/format"
import type { MapCar, Overview } from "@/lib/control-room/types-v3"
import { CarMap, type RedInfo } from "./car-map"
import { Icon } from "./icons"
import type { MapLook } from "./map-style"
import { PinCard } from "./overview-view"
import { boundsOf, carsIn, regionsWithCars, tally, type RegionId } from "./regions"
import { TasksTodayCta } from "./tasks-today-cta"

/**
 * The Overview in the look of Bahn's own website (bahnexpress.com): a grainy, blurred
 * light-trail backdrop, giant extended uppercase type, a pill switch, Bahn's black pill
 * and the dark three-column strip. Three layouts of the same parts, chosen by ?look=:
 *   a  the website: hero, strip, the map in a big rounded card, know-how with a quote
 *   b  the map as the hero: the backdrop fades into it from the top
 *   c  the map edge to edge (v3) with the floating panel as a small website hero
 * The real map and its red pins work the same in all three.
 */
export type Look = "a" | "b" | "c"
export type Quote = { text: string; who: string; where?: string }

const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)
const ART = "/control-room/overview"

interface Props {
  look: Look
  data: Overview
  red: Record<string, RedInfo>
  mapLook: MapLook
  quote?: Quote
  handledAlone: number
}

export function OverviewLooks({ look, data, red, mapLook, quote, handledAlone }: Props) {
  const [region, setRegion] = useState<RegionId>("all")
  const regions = useMemo(() => regionsWithCars(data.cars), [data.cars])
  const here = useMemo(() => carsIn(data.cars, region), [data.cars, region])
  const focus = useMemo(() => (region === "all" ? null : boundsOf(here)), [region, here])
  const facts = useMemo(() => factsFor(here, data.now), [here, data.now])
  const t = tally(here)
  const where = regions.find((r) => r.id === region)?.where ?? "across Europe"
  const tasks = data.needYou.length
  const card = (orderId: string, close: () => void) => <PinCard info={red[orderId]} close={close} />
  const pills = <RegionSwitch regions={regions} value={region} onChange={setRegion} />

  if (look === "b")
    return (
      <div className="ovx ovx-b">
        <CarMap
          cars={data.cars}
          red={red}
          look={mapLook}
          focus={focus}
          controls="none"
          pad={{ top: 392, bottom: 196, left: 72, right: 72 }} // under the black pill, above the strip
          padPhone={{ top: 300, bottom: 140, left: 24, right: 24 }}
          card={card}
        />
        <Backdrop src="trails-top.jpg" className="ovx-b-sky" />
        <header className="ovx-top">
          <span className="ovx-title">Overview</span>
          {pills}
        </header>
        <div className="ovx-b-lead">
          <Display total={t.total} where={where} />
          <TasksTodayCta count={tasks} />
        </div>
        <Strip t={t} facts={facts} className="ovx-b-strip" />
      </div>
    )

  if (look === "c")
    return (
      <div className="ovx ovx-c">
        <CarMap
          cars={data.cars}
          red={red}
          look={mapLook}
          focus={focus}
          pad={{ top: 96, bottom: 48, left: 16 + 392 + 56, right: 72 }}
          padPhone={{ top: 80, bottom: 24, left: 24, right: 24 }}
          card={card}
        />
        <aside className="ovx-c-panel" aria-label="Today">
          <div className="ovx-c-hero">
            <Backdrop src="trails.jpg" />
            <Stat total={t.total} where={where} />
            <TasksTodayCta count={tasks} size="m" />
          </div>
          <Strip t={t} facts={facts} className="ovx-c-strip" />
        </aside>
        <div className="ovx-c-switch">{pills}</div>
      </div>
    )

  return (
    <div className="ovx ovx-a">
      <section className="ovx-a-hero">
        <Backdrop src="trails.jpg" />
        <header className="ovx-top">
          <span className="ovx-title">Overview</span>
          {pills}
        </header>
        <div className="ovx-a-lead">
          <Display total={t.total} where={where} />
          <TasksTodayCta count={tasks} />
        </div>
        <Strip t={t} facts={facts} className="ovx-a-strip" />
      </section>
      <section className="ovx-a-body">
        <div className="ovx-a-map">
          <CarMap
            cars={data.cars}
            red={red}
            look={mapLook}
            focus={focus}
            cooperative
            pad={{ top: 56, bottom: 56, left: 56, right: 56 }}
            padPhone={{ top: 32, bottom: 32, left: 24, right: 24 }}
            card={card}
          />
        </div>
        {quote && <KnowHow quote={quote} handledAlone={handledAlone} />}
      </section>
    </div>
  )
}

/** One live fact per state, for the cars in view. Times in the room's clock. */
function factsFor(cars: MapCar[], now: string) {
  const soonest = (list: MapCar[]) =>
    list.filter((c) => c.nextAt && c.nextAt >= now).sort((a, b) => a.nextAt!.localeCompare(b.nextAt!))[0]
  const d = soonest(cars.filter((c) => c.state === "on_plan"))
  const r = soonest(cars.filter((c) => c.state === "needs_person" && c.caseId))
  return {
    onPlan: d ? `Next delivery ${when(d.nextAt!, now, undefined, true)} in ${d.to}` : "Moving as booked",
    agent: "The agent does the legwork",
    needs: r ? `Next decision by ${when(r.nextAt!, now, undefined, true)}` : "Waiting for a decision",
  }
}

/** Bahn's hero backdrop: blurred light trails, film grain on top, a warm wash (their recipe). */
function Backdrop({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`ovx-backdrop ${className}`} aria-hidden="true">
      <div className="ovx-backdrop-media" style={{ backgroundImage: `url(${ART}/${src})` }} />
      <div className="ovx-backdrop-grain" style={{ backgroundImage: `url(${ART}/grain.png)` }} />
      <div className="ovx-backdrop-wash" />
    </div>
  )
}

/** A number that runs to its new value when the country changes. */
function useRun(target: number) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700)
      const x = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)))
      from.current = x
      setV(x)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

/** "YOUR CARS, / DELIVERED / quickly and reliably", in the control room's words. */
function Display({ total, where }: { total: number; where: string }) {
  const v = useRun(total)
  return (
    <h1 className="ovx-display" aria-label={`${n(total)} cars on the road ${where} today`}>
      <span className="ovx-d1 num" aria-hidden="true">
        {n(v)} {total === 1 ? "car" : "cars"}
      </span>
      <span className="ovx-d2" aria-hidden="true">on the road</span>
      <span className="ovx-d3" aria-hidden="true">{where} today</span>
    </h1>
  )
}

/** The small hero's version: the number first, as on Bahn's stat strips. */
function Stat({ total, where }: { total: number; where: string }) {
  const v = useRun(total)
  return (
    <h1 className="ovx-stat" aria-label={`${n(total)} cars on the road ${where} today`}>
      <span className="ovx-s1 num" aria-hidden="true">{n(v)}</span>
      <span className="ovx-s2" aria-hidden="true">{total === 1 ? "car" : "cars"} on the road</span>
      <span className="ovx-s3" aria-hidden="true">{where} today</span>
    </h1>
  )
}

/** Bahn's segmented pill (their main nav), here the country: the map flies there. */
function RegionSwitch({
  regions,
  value,
  onChange,
}: {
  regions: { id: RegionId; label: string }[]
  value: RegionId
  onChange: (id: RegionId) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)
  const measure = () => {
    const el = track.current?.querySelector<HTMLButtonElement>(`[data-id="${value}"]`)
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(measure, [value, regions])
  useEffect(() => {
    document.fonts?.ready.then(measure)
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div ref={track} className="ovx-seg" role="group" aria-label="Where">
      {ind && <span className="ovx-seg-on" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} aria-hidden="true" />}
      {regions.map((r) => (
        <button key={r.id} data-id={r.id} type="button" aria-pressed={r.id === value} onClick={() => onChange(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

/** The website's dark strip: a grey label, a big line, one line under it. Also the map's key. */
function Strip({ t, facts, className }: { t: ReturnType<typeof tally>; facts: ReturnType<typeof factsFor>; className: string }) {
  const cells = [
    { dot: "dot-green", label: "On plan", count: t.onPlan, fact: facts.onPlan },
    { dot: "dot-agent", label: "Agent working", count: t.agentWorking, fact: facts.agent },
    { dot: "dot-red", label: "Needs a person", count: t.needsPerson, fact: facts.needs },
  ]
  return (
    <section className={`ovx-strip ${className}`} aria-label="The cars by state">
      {cells.map((c) => (
        <div key={c.label} className="ovx-cell">
          <p className="ovx-label">
            <span className={`dot ${c.dot}`} />
            {c.label}
          </p>
          <p className="ovx-big num">
            {n(c.count)} {c.count === 1 ? "car" : "cars"}
          </p>
          <p className="ovx-fact">{c.fact}</p>
        </div>
      ))}
    </section>
  )
}

/** The website's cream card: a heading, a quote card, one line of proof under a hairline. */
function KnowHow({ quote, handledAlone }: { quote: Quote; handledAlone: number }) {
  return (
    <section className="ovx-cream" aria-label="Know-how">
      <div className="ovx-cream-copy">
        <p className="ovx-eyebrow">Know-how</p>
        <h2 className="ovx-h">People decide. The agent learns.</h2>
        <p className="ovx-lede">Every decision comes back with its reason, and the agent uses it the next time.</p>
        <Link href="/know-how" className="ovx-more">
          Open Know-how
          <Icon name="chevron-right" size={18} />
        </Link>
      </div>
      <figure className="ovx-quote">
        <span className="ovx-quote-mark" aria-hidden="true">
          &ldquo;
        </span>
        <blockquote>{quote.text}</blockquote>
        <figcaption>
          <span className="ovx-who">{quote.who}</span>
          {quote.where && <span className="ovx-where">{quote.where}</span>}
        </figcaption>
      </figure>
      {handledAlone > 0 && (
        <p className="ovx-proof">
          The agent handled {handledAlone} {handledAlone === 1 ? "case" : "cases"} alone today, under rules people turned on.
        </p>
      )}
    </section>
  )
}
