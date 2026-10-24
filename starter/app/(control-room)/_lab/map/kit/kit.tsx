"use client"

// Map slot kit: one CarMap with options, the same props as today's (_ui/car-map.tsx), so every
// variant is an options object, its CSS and its card. What stays as today: the data, the Northern
// Europe frame, the padding beside the welcome panel, dots only, the lift from a hovered row, the
// card through `card(orderId, close)`, Escape, a click on the map closes the card.
// Every red pin is still `button.pin[data-order]` (the shot pipeline clicks the Ferrari by it), and
// the map box keeps `data-lab-map` (the pipeline waits for it to paint).

import "maplibre-gl/dist/maplibre-gl.css"
import "./kit.css"
import type { Map as MlMap, Marker, Popup } from "maplibre-gl"
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import { createPortal } from "react-dom"
import type { MapCar } from "@/lib/control-room/types-v3"
import { CarMap, type Pad, type RedInfo } from "../../../_ui/car-map"
import { WORKER_URL } from "../../../_ui/map-style"
import { Icon } from "../../../_ui/icons"
import { kitStyle, type KitLook } from "./style"

export type CarMapProps = ComponentProps<typeof CarMap>

export type KitOpts = {
  root: string // the variant's root class, "lab-map-01"
  look?: KitLook // force a base map; default: the page's (?map=)
  green?: { color?: string; stroke?: string; radius?: [number, number, number]; opacity?: number }
  agent?: "breathe" | "turns" // turns: one agent car pings at a time, in turn
  tag?: boolean // hover or focus a red dot: a small tag with the car and its time
  card?: "popup" | "dock" // dock: the card sits bottom right of the map, with previous/next
  fly?: boolean // a click flies to the car; closing flies back to the frame
  intro?: boolean // the arrival: camera settles, green fades in, then the agent's cars, then red
  legend?: boolean // the key as three switches on the map
  fade?: boolean // the map fades out under the welcome panel
  controls?: "top-right" | "bottom-right" | "none"
  popupOffset?: number
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 3)
const n = (x: number) => new Intl.NumberFormat("en-GB").format(x)

/** Red cars in the order a person reads them: theirs first, then cases, then by time. */
function sortRed(cars: MapCar[], red: Record<string, RedInfo>) {
  return cars
    .filter((c) => c.state === "needs_person")
    .sort((a, b) => {
      const ra = red[a.orderId]
      const rb = red[b.orderId]
      if (!!ra?.mine !== !!rb?.mine) return ra?.mine ? -1 : 1
      if (!!ra?.caseId !== !!rb?.caseId) return ra?.caseId ? -1 : 1
      return (ra?.time ?? "99").localeCompare(rb?.time ?? "99")
    })
}

