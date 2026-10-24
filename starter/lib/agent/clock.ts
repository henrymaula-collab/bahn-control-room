// The world clock for the agent. The dataset is one fixed snapshot
// ("There is no live clock", OPERATIONS-CONTEXT.md), so "now" starts at the
// snapshot time unless CR_NOW says otherwise. Each run advances its own
// simulated minutes so facts and call turns get believable times.

import fs from "node:fs"
import path from "node:path"
import { paths } from "./config"

let snapshotCache: string | undefined

export function snapshotAt(): string {
  if (snapshotCache) return snapshotCache
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(paths.dataset(), "manifest.json"), "utf8")) as { snapshot_at?: string }
    snapshotCache = manifest.snapshot_at ?? "2026-10-21T09:00:00Z"
  } catch {
    snapshotCache = "2026-10-21T09:00:00Z"
  }
  return snapshotCache
}

/** Base time for a new run: CR_NOW, else the dataset snapshot (CR_CLOCK=real uses the wall clock, as the foundation does). */
export function worldNow(): Date {
  if (process.env.CR_CLOCK === "real") return new Date()
  const env = process.env.CR_NOW?.trim()
  const base = env ? new Date(env) : new Date(snapshotAt())
  return Number.isNaN(base.getTime()) ? new Date(snapshotAt()) : base
}

/** A per-run clock: every action moves it forward by a realistic amount. */
export class RunClock {
  private t: number
  constructor(start: Date = worldNow()) {
    this.t = start.getTime()
  }
  now(): string {
    return new Date(this.t).toISOString()
  }
  advance(seconds: number): string {
    this.t += Math.round(seconds * 1000)
    return this.now()
  }
  date(): Date {
    return new Date(this.t)
  }
}

export function fmtLocal(iso: string, timeZone: string, withWeekday = true): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: withWeekday ? "short" : undefined, day: "numeric", month: "short" }).format(d)
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return `${day} ${time}`
}

export function fmtRange(startIso: string, endIso: string, timeZone: string): string {
  const startDay = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(new Date(startIso))
  const endDay = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(new Date(endIso))
  const t = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
  return startDay === endDay ? `${startDay} ${t(startIso)} to ${t(endIso)}` : `${startDay} ${t(startIso)} to ${endDay} ${t(endIso)}`
}

export function hoursBetween(fromIso: string, toIso: string): number {
  return Math.round(((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 3_600_000) * 10) / 10
}

export function dayLabel(iso: string, timeZone = "Europe/Helsinki"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(new Date(iso))
}
