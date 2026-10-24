"use client"

// The situation slot's shared kit (builder SI). Not a variant: the shot pipeline only reads NN-slug
// folders. Every variant takes today's props ({ situation, open, now }) and lays out its own panel;
// this file gives them the same derived facts as today's SituationPanel (work-case.tsx), a lab
// route map with a few more options than _ui/route-map.tsx, and the order link.
// On adoption into v4: copy this folder with the variant and change the one import in work-case.tsx.

import "./kit.css"
import "maplibre-gl/dist/maplibre-gl.css"
import Link from "next/link"
import type { Map as MlMap } from "maplibre-gl"
import { useEffect, useRef } from "react"
import { range } from "@/lib/control-room/format"
import type { KeyFact, LatLng, Situation, Stop } from "@/lib/control-room/types-v3"
import { Icon } from "../../../_ui/icons"
import { WORKER_URL, loadStyle } from "../../../_ui/map-style"

export type SituationProps = { situation: Situation; open: boolean; now: string }

const LOCAL_TZ: Record<string, string> = { DE: "Europe/Berlin", DK: "Europe/Copenhagen", SE: "Europe/Stockholm", FR: "Europe/Paris" }

/** The window in the place's own time, as today: "Mon 26 Oct, 10:00–13:00 in Hamburg". */
export function when(stop: Stop, now: string): string | undefined {
  if (!stop.window) return undefined
  const tz = LOCAL_TZ[stop.country]
  return tz ? `${range(stop.window.from, stop.window.to, now, tz)} in ${stop.city}` : range(stop.window.from, stop.window.to, now)
}

/** The window without the city (for layouts that already name the place's city). */
export function windowOnly(stop: Stop, now: string): string | undefined {
  if (!stop.window) return undefined
  return range(stop.window.from, stop.window.to, now, LOCAL_TZ[stop.country])
}

/** "Calverona Hamburg", or "Private address, Hamburg" as today. */
export function placeName(stop: Stop): string {
  return stop.place === "Private address" ? `Private address, ${stop.city}` : stop.place
}

export type End = { key: "a" | "b"; letter: "A" | "B"; label: "Pickup" | "Delivery"; stop: Stop; name: string; time?: string; window?: string }

export function ends(s: Situation, now: string): [End, End] {
  return [
    { key: "a", letter: "A", label: "Pickup", stop: s.pickup, name: placeName(s.pickup), time: when(s.pickup, now), window: windowOnly(s.pickup, now) },
    { key: "b", letter: "B", label: "Delivery", stop: s.delivery, name: placeName(s.delivery), time: when(s.delivery, now), window: windowOnly(s.delivery, now) },
  ]
}

const LEG = new Set(["Pickup", "Driver", "Delivery"])

/** Today's fact list: who it waits on first, then the engine's facts, saying nothing twice. */
export function factsOf(s: Situation): KeyFact[] {
  const shown = (stop: Stop) => stop.booked && !!stop.window
  const facts: KeyFact[] = [
    ...(s.waitingOn ? [s.waitingOn] : []),
    ...s.facts.filter((f) => !(f.label === "Pickup" && shown(s.pickup)) && !(f.label === "Delivery" && shown(s.delivery))),
  ]
  if (!facts.some((f) => f.label === "Driver")) facts.push({ label: "Driver", value: s.driver ?? "Not booked" })
  return facts
}

/** The fact that blocks the case: the engine puts the case type's fact first (Release Missing, Car
 *  Not ready, Pickup place Not answering ...); Pickup, Driver and Delivery are the leg, not a blocker. */
export function blockerOf(s: Situation): KeyFact | undefined {
  return s.facts.find((f) => !LEG.has(f.label))
}

/** "Release missing", "Car not ready": the blocker as a few words. */
export function blockerWords(f: KeyFact): string {
  return `${f.label} ${f.value.charAt(0).toLowerCase()}${f.value.slice(1)}`
}

