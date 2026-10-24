"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MlMap } from "maplibre-gl"
import { useEffect, useRef } from "react"
import type { LatLng } from "@/lib/control-room/types-v3"
import { WORKER_URL, loadStyle } from "../../../_ui/map-style"

/** Today's RouteMap (_ui/route-map.tsx) with only the map fix (reviewer RV5): the three lines marked
 *  "Fix" below. Everything else is today's, byte for byte. Adopt by applying route-map.patch. */
/** Pickup (orange A) and delivery (black B), joined the way Bahn's portal draws a route: orange fading to black. */
export function RouteMap({ from, to }: { from: LatLng; to: LatLng }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let gone = false
    let m: MlMap | null = null
    ;(async () => {
      const [ml, style] = await Promise.all([import("maplibre-gl"), loadStyle("bahn")])
      if (gone || !box.current) return
      if (ml.getWorkerUrl() !== WORKER_URL) ml.setWorkerUrl(WORKER_URL)
      const a: [number, number] = [from.lng, from.lat]
      const b: [number, number] = [to.lng, to.lat]
      m = new ml.Map({
        container: box.current,
        style,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
        bounds: [
          [Math.min(a[0], b[0]), Math.min(a[1], b[1])],
          [Math.max(a[0], b[0]), Math.max(a[1], b[1])],
        ],
        // Fix 1: zoom in further, so two ends 0.4 km apart (the Ferrari, Hamburg) are two pins, not one blot.
        fitBoundsOptions: { padding: 44, maxZoom: 14 },
      })
      m.on("load", () => {
        if (!m) return
        // Only the city is named here; the attribution folds to its (i) button.
        for (const id of ["label_town", "label_village"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none")
        box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show")
        // Fix 2: a city name may step to another side of its point instead of under a pin.
        for (const id of ["label_city", "label_city_all", "label_city_capital", "label_city_capital_all"]) {
          if (!m.getLayer(id)) continue
          m.setLayoutProperty(id, "text-variable-anchor", ["bottom", "top", "right", "left"])
          m.setLayoutProperty(id, "text-radial-offset", 1.5)
        }
        // Fix 3: an invisible symbol at each pin, at the (i) corner and along the edges, placed before
        // the names, so "Helsinki" steps off the A ("H(A)nki"), never under the (i), never half off the map.
        const w = box.current!.clientWidth
        const h = box.current!.clientHeight
        const px: [number, number][] = [[w - 22, h - 22]]
        for (let x = 0; x <= w; x += 20) px.push([x, 2], [x, h - 2])
        for (let y = 0; y <= h; y += 20) px.push([2, y], [w - 2, y])
        const keep = [a, b, ...px.map((p) => m!.unproject(p).toArray())]
        m.addSource("pins-keepout", { type: "geojson", data: { type: "FeatureCollection", features: keep.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } })) } })
        m.addLayer({
          id: "pins-keepout",
          type: "symbol",
          source: "pins-keepout",
          layout: { "text-field": "AA", "text-font": ["Noto Sans Regular"], "text-size": 16, "text-padding": 6, "text-allow-overlap": true, "text-ignore-placement": false },
          paint: { "text-opacity": 0 },
        })
        m.addSource("route", { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [a, b] } } })
        // Under the labels, so a city name stays readable where the route crosses it.
        const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id
        m.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round" },
          paint: {
            "line-width": 3,
            "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#fd6a31", 0.45, "#fd6a31", 0.55, "#12110e", 1, "#12110e"],
          },
        }, firstLabel)
      })
      // The pickup letter in ink on Bahn's orange (6.55:1); birch on orange was 2.85:1.
      for (const [at, letter, colour, ink] of [
        [a, "A", "#fd6a31", "#12110e"],
        [b, "B", "#12110e", "#fffef7"],
      ] as const) {
        const el = document.createElement("div")
        el.className = "route-pin"
        el.style.background = colour
        el.style.color = ink
        el.textContent = letter
        el.setAttribute("aria-hidden", "true")
        new ml.Marker({ element: el }).setLngLat(at as [number, number]).addTo(m)
      }
    })()
    return () => {
      gone = true
      m?.remove()
    }
  }, [from.lat, from.lng, to.lat, to.lng])

  return <div ref={box} className="route-map" data-lab-map="" role="img" aria-label="Route from the pickup place (A) to the delivery (B)" />
}
