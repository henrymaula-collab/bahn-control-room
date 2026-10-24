import type { OpsPerson } from "../types"

// A made-up ops team. No real people. First names only, as Bahn's ops people address each other.
export const PEOPLE: OpsPerson[] = [
  { id: "aino", name: "Aino", role: "ops", title: "Operations Associate", avatar: "/control-room/people/aino.jpg", desks: ["ops-readiness"], languages: ["fi", "sv", "en", "de"], onShift: true },
  { id: "mikko", name: "Mikko", role: "ops", title: "Operations Associate", avatar: "/control-room/people/mikko.jpg", desks: ["ops-readiness", "ops-dispatch"], languages: ["fi", "en"], onShift: true },
  { id: "sofie", name: "Sofie", role: "ops", title: "Operations Associate", avatar: "/control-room/people/sofie.jpg", desks: ["ops-readiness"], languages: ["sv", "da", "en"], onShift: true },
  { id: "jonas", name: "Jonas", role: "ops", title: "Operations Associate", avatar: "/control-room/people/jonas.jpg", desks: ["ops-readiness"], languages: ["de", "en"], onShift: true },
  { id: "emil", name: "Emil", role: "ops", title: "Operations Associate", avatar: "/control-room/people/emil.jpg", desks: ["ops-readiness"], languages: ["da", "en"], onShift: true },
  { id: "lea", name: "Lea", role: "ops", title: "Operations Associate", avatar: "/control-room/people/lea.jpg", desks: ["ops-readiness"], languages: ["de", "fr", "en"], onShift: false },
  { id: "kaisa", name: "Kaisa", role: "shift_lead", title: "Operations Lead", avatar: "/control-room/people/kaisa.jpg", desks: ["ops-shift"], languages: ["fi", "en", "de"], onShift: true },
]
