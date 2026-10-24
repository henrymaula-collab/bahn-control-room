"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MlMap, Marker, Popup } from "maplibre-gl"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { MapCar } from "@/lib/control-room/types-v3"
import { WORKER_URL, loadStyle, type MapLook } from "./map-style"
import type { Bounds } from "./regions"

/** Room around the cars, in px, for what floats over the map. */
export type Pad = { top: number; bottom: number; left: number; right: number }

/** What a red pin's card says. With a case: its one question and the way to Your tasks. Without one
 *  (the order check is red but no case exists yet): the order, one tap away. Keyed by order id. */
export type RedInfo = {
  orderId: string
  caseId?: string
  vehicle: string
  place: string
  time?: string
  now: boolean
  question?: string
  reason?: string // why it is red, when there is no case to ask ("Ferry sold out")
  mine: boolean
  owner?: string
}

interface Props {
  cars: MapCar[]
  red: Record<string, RedInfo>
  lift?: string | null // an order id hovered in the panel
  look: MapLook
  pad: Pad // room for what floats over the map
  padPhone?: Pad // under 700 px wide
  focus?: Bounds | null // fly here when it changes (the Overview's country switch)
  controls?: "top-right" | "bottom-right" | "none"
  cooperative?: boolean // the map sits in a scrolling page: two fingers or a modifier key to zoom
  minZoom?: number // never zoom out past this, even when the room beside a panel is narrow
  card: (orderId: string, close: () => void) => React.ReactNode
}

/**
 * Every car on the road today. Cars on plan are small unlabelled green dots (one map
 * layer); the agent's cars are the same green with a slow breath; cars that need a
 * person are the only labelled pins, in red. Crowded pins fold to a dot (Airbnb), the
 * person's own cases keep their label first.
 */
