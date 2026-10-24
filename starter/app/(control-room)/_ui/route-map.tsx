"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import type { Map as MlMap } from "maplibre-gl"
import { useEffect, useRef } from "react"
import type { LatLng } from "@/lib/control-room/types-v3"
import { WORKER_URL, loadStyle } from "./map-style"

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
        fitBoundsOptions: { padding: 44, maxZoom: 12 },
      })
      m.on("load", () => {
        if (!m) return
        // Only the city is named here; the attribution folds to its (i) button.
        for (const id of ["label_town", "label_village"]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none")
        box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show")
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
      for (const [at, letter, colour] of [
        [a, "A", "#fd6a31"],
        [b, "B", "#12110e"],
      ] as const) {
        const el = document.createElement("div")
        el.className = "route-pin"
        el.style.background = colour
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

  return <div ref={box} className="route-map" role="img" aria-label="Route from the pickup place (A) to the delivery (B)" />
}