export function KitMap({ opts, ...p }: CarMapProps & { opts: KitOpts }) {
  const { cars, red, lift, pad, padPhone, focus, cooperative, minZoom, card } = p
  const look: KitLook = opts.look ?? p.look
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const pins = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>())
  const popup = useRef<Popup | null>(null)
  const flown = useRef(false)
  const [open, setOpen] = useState<{ orderId: string; el: HTMLDivElement | null } | null>(null)
  const [off, setOff] = useState({ green: false, agent: false, red: false })
  const order = useMemo(() => sortRed(cars, red), [cars, red])
  const counts = useMemo(() => {
    const needsPerson = cars.filter((c) => c.state === "needs_person").length
    const agentWorking = cars.filter((c) => c.state === "agent_working").length
    return { onPlan: cars.length - needsPerson - agentWorking, agentWorking, needsPerson }
  }, [cars])

  // The latest padding and order, also inside the async build and the listeners.
  const live = useRef({ pad, padPhone, order })
  live.current = { pad, padPhone, order }
  function padFor(el: HTMLElement): Pad {
    const { pad: pd, padPhone: phone } = live.current
    const out = el.clientWidth < 700 && phone ? phone : pd
    // The key on the map sits along the bottom: keep the cars clear of it.
    return opts.legend ? { ...out, bottom: out.bottom + 28 } : out
  }

  /** The right edge (px, viewport) of whatever floats over the map's left side: the welcome panel. */
  function panelRight(b: DOMRect): number {
    let right = b.left
    for (const el of Array.from(box.current?.parentElement?.children ?? [])) {
      if (el === box.current || el.classList.contains("lab-map-kit")) continue
      const r = el.getBoundingClientRect()
      if (r.width > 40 && r.left < b.left + 200 && r.top < b.top + b.height / 2 && r.right < b.right - 120) right = Math.max(right, r.right)
    }
    return right
  }

  /** Apple Maps keeps a selected place's card in view: the card gets the room beside the panel
   *  (narrower when it must) and the map pans just enough for it to sit there whole. */
  function roomForCard() {
    const m = map.current
    const holder = popup.current?.getElement()
    if (!m || !holder || !box.current) return
    const b = box.current.getBoundingClientRect()
    const minLeft = Math.max(b.left + 12, panelRight(b) + 14)
    const maxRight = b.right - 12
    box.current.style.setProperty("--lk-card-w", `${Math.round(Math.max(250, Math.min(320, maxRight - minLeft)))}px`)
    requestAnimationFrame(() => {
      const r = holder.getBoundingClientRect()
      const dx = r.left < minLeft ? minLeft - r.left : r.right > maxRight ? maxRight - r.right : 0
      const dy = r.top < b.top + 12 ? b.top + 12 - r.top : r.bottom > b.bottom - 12 ? b.bottom - 12 - r.bottom : 0
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) m.panBy([-dx, -dy], { duration: reduce() ? 0 : 280, easing: EASE })
    })
  }
  const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(() => {
    let gone = false
    let m: MlMap | null = null
    let turns: number | undefined
    ;(async () => {
      const [ml, style] = await Promise.all([import("maplibre-gl"), kitStyle(look)])
      if (gone || !box.current) return
      if (ml.getWorkerUrl() !== WORKER_URL) ml.setWorkerUrl(WORKER_URL)
      const frame = focus ?? bounds(cars)
      const still = reduce()
      const intro = !!opts.intro && !still
      m = new ml.Map({
        container: box.current,
        style,
        attributionControl: opts.legend || opts.card === "dock" ? false : { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        fadeDuration: 0,
        cooperativeGestures: !!cooperative,
        ...(minZoom ? { minZoom } : {}),
        bounds: frame,
        fitBoundsOptions: { padding: padFor(box.current), maxZoom: 9 },
      })
      map.current = m
      m.touchZoomRotate.disableRotation()
      const ctl = opts.controls ?? p.controls ?? "top-right"
      if (ctl !== "none") m.addControl(new ml.NavigationControl({ showCompass: false }), ctl)
      if (opts.legend || opts.card === "dock") m.addControl(new ml.AttributionControl({ compact: true }), "bottom-left")
      // The arrival starts a little wider and settles on the frame once the map has loaded. Until
      // then the marks wait (lk-wait: hidden, no animation), so the agent's cars and the red dots
      // arrive on a painted map in step with the camera, not on blank paper while tiles still load.
      if (intro) m.jumpTo({ zoom: Math.max(minZoom ?? 0, m.getZoom() - 0.55) })
      if (intro) box.current?.classList.add("lk-wait")

      const dark = look === "dark"
      const g = opts.green ?? {}
      const gOpacity = g.opacity ?? 0.92
      m.on("load", () => {
        if (!m) return
        m.addSource("cars", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: cars
              .filter((c) => c.state === "on_plan")
              .map((c) => ({ type: "Feature", properties: { id: c.orderId }, geometry: { type: "Point", coordinates: [c.position.lng, c.position.lat] } })),
          },
        })
        const [r3, r6, r10] = g.radius ?? [2.8, 4, 5.5]
        m.addLayer({
          id: "cars-on-plan",
          type: "circle",
          source: "cars",
          paint: {
            "circle-color": g.color ?? (dark ? "#29af77" : "#238f62"),
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, r3, 6, r6, 10, r10],
            "circle-stroke-color": g.stroke ?? (dark ? "#12110e" : "#fffef7"),
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.2],
            "circle-opacity": intro ? 0 : gOpacity,
            "circle-stroke-opacity": intro ? 0 : 1,
            "circle-opacity-transition": { duration: 900, delay: 200 },
            "circle-stroke-opacity-transition": { duration: 900, delay: 200 },
          },
        })
        if (intro) {
          requestAnimationFrame(() => {
            m?.setPaintProperty("cars-on-plan", "circle-opacity", gOpacity)
            m?.setPaintProperty("cars-on-plan", "circle-stroke-opacity", 1)
            box.current?.classList.remove("lk-wait")
          })
          m.fitBounds(frame, { padding: padFor(box.current!), maxZoom: 9, duration: 1700, easing: EASE })
        }
      })

      // The agent's cars: DOM marks, so CSS can breathe or take turns.
      const agentEls: HTMLElement[] = []
      cars
        .filter((x) => x.state === "agent_working")
        .forEach((c, i) => {
          const el = document.createElement("div")
          el.className = "agent-mark lk-agent"
          el.style.setProperty("--i", String(i))
          el.innerHTML = '<span class="lk-a"></span>'
          el.setAttribute("aria-hidden", "true")
          new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m!)
          agentEls.push(el)
        })
      if (opts.agent === "turns" && agentEls.length && !still) {
        let k = 0
        const step = () => {
          const el = agentEls[k % agentEls.length]
          el.classList.remove("ping")
          void el.offsetWidth // restart the animation
          el.classList.add("ping")
          k += 1
        }
        step()
        turns = window.setInterval(step, 1100)
      }

      // The cars that need a person: red dots, buttons. Added last-first, so where several share one
      // spot (Helsinki holds seven at this zoom, Aino's BMW M4 and Volvo V60 among them) the one a
      // person reads first, theirs and the most urgent, is on top and is the one a click opens.
      const reading = live.current.order.map((c, i) => [c, i] as const)
      reading.reverse().forEach(([c, i]) => {
        const info = red[c.orderId]
        const el = document.createElement("button")
        el.type = "button"
        el.className = `pin lp${info?.mine ? " mine" : ""}${info?.caseId ? " case" : ""}${info?.now ? " now" : ""}`
        el.dataset.order = c.orderId
        el.style.setProperty("--i", String(i))
        el.setAttribute("aria-label", `${info?.vehicle ?? c.vehicle}, ${info?.place ?? c.from}, needs a person`)
        el.innerHTML = '<span class="lp-halo"></span><span class="lp-dot"></span>' + (opts.tag ? '<span class="lp-tag"><span class="lp-v"></span><span class="lp-t"></span></span>' : "")
        if (opts.tag) {
          el.querySelector(".lp-v")!.textContent = info?.vehicle ?? c.vehicle
          const t = el.querySelector(".lp-t")!
          if (info?.time) t.textContent = info.time
          else t.remove()
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          show(c.orderId)
        })
        const marker = new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m!)
        marker.getElement().style.zIndex = info?.mine ? "4" : info?.caseId ? "3" : "2"
        pins.current.set(c.orderId, { marker, el })
      })
      m.on("click", () => hide())

      function show(orderId: string) {
        const pin = pins.current.get(orderId)
        if (!pin || !m || !box.current) return
        for (const [id, x] of pins.current) x.el.classList.toggle("on", id === orderId)
        if (opts.fly) {
          const W = box.current.clientWidth
          const H = box.current.clientHeight
          const room = padFor(box.current)
          const dock = opts.card === "dock" ? Math.min(380, W * 0.3) : 0
          const tx = (room.left + (W - dock - 24)) / 2
          const ty = H * 0.42
          flown.current = true
          m.easeTo({ center: pin.marker.getLngLat(), zoom: Math.max(m.getZoom(), 5.4), offset: [tx - W / 2, ty - H / 2], duration: reduce() ? 0 : 800, easing: EASE })
        }
        if (opts.card === "dock") {
          popup.current?.remove()
          popup.current = null
          setOpen({ orderId, el: null })
          return
        }
        popup.current?.remove()
        const holder = document.createElement("div")
        popup.current = new ml.Popup({ closeButton: false, className: `pin-card lk-card`, offset: opts.popupOffset ?? 22, maxWidth: "none", focusAfterOpen: false })
          .setLngLat(pin.marker.getLngLat())
          .setDOMContent(holder)
          .addTo(m)
        popup.current.on("close", () => {
          pins.current.get(orderId)?.el.classList.remove("on")
          setOpen((o) => (o?.orderId === orderId ? null : o))
        })
        setOpen({ orderId, el: holder })
        requestAnimationFrame(() => requestAnimationFrame(roomForCard))
      }
      showRef.current = show
    })()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide()
      const o = openRef.current
      if (o && opts.card === "dock" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const list = live.current.order
        const i = list.findIndex((c) => c.orderId === o)
        const next = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]
        if (next) {
          e.preventDefault()
          showRef.current?.(next.orderId)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      gone = true
      window.clearInterval(turns)
      window.removeEventListener("keydown", onKey)
      popup.current?.remove()
      pins.current.clear()
      m?.remove()
      map.current = null
    }
    // Built once per data set and look, like today's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, look])

  const showRef = useRef<((orderId: string) => void) | null>(null)
  const openRef = useRef<string | null>(null)
  openRef.current = open?.orderId ?? null

  function hide() {
    popup.current?.remove()
    popup.current = null
    for (const x of pins.current.values()) x.el.classList.remove("on")
    setOpen(null)
    const m = map.current
    if (flown.current && m && box.current) {
      flown.current = false
      m.fitBounds(focus ?? bounds(cars), { padding: padFor(box.current), maxZoom: 9, duration: reduce() ? 0 : 700, easing: EASE })
    }
  }

  // The country switch (a welcome variant may pass focus): fly there, as today.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const m = map.current
    if (!m || !box.current) return
    hide()
    m.fitBounds(focus ?? bounds(cars), { padding: padFor(box.current), maxZoom: 9, duration: reduce() ? 0 : 900 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // A row hovered in the welcome panel lifts its pin.
  useEffect(() => {
    for (const [id, x] of pins.current) {
      x.el.classList.toggle("lift", id === lift)
      const info = red[id]
      x.marker.getElement().style.zIndex = id === lift ? "6" : info?.mine ? "4" : info?.caseId ? "3" : "2"
    }
  }, [lift, red])

  // The key's switches: green is a map layer, the rest are marks.
  // Classes go on imperatively: MapLibre adds its own to the box, and a React className change would wipe them.
  useEffect(() => {
    const m = map.current
    if (m?.getLayer("cars-on-plan")) m.setLayoutProperty("cars-on-plan", "visibility", off.green ? "none" : "visible")
    box.current?.classList.toggle("lk-no-agent", off.agent)
    box.current?.classList.toggle("lk-no-red", off.red)
  }, [off])

  const at = open ? order.findIndex((c) => c.orderId === open.orderId) : -1
  const step = (d: number) => {
    if (at < 0) return
    const next = order[(at + d + order.length) % order.length]
    if (next) showRef.current?.(next.orderId)
  }
  const roomLeft = pad.left

  return (
    <>
      <div
        ref={box}
        className={`map map-${look === "paper" ? "bahn" : look} lab-map-kit ${opts.root}`}
        data-lab-map=""
        role="region"
        aria-label="Map of the cars on the road today"
      />
      {opts.fade && <div className={`lab-map-kit ${opts.root} lk-fade`} style={{ ["--lk-room" as string]: `${roomLeft}px` }} aria-hidden="true" />}
      {opts.legend && (
        <div className={`lab-map-kit ${opts.root} lk-legend`} role="group" aria-label="The map's colours: switch each on or off">
          <Switch on={!off.green} onClick={() => setOff((o) => ({ ...o, green: !o.green }))} dot="lk-sw-green" label="On plan" count={counts.onPlan} />
          <Switch on={!off.agent} onClick={() => setOff((o) => ({ ...o, agent: !o.agent }))} dot="lk-sw-agent" label="Agent working" count={counts.agentWorking} />
          <Switch on={!off.red} onClick={() => setOff((o) => ({ ...o, red: !o.red }))} dot="lk-sw-red" label="Needs a person" count={counts.needsPerson} />
        </div>
      )}
      {open && open.el && createPortal(card(open.orderId, hide), open.el)}
      {open && !open.el && opts.card === "dock" && (
        <div className={`lab-map-kit ${opts.root} lk-dock`} role="dialog" aria-label="The car that needs a person">
          <div className="lk-dock-bar">
            <span className="lk-dock-at num">
              {at + 1} of {order.length}
            </span>
            <span className="lk-dock-nav">
              <button type="button" onClick={() => step(-1)} aria-label="Previous car that needs a person" aria-keyshortcuts="ArrowLeft">
                <Icon name="chevron-left" size={18} />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next car that needs a person" aria-keyshortcuts="ArrowRight">
                <Icon name="chevron-right" size={18} />
              </button>
              <button type="button" onClick={hide} aria-label="Close" aria-keyshortcuts="Escape">
                <Icon name="x" size={18} />
              </button>
            </span>
          </div>
          {card(open.orderId, hide)}
        </div>
      )}
    </>
  )
}

function Switch({ on, onClick, dot, label, count }: { on: boolean; onClick: () => void; dot: string; label: string; count: number }) {
  return (
    <button type="button" className="lk-sw" aria-pressed={on} onClick={onClick}>
      <span className={`lk-sw-dot ${dot}`} />
      <span className="lk-sw-l">{label}</span>
      <span className="lk-sw-n num">{n(count)}</span>
    </button>
  )
}

function bounds(cars: MapCar[]): [[number, number], [number, number]] {
  let w = 180, s = 90, e = -180, nn = -90
  for (const c of cars) {
    w = Math.min(w, c.position.lng)
    e = Math.max(e, c.position.lng)
    s = Math.min(s, c.position.lat)
    nn = Math.max(nn, c.position.lat)
  }
  return cars.length ? [[w, s], [e, nn]] : [[5, 47], [30, 66]]
}
