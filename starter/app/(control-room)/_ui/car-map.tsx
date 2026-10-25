"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MlMap, Marker, Popup } from "maplibre-gl"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { MapCar } from "@/lib/control-room/types-v3"
import { Icon } from "./icons"
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
  reason?: string // why it is red ("Seller hold on the car", "Ferry sold out")
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
  /** The card docks in the map's bottom right corner (only a close button on it) and a click flies
   *  the map so the car sits above the card (lab map:08, Henry 25 Oct). Without it: a popup at the pin. */
  dock?: boolean
  card: (orderId: string, close: () => void) => React.ReactNode
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 3)
const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Red cars in the order a person reads them: theirs first, then cases, then by time. */
function readingOrder(cars: MapCar[], red: Record<string, RedInfo>) {
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

/**
 * Every car on the road today. Cars on plan are small green dots (one map layer); the agent's
 * cars are the same green with a slow breath; cars that need a person are red dots with a soft
 * halo, buttons that open their card. Dots only, no names on the map: hover shows a small tag.
 */
export function CarMap({ cars, red, lift, look, pad, padPhone, focus, controls = "top-right", cooperative, minZoom, dock, card }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const dockBox = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const pins = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>())
  const popup = useRef<Popup | null>(null)
  const flown = useRef(false)
  const [open, setOpen] = useState<{ orderId: string; el: HTMLDivElement | null } | null>(null)

  // The latest padding, also inside the async first fit (the panel beside the map is measured after mount).
  const pads = useRef({ pad, padPhone })
  pads.current = { pad, padPhone }
  function padFor(el: HTMLElement): Pad {
    const { pad: p, padPhone: phone } = pads.current
    return el.clientWidth < 700 && phone ? phone : p
  }

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
        // With the card docked bottom right and the Overview's bar bottom left, the credits move
        // under the zoom buttons as a closed (i) that opens them.
        attributionControl: dock ? false : { compact: true },
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
      if (dock) {
        m.addControl(new ml.AttributionControl({ compact: true }), "top-right")
        // MapLibre opens compact credits until the first drag; keep them closed, the (i) opens them.
        const fold = () => box.current?.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show")?.classList.remove("maplibregl-compact-show")
        m.once("load", fold)
        m.once("idle", fold)
      }

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
      })

      // The agent's cars: green, breathing slowly.
      for (const c of cars.filter((x) => x.state === "agent_working")) {
        const el = document.createElement("div")
        el.className = "agent-mark"
        el.innerHTML = '<span class="dot dot-agent"></span>'
        el.setAttribute("aria-hidden", "true")
        new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m)
      }

      // The cars that need a person: red dots with a halo (lab map:08), buttons. Added last-first, so
      // where several share one spot (Helsinki holds seven at this zoom) the one a person reads
      // first, theirs and the most urgent, is on top and is the one a click opens.
      const order = readingOrder(cars, red)
      order.map((c, i) => [c, i] as const).reverse().forEach(([c, i]) => {
        const info = red[c.orderId]
        const el = document.createElement("button")
        el.type = "button"
        el.className = `pin rd${info?.now ? " now" : ""}`
        el.dataset.order = c.orderId
        el.style.setProperty("--i", String(i))
        el.setAttribute("aria-label", `${info?.vehicle ?? c.vehicle}, ${info?.place ?? c.from}, needs a person`)
        el.innerHTML = '<span class="rd-halo"></span><span class="rd-dot"></span><span class="rd-tag"><span class="rd-v"></span><span class="rd-t"></span></span>'
        el.querySelector(".rd-v")!.textContent = info?.vehicle ?? c.vehicle
        const t = el.querySelector(".rd-t")!
        if (info?.time) t.textContent = info.time
        else t.remove()
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          show(c.orderId)
        })
        const marker = new ml.Marker({ element: el }).setLngLat([c.position.lng, c.position.lat]).addTo(m!)
        marker.getElement().style.zIndex = zOf(c.orderId)
        pins.current.set(c.orderId, { marker, el })
      })
      m.on("click", () => hide())

      function show(orderId: string) {
        const p = pins.current.get(orderId)
        if (!p || !m) return
        for (const [id, x] of pins.current) {
          x.el.classList.toggle("on", id === orderId)
          x.marker.getElement().style.zIndex = id === orderId ? "7" : zOf(id)
        }
        popup.current?.remove()
        popup.current = null
        if (dock) {
          setOpen({ orderId, el: null })
          // Fly once the card is on screen, so its real size decides where the car may sit.
          requestAnimationFrame(() => requestAnimationFrame(() => flyTo(orderId)))
          return
        }
        const holder = document.createElement("div")
        popup.current = new ml.Popup({ closeButton: false, className: "pin-card", offset: 20, maxWidth: "none", focusAfterOpen: false })
          .setLngLat(p.marker.getLngLat())
          .setDOMContent(holder)
          .addTo(m)
        popup.current.on("close", () => {
          pins.current.get(orderId)?.el.classList.remove("on")
          setOpen((o) => (o?.orderId === orderId ? null : o))
        })
        setOpen({ orderId, el: holder })
      }
      showRef.current = show
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

  const showRef = useRef<((orderId: string) => void) | null>(null)

  const liveLift = useRef(lift)
  liveLift.current = lift
  function zOf(id: string) {
    const info = red[id]
    return id === liveLift.current ? "6" : info?.mine ? "4" : info?.caseId ? "3" : "2"
  }

  /** The right edge (px from the map's left) of what floats over the map's left side: the welcome panel. */
  function panelRight(b: DOMRect): number {
    let right = 0
    for (const el of Array.from(box.current?.parentElement?.children ?? [])) {
      if (el === box.current || el === dockBox.current) continue
      const r = el.getBoundingClientRect()
      if (r.width > 40 && r.left < b.left + 200 && r.top < b.top + b.height / 2 && r.right < b.right - 120) right = Math.max(right, r.right - b.left)
    }
    return right
  }

  /** Apple Maps moves the camera to a selected place: the car lands in the open map above the
   *  docked card and right of the panel, never under either (Henry: "the selected car is always
   *  visible above the card, and the card always sits in the same corner"). */
  function flyTo(orderId: string) {
    const m = map.current
    const p = pins.current.get(orderId)
    const el = box.current
    if (!m || !p || !el) return
    const b = el.getBoundingClientRect()
    const W = b.width
    const H = b.height
    const d = dockBox.current?.getBoundingClientRect()
    const dockLeft = d ? d.left - b.left : W - Math.min(380, W * 0.3) - 16
    const dockTop = d ? d.top - b.top : H * 0.55
    const room = padFor(el)
    // Between the panel and the card's left edge when there is room (combination B), never under
    // the panel; the height keeps it above the card's top edge, so it is free of both.
    const lo = Math.max(24, panelRight(b) + 28)
    const x = Math.min(W - 60, Math.max(lo + 48, (Math.max(lo, room.left) + dockLeft - 24) / 2))
    const y = Math.max(Math.min(room.top, dockTop / 2), Math.min(H * 0.42, dockTop - 44))
    flown.current = true
    m.easeTo({
      center: p.marker.getLngLat(),
      zoom: Math.max(m.getZoom(), 5.4),
      offset: [x - W / 2, y - H / 2],
      duration: reduce() ? 0 : 800,
      easing: EASE,
    })
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
    m.fitBounds(focus ?? bounds(cars), { padding: padFor(box.current), maxZoom: 9, duration: reduce() ? 0 : 900 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  function hide() {
    popup.current?.remove()
    popup.current = null
    for (const [id, x] of pins.current) {
      x.el.classList.remove("on")
      x.marker.getElement().style.zIndex = zOf(id)
    }
    setOpen(null)
    // A closed card flies the map back to the whole frame.
    const m = map.current
    if (flown.current && m && box.current) {
      flown.current = false
      m.fitBounds(focus ?? bounds(cars), { padding: padFor(box.current), maxZoom: 9, duration: reduce() ? 0 : 700, easing: EASE })
    }
  }

  // A row hovered in the panel lifts its pin and shows its tag.
  useEffect(() => {
    for (const [id, x] of pins.current) {
      x.el.classList.toggle("lift", id === lift)
      if (!x.el.classList.contains("on")) x.marker.getElement().style.zIndex = zOf(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift, red])

  return (
    <>
      <div ref={box} className={`map map-${look}`} role="region" aria-label="Map of the cars on the road today" />
      {open && open.el && createPortal(card(open.orderId, hide), open.el)}
      {open && !open.el && (
        <div ref={dockBox} className="map-dock" role="dialog" aria-label="The car that needs a person">
          <button type="button" className="map-dock-x" onClick={hide} aria-label="Close" aria-keyshortcuts="Escape">
            <Icon name="x" size={20} />
          </button>
          {card(open.orderId, hide)}
        </div>
      )}
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
