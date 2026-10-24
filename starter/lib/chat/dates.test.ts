// The chat dates a live decision on the room's day, as History does (words.ts shownAt).

import assert from "node:assert/strict"
import test from "node:test"
import { ROOM_NOW } from "@/lib/control-room/fixtures/clock"
import { day, shownAt } from "./words"

test("a decision made after the room's clock is dated on the room's day, at its own time", () => {
  const live = "2026-10-24T18:57:22.020Z" // Sat 24 Oct 21:57 Helsinki, wall clock
  assert.equal(shownAt(live, ROOM_NOW), "2026-10-21T18:57:00.000Z")
  assert.equal(day(shownAt(live, ROOM_NOW)), "Wed 21 Oct")
  assert.equal(shownAt(shownAt(live, ROOM_NOW), ROOM_NOW), "2026-10-21T18:57:00.000Z")
})

test("earlier decisions keep their date", () => {
  assert.equal(shownAt("2026-10-14T10:11:00.000Z", ROOM_NOW), "2026-10-14T10:11:00.000Z")
  assert.equal(shownAt(ROOM_NOW, ROOM_NOW), ROOM_NOW)
})
