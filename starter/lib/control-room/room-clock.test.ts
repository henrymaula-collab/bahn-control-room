import assert from "node:assert/strict"
import test from "node:test"
import { roomStart, roomTime } from "./room-clock"

const SNAPSHOT = "2026-10-21T09:00:00.000Z" // Wed 21 Oct 12:00 Helsinki

test("the room starts at 12:01, or just after the agent's latest ping", () => {
  assert.equal(roomStart(SNAPSHOT), "2026-10-21T09:01:00.000Z")
  assert.equal(roomStart(SNAPSHOT, ["2026-10-21T08:26:00.000Z", "2026-10-21T09:01:56.231Z"]), "2026-10-21T09:01:56.231Z")
  assert.equal(roomStart(SNAPSHOT, ["not a time"]), "2026-10-21T09:01:00.000Z")
})

test("room time runs from the start by the wall time since the last reset", () => {
  const start = "2026-10-21T09:01:00.000Z"
  const reset = "2026-10-25T13:40:00.000Z" // an afternoon demo: the wall clock is far past the room's day
  assert.equal(roomTime(start, null), start)
  assert.equal(roomTime(start, reset, Date.parse(reset) + 5 * 60_000), "2026-10-21T09:06:00.000Z")
  assert.equal(roomTime(start, reset, Date.parse(reset) - 60_000), start) // never before the start
})
