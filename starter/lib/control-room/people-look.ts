import type { OpsPerson } from "./types"

// How a person is shown: Bahn's job title and a round photo. The fields are on OpsPerson;
// these fall back on the role and the id, so a database seeded before they existed still shows both.

export function jobTitle(p: Pick<OpsPerson, "role" | "title">): string {
  return p.title ?? (p.role === "shift_lead" ? "Operations Lead" : "Operations Associate")
}

export function avatarOf(p: Pick<OpsPerson, "id" | "avatar">): string {
  return p.avatar ?? `/control-room/people/${p.id.replace(/^p-/, "")}.jpg`
}
