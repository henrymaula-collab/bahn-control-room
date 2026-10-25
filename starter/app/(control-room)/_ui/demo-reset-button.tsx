"use client"

import { useState } from "react"

/** Puts the demo back to its first frame (Aino, three cars, Kaisa's rule waiting) between recording takes. */
export function DemoResetButton() {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle")
  const [error, setError] = useState("")

  async function reset() {
    setState("busy")
    setError("")
    const res = await fetch("/api/cr/demo-reset", { method: "POST" }).catch(() => null)
    if (!res?.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {}
      setError(body.error ?? "The server did not answer.")
      setState("failed")
      return
    }
    window.location.href = "/"
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 16 }}>
      <button type="button" className="btn btn-primary" onClick={reset} disabled={state === "busy"}>
        {state === "busy" ? "Resetting the demo…" : "Reset the demo"}
      </button>
      <p className="s">{state === "failed" ? error : "Back to Aino with three cars. Takes about half a minute."}</p>
    </div>
  )
}
