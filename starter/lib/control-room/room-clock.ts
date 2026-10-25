// The room clock (track K, 25 Oct). The room is one fixed day (the dataset snapshot, Wed 21 Oct 2026
// 12:00 Helsinki), but a demo runs in real time. So everything that happens live is stamped with room
// time: the room's start time plus the wall time since the last demo reset. The start is 12:01, or
// just after the agent's latest ping on the demo cases, so Now is never before the agent's 12:01.
//
// The reset moment lives in cr_room_clock, one row, written by demoReset() (npm run demo:reset and
// POST /api/cr/demo-reset) and created if missing. With no reset recorded, the room stays at its start.
// CR_CLOCK=real keeps the wall clock, as world.ts worldNow does.

import { sql } from "drizzle-orm"
import { crDb } from "./db"

const MINUTE = 60_000

/** 12:01 on the room's day, or the latest agent ping when that is later. */
export function roomStart(snapshotAt: string, pings: string[] = []): string {
  const floor = Date.parse(snapshotAt) + MINUTE
  const latest = Math.max(floor, ...pings.map((at) => Date.parse(at)).filter((t) => !Number.isNaN(t)))
  return new Date(latest).toISOString()
}

/** Room time = the room's start + (wall time - the moment of the last reset). Never before the start. */
export function roomTime(start: string, resetAt: string | null, wall = Date.now()): string {
  if (!resetAt) return start
  return new Date(Date.parse(start) + Math.max(0, wall - Date.parse(resetAt))).toISOString()
}

async function ensureTable() {
  await crDb.execute(sql`CREATE TABLE IF NOT EXISTS cr_room_clock (
    id integer PRIMARY KEY,
    reset_at timestamptz NOT NULL,
    room_start timestamptz NOT NULL
  )`)
}

/** demoReset(): the room starts again at `start`, from this wall moment. */
export async function recordReset(start: string, at = new Date()): Promise<void> {
  await ensureTable()
  await crDb.execute(sql`INSERT INTO cr_room_clock (id, reset_at, room_start) VALUES (1, ${at.toISOString()}, ${start})
    ON CONFLICT (id) DO UPDATE SET reset_at = EXCLUDED.reset_at, room_start = EXCLUDED.room_start`)
}

async function lastReset(): Promise<{ resetAt: string; start: string } | null> {
  try {
    const rows = (await crDb.execute(sql`SELECT reset_at, room_start FROM cr_room_clock WHERE id = 1`)) as unknown as { reset_at: string | Date; room_start: string | Date }[]
    const row = rows[0]
    return row ? { resetAt: new Date(row.reset_at).toISOString(), start: new Date(row.room_start).toISOString() } : null
  } catch {
    // No table yet (no reset since this code): the room stays at its start.
    return null
  }
}

/** Now on the room's clock. `snapshotAt` is the dataset's (world.snapshotAt); without it, Wed 21 Oct 12:00. */
export async function roomNow(snapshotAt = "2026-10-21T09:00:00.000Z"): Promise<string> {
  if (process.env.CR_CLOCK === "real") return new Date().toISOString()
  const reset = await lastReset()
  return reset ? roomTime(reset.start, reset.resetAt) : roomStart(snapshotAt)
}