/** An engine fact by label ("Driver", "Pickup", "Delivery"), with today's fallbacks. */
export function factOf(s: Situation, label: string): string | undefined {
  const f = s.facts.find((x) => x.label === label)?.value
  if (label === "Driver") return f ?? s.driver ?? "Not booked"
  return f
}

/** Straight-line distance in km between the two ends. */
export function km(a: LatLng, b: LatLng): number {
  const r = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/** "0.3 km", "165 km": as the crow flies, which is what two pins on a map show. */
export function distanceWords(s: Situation): string {
  const d = km(s.pickup.position, s.delivery.position)
  return d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`
}

export const orderHref = (s: Situation) => `/orders/${encodeURIComponent(s.orderId)}`

/** "Open the order ›" as today, with the variant's own class. */
export function OrderLink({ s, className = "s-order", icon = false, label = "Open the order" }: { s: Situation; className?: string; icon?: boolean; label?: string }) {
  return (
    <Link href={orderHref(s)} className={className}>
      {icon && (
        <span className="s-order-icon" aria-hidden="true">
          <Icon name="car" size={18} />
        </span>
      )}
      <span className="s-order-label">{label}</span>
      <span className="s-order-chev" aria-hidden="true">
        <Icon name="chevron-right" size={18} />
      </span>
    </Link>
  )
}

/** The panel element every variant renders: today's classes (slide-in, narrow-screen rules) plus the kit's and its own. */
export function Panel({ nn, open, className = "", children }: { nn: string; open: boolean; className?: string; children: React.ReactNode }) {
  return (
    <aside
      id="situation"
      className={`panel situation-panel lab-situation-base lab-situation-${nn}${open ? " open" : ""}${className ? ` ${className}` : ""}`}
      aria-label="The situation"
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </aside>
  )
}

export type Pad = { top: number; bottom: number; left: number; right: number }

export type LabMapProps = {
  from: LatLng
  to: LatLng
  /** "line": today's straight orange-to-black leg; "arc": a curved leg (no road implied); "none": pins only. */
  leg?: "line" | "arc" | "none"
  /** Softer water and parks, so the pins and the leg carry the colour (HIG Maps "muted" emphasis). */
  muted?: boolean
  /** Callouts beside the pins: the place and its time, on the map itself. */
  labels?: { a: [string, string?]; b: [string, string?] }
  /** One pin for both ends when they would overlap (HIG Maps: cluster overlapping points). */
  cluster?: boolean
  padding?: number | Pad
  maxZoom?: number
  className?: string
  /** Drag and zoom (HIG Maps: "in general, make your map interactive"). */
  interactive?: boolean
  /** Where the attribution (i) sits; top-right when a sheet covers the map's foot. */
  attribution?: "bottom-right" | "top-right"
}

const ORANGE = "#fd6a31"
const INK = "#12110e"
const PAGE = "#fffef7"

/** A quadratic curve from a to b, bowed to the left of travel by a fifth of the leg. */
function arc(a: [number, number], b: [number, number], n = 48): [number, number][] {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const c: [number, number] = [mx - dy * 0.22, my + dx * 0.22]
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return out
}

function pinEl(letter: string, bg: string, ink: string, extra = "") {
  const el = document.createElement("div")
  el.className = `s-pin${extra ? ` ${extra}` : ""}`
  el.style.background = bg
  el.style.color = ink
  el.textContent = letter
  el.setAttribute("aria-hidden", "true")
  return el
}

/** The lab's route map: today's look (Bahn's light style, the orange-to-black leg, A and B pins) with options. */
export function LabMap({ from, to, leg = "line", muted = false, labels, cluster = false, padding, maxZoom = 12, className = "", interactive = false, attribution = "bottom-right" }: LabMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const pad = typeof padding === "number" ? padding : JSON.stringify(padding)

  useEffect(() => {
    let gone = false
    let m: MlMap | null = null
    ;(async () => {
      const [ml, style] = await Promise.all([import("maplibre-gl"), loadStyle("bahn")])
      if (gone || !box.current) return
      if (ml.getWorkerUrl() !== WORKER_URL) ml.setWorkerUrl(WORKER_URL)
      const a: [number, number] = [from.lng, from.lat]
      const b: [number, number] = [to.lng, to.lat]
      // Callouts: beside the pins (left and right, outward) unless the leg runs mostly east-west,
      // then above and below, so the route keeps the map's width (BMW, Helsinki to Turku).
      const dx = Math.abs(a[0] - b[0])
      const dy = Math.abs(a[1] - b[1]) / Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
      const w = box.current.clientWidth
      const h = box.current.clientHeight
      // A narrow map (Henry's Safari) has no room beside the pins: callouts go above and below.
      const across = !!labels && (dx > 2 * dy || w < 340)
      const want = padding ?? (labels ? (across ? { top: 86, bottom: 86, left: 96, right: 96 } : { top: 44, bottom: 44, left: 150, right: 150 }) : 44)
      // Never more padding than the box has room for (Henry's Safari: a 290 px map took 300 px of
      // side padding and fell back to the whole world): keep at least 60 x 40 px for the route.
      const pw = typeof want === "number" ? { top: want, bottom: want, left: want, right: want } : want
      const k = Math.min(1, (w - 60) / Math.max(1, pw.left + pw.right), (h - 40) / Math.max(1, pw.top + pw.bottom))
      const p = { top: Math.max(8, pw.top * k), bottom: Math.max(8, pw.bottom * k), left: Math.max(8, pw.left * k), right: Math.max(8, pw.right * k) }
      m = new ml.Map({
        container: box.current,
        style,
        interactive,
        attributionControl: attribution === "bottom-right" ? { compact: true } : false,
        fadeDuration: 0,
        dragRotate: false,
        pitchWithRotate: false,
        bounds: [
          [Math.min(a[0], b[0]), Math.min(a[1], b[1])],
          [Math.max(a[0], b[0]), Math.max(a[1], b[1])],
        ],
        fitBoundsOptions: { padding: p, maxZoom },
      })
      if (attribution !== "bottom-right") m.addControl(new ml.AttributionControl({ compact: true }), attribution)
      if (interactive) m.scrollZoom.disable() // the panel scrolls; pinch and the buttons still zoom
      if (interactive) m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right")
      // Both ends closer than a pin's width: one pin for both (HIG: cluster overlapping points).
      const pa = m.project(a)
      const pb = m.project(b)
      const merged = cluster && Math.hypot(pa.x - pb.x, pa.y - pb.y) < 30
      m.on("load", () => {
        if (!m) return
        for (const id of ["label_town", "label_village"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none")
        box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show")
        if (muted) {
          for (const l of m.getStyle().layers) {
            if (l.type === "fill" && /water/.test(l.id)) m.setPaintProperty(l.id, "fill-color", "#e3ebe8")
            if (l.type === "fill" && /(park|wood|grass|landcover|landuse)/.test(l.id)) m.setPaintProperty(l.id, "fill-opacity", 0.35)
          }
        }
        // An invisible symbol under each pin, placed first, so a city name under a pin yields
        // instead of running through it ("H(A)nki").
        m.addSource("lab-keepout", { type: "geojson", data: { type: "FeatureCollection", features: (merged ? [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number]] : [a, b]).map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } })) } })
        m.addLayer({
          id: "lab-keepout",
          type: "symbol",
          source: "lab-keepout",
          layout: { "text-field": merged ? "AAAA" : "AA", "text-font": ["Noto Sans Regular"], "text-size": 16, "text-padding": 6, "text-allow-overlap": true, "text-ignore-placement": false },
          paint: { "text-opacity": 0 },
        })
        if (leg !== "none" && !merged) {
          const coords = leg === "arc" ? arc(a, b) : [a, b]
          m.addSource("lab-leg", { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } })
          const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id
          m.addLayer(
            {
              id: "lab-leg",
              type: "line",
              source: "lab-leg",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-width": leg === "arc" ? 2.5 : 3,
                "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, ORANGE, 0.45, ORANGE, 0.55, INK, 1, INK],
                ...(leg === "arc" ? { "line-dasharray": [0.1, 2] } : {}),
              },
            },
            firstLabel,
          )
        }
      })
      const add = (at: [number, number], el: HTMLElement) => new ml.Marker({ element: el }).setLngLat(at).addTo(m!)
      if (merged) {
        const el = document.createElement("div")
        el.className = "s-pin s-pin-pair"
        el.setAttribute("aria-hidden", "true")
        el.innerHTML = `<span style="background:${ORANGE};color:${INK}">A</span><span style="background:${INK};color:${PAGE}">B</span>`
        if (labels) {
          const t = document.createElement("span")
          t.className = "s-callout s-callout-below"
          t.innerHTML = `<b></b><i></i>`
          t.querySelector("b")!.textContent = labels.a[0] === labels.b[0] ? labels.a[0] : `${labels.a[0]} and ${labels.b[0]}`
          const d = km(from, to)
          t.querySelector("i")!.textContent = `${d < 10 ? d.toFixed(1) : Math.round(d)} km apart`
          el.appendChild(t)
        }
        add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], el)
        return
      }
      const aLeft = pa.x <= pb.x
      const aLow = pa.y >= pb.y
      for (const [at, letter, bg, ink, lab, side] of [
        [a, "A", ORANGE, INK, labels?.a, across ? (aLow ? "below" : "above") : aLeft ? "left" : "right"],
        [b, "B", INK, PAGE, labels?.b, across ? (aLow ? "above" : "below") : aLeft ? "right" : "left"],
      ] as const) {
        const el = pinEl(letter, bg, ink)
        if (lab) {
          const t = document.createElement("span")
          t.className = `s-callout s-callout-${side}`
          t.innerHTML = `<b></b>${lab[1] ? "<i></i>" : ""}`
          t.querySelector("b")!.textContent = lab[0]
          if (lab[1]) t.querySelector("i")!.textContent = lab[1]
          el.appendChild(t)
        }
        add(at as [number, number], el)
      }
    })()
    return () => {
      gone = true
      m?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.lat, from.lng, to.lat, to.lng, leg, muted, cluster, maxZoom, pad, interactive, attribution, labels?.a[0], labels?.a[1], labels?.b[0], labels?.b[1]])

  return <div ref={box} data-lab-map="" className={`s-map ${className}`} role="img" aria-label="Route from the pickup place (A) to the delivery (B)" />
}

/** An A or B letter in its colour, as on the map (ink on orange 6.55:1; birch on ink). */
export function Mark({ letter, className = "" }: { letter: "A" | "B"; className?: string }) {
  return (
    <span className={`s-mark s-mark-${letter.toLowerCase()}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {letter}
    </span>
  )
}

/** Label and value rows, label grey, value ink; an optional label to set in 600 (the blocker). */
export function Kv({ facts, strong, className = "s-kv" }: { facts: KeyFact[]; strong?: string; className?: string }) {
  return (
    <dl className={className}>
      {facts.map((f) => (
        <div key={f.label} className={f.label === strong ? "s-kv-row is-strong" : "s-kv-row"}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The engine's facts without the ones a layout already shows (by label), keeping today's order. */
export function restFacts(s: Situation, drop: string[]): KeyFact[] {
  return factsOf(s).filter((f) => !drop.includes(f.label))
}

/** What an end says when it has no window: the engine's own words ("Not booked", "No promise yet"). */
export function endTime(s: Situation, e: End, withCity = true): string {
  return (withCity ? e.time : e.window) ?? factOf(s, e.label) ?? "No time set yet"
}

/** "Waiting for Kovellin, the customer". */
export function waitingWords(s: Situation): string | undefined {
  return s.waitingOn ? `Waiting for ${s.waitingOn.value}` : undefined
}
