// The room clock for fixtures: the dataset snapshot, Wed 21 Oct 2026 12:00 in Helsinki.
export const ROOM_NOW = "2026-10-21T09:00:00.000Z"

/** Helsinki wall time to ISO. Helsinki is UTC+3 until Sun 25 Oct 2026, then UTC+2. */
export function hel(day: string, hm: string): string {
  const offset = day >= "2026-10-25" ? "+02:00" : "+03:00"
  return new Date(`${day}T${hm}:00${offset}`).toISOString()
}

/** Shorthand for a time today (Wed 21 Oct) in Helsinki. */
export const today = (hm: string) => hel("2026-10-21", hm)