export function CarMap({ cars, red, lift, look, pad, padPhone, focus, controls = "top-right", cooperative, minZoom, card }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const pins = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement; width: number }>())
  const popup = useRef<Popup | null>(null)
  const [open, setOpen] = useState<{ orderId: string; el: HTMLDivElement } | null>(null)

  useEffect(() => {
    let gone = false
    let m: MlMap | null = null
    ;(async () => {
      const [ml, style] = await Promise.all([import("maplibre-gl"), loadStyle(look)])
      if (gone || !box.current) return
      if (ml.getWorkerUrl() !== WORKER_URL) ml.setWorkerUrl(WORKER_URL)
      m = new ml.Map({
        container: box.current,
        style,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        fadeDuration: 0,
        cooperativeGestures: !!cooperative,
        ...(minZoom ? { minZoom } : {}),
        bounds: focus ?? bounds(cars),
        fitBoundsOptions: { padding: padFor(box.current), maxZoom: 9 },
      })
      map.current = m
      m.touchZoomRotate.disableRotation()
      if (controls !== "none") m.addControl(new ml.NavigationControl({ showCompass: false }), controls)

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
        m.addLayer({
          id: "cars-on-plan",
          type: "circle",
          source: "cars",
          paint: {
            "circle-color": look === "dark" ? "#29af77" : "#238f62",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.8, 6, 4, 10, 5.5],
            "circle-stroke-color": look === "dark" ? "#12110e" : "#fffef7",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.2],
            "circle-opacity": 0.92,
          },
        })
        declutter()
      })

      // The agent's cars: green, breathing slowly.
      for (const c of cars.filter((x) => x.state === "agent_working")) {
        const el = document.createElement("div")
        el.className = "agent-mark"
        el.innerHTML = '<span class="dot dot-agent"></span>'
        el.setAttribute("aria-hidden", "true")
        new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m)
      }

      // The cars that need a person: labelled red pins.
      for (const c of cars.filter((x) => x.state === "needs_person")) {
        const info = red[c.orderId]
        const el = document.createElement("button")
        el.type = "button"
        // Dots only: no car names on the map (Henry, 24 Oct); the card says which car.
        el.className = "pin dot-only"
        el.dataset.order = c.orderId // night lab: shots open a pin by order id
        el.setAttribute("aria-label", `${c.vehicle}, ${c.from}, needs a person`)
        el.innerHTML = `<span class="dot dot-red"></span><span class="label"></span>`
        el.querySelector(".label")!.textContent = info?.vehicle ?? c.vehicle
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          show(c.orderId)
        })
        const marker = new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m)
        pins.current.set(c.orderId, { marker, el, width: 0 })
      }
      requestAnimationFrame(() => {
        for (const p of pins.current.values()) p.width = p.el.offsetWidth
        declutter()
      })
      m.on("moveend", declutter)
      m.on("click", () => hide())

      function show(orderId: string) {
        const p = pins.current.get(orderId)
        if (!p || !m) return
        popup.current?.remove()
        const holder = document.createElement("div")
        popup.current = new ml.Popup({ closeButton: false, className: "pin-card", offset: 20, maxWidth: "none", focusAfterOpen: false })
          .setLngLat(p.marker.getLngLat())
          .setDOMContent(holder)
          .addTo(m)
        popup.current.on("close", () => setOpen((o) => (o?.orderId === orderId ? null : o)))
        setOpen({ orderId, el: holder })
      }
    })()

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide()
    window.addEventListener("keydown", onKey)
    return () => {
      gone = true
      window.removeEventListener("keydown", onKey)
      popup.current?.remove()
      pins.current.clear()
      m?.remove()
      map.current = null
    }
    // The map is built once per data set and look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, look])

  // The latest padding, also inside the async first fit (the panel beside the map is measured after mount).
  const pads = useRef({ pad, padPhone })
  pads.current = { pad, padPhone }
  function padFor(el: HTMLElement): Pad {
    const { pad: p, padPhone: phone } = pads.current
    return el.clientWidth < 700 && phone ? phone : p
  }

  // The country switch: fly there, gently; back to every car on "All".
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const m = map.current
    if (!m || !box.current) return
    hide()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    m.fitBounds(focus ?? bounds(cars), { padding: padFor(box.current), maxZoom: 9, duration: reduce ? 0 : 900 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  function hide() {
    popup.current?.remove()
    popup.current = null
    setOpen(null)
  }

  /** Labels that would overlap fold to a red dot; the person's own and the most urgent keep theirs. */
  function declutter() {
    const m = map.current
    if (!m) return
    const order = [...pins.current.entries()].sort(([a], [b]) => {
      const ra = red[a]
      const rb = red[b]
      if (ra?.mine !== rb?.mine) return ra?.mine ? -1 : 1
      if (!!ra?.caseId !== !!rb?.caseId) return ra?.caseId ? -1 : 1
      return (ra?.time ?? "99").localeCompare(rb?.time ?? "99")
    })
    const kept: { x0: number; x1: number; y0: number; y1: number }[] = []
    for (const [, p] of order) {
      const pt = m.project(p.marker.getLngLat())
      const w = p.width || 120
      const r = { x0: pt.x - w / 2 - 6, x1: pt.x + w / 2 + 6, y0: pt.y - 17, y1: pt.y + 17 }
      const clash = kept.some((k) => r.x0 < k.x1 && r.x1 > k.x0 && r.y0 < k.y1 && r.y1 > k.y0)
      p.el.classList.toggle("compact", clash || p.el.classList.contains("dot-only"))
      // A folded pin sits under a labelled one, never on top of its words.
      p.marker.getElement().style.zIndex = p.el.classList.contains("lift") ? "5" : clash ? "1" : "3"
      if (!clash) kept.push(r)
    }
  }

  // A row hovered in the panel lifts its pin.
  useEffect(() => {
    for (const [id, p] of pins.current) {
      p.el.classList.toggle("lift", id === lift)
      p.marker.getElement().style.zIndex = id === lift ? "5" : p.el.classList.contains("compact") ? "1" : "3"
    }
  }, [lift])

  return (
    <>
      <div ref={box} className={`map map-${look}`} role="region" aria-label="Map of the cars on the road today" />
      {open && createPortal(card(open.orderId, hide), open.el)}
    </>
  )
}

function bounds(cars: MapCar[]): [[number, number], [number, number]] {
  let w = 180, s = 90, e = -180, n = -90
  for (const c of cars) {
    w = Math.min(w, c.position.lng)
    e = Math.max(e, c.position.lng)
    s = Math.min(s, c.position.lat)
    n = Math.max(n, c.position.lat)
  }
  return cars.length ? [[w, s], [e, n]] : [[5, 47], [30, 66]]
}
