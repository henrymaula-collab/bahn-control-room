// The baseline generator: from one order's dataset rows and its case (type,
// time), a believable record a colleague would have on file. Deterministic
// (seeded by the order id), so every run makes the same record. It never
// settles the case: the thread says what the card says ("not confirmed yet",
// "not named yet"), the call and the note agree with it, and the documents,
// hours, people and earlier pickups only add the everyday detail around it.
// The five demo orders are skipped: lib/demo writes those by hand.

import {
  activeAssignment, byId, conversationsFor, customer, driver, findOrder, forOrder, messagesFor, pickupPlace, placeLanguage, str, table, vehicleFor,
  type OrderRow,
} from "@/lib/agent/data"
import { asLang, dayPhrase, type Key, type Lang, say, slotPhrase, type V } from "./phrases"
import { type CaseDepth, DEPTH_VERSION, type DepthCall, type DepthContact, type DepthDocument, type DepthMessage, type DepthNote, type DepthPickup } from "./types"

/** Orders whose depth D1 writes by hand (lib/demo): the generator leaves them alone. */
export const DEMO_ORDER_REFS = new Set(["CD-420458", "CD-420442", "CD-420347", "CD-420516", "CD-420593"])

export interface DepthCase {
  id: string
  type: string
  createdAt: string
  facts?: { statement: string }[]
}

// ---------- seeded randomness ----------

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = ReturnType<typeof rng>
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

// ---------- made-up people and numbers ----------

const NAMES: Record<Lang, { first: string[]; last: string[] }> = {
  de: { first: ["Jana", "Lukas", "Katrin", "Tobias", "Miriam", "Felix", "Svenja", "Bastian", "Marlene", "Dominik"], last: ["Brennhoff", "Talmeier", "Wendkamp", "Oldersen", "Krautberg", "Hessling", "Vormann", "Lindtner", "Steinroth", "Quernheim"] },
  fi: { first: ["Riikka", "Joonas", "Sanna", "Teemu", "Heidi", "Ville", "Minna", "Lauri", "Tiina", "Antti"], last: ["Hallavaara", "Kiventola", "Sarvijoki", "Lehtikari", "Vainiolahti", "Kuusiranta", "Pihlavisto", "Rautavirta", "Salmikallio", "Kaarnalahti"] },
  da: { first: ["Mette", "Rasmus", "Signe", "Anders", "Freja", "Mads", "Line", "Søren", "Ida", "Nikolaj"], last: ["Holmgaard", "Vestergren", "Brandtoft", "Kjærsholt", "Lundholt", "Østerby", "Damsgaard", "Rønnekamp", "Skovborg", "Ellehøj"] },
  sv: { first: ["Elin", "Johan", "Karin", "Oskar", "Maja", "Viktor", "Linnea", "Gustav", "Ebba", "Anton"], last: ["Bergvall", "Lindqvarn", "Sandmark", "Ekholt", "Norrbeck", "Wikander", "Strandvall", "Hallgren", "Fjällmark", "Ljungdahl"] },
  fr: { first: ["Camille", "Julien", "Élodie", "Mathieu", "Claire", "Antoine", "Pauline", "Romain"], last: ["Rochemont", "Vaillandet", "Beaumarin", "Delorme", "Fontanel", "Marcillac", "Teyssier", "Valbonne"] },
  en: { first: ["Sanne", "Daan", "Fleur", "Joris", "Lotte", "Bram", "Noor", "Ruben"], last: ["van Dellen", "de Wilde", "Verhoeckx", "Brandsma", "van Oorschot", "Kuipers", "Dijkhuis", "Mertens"] },
}

const personName = (r: Rand, lang: Lang) => `${pick(r, NAMES[lang].first)} ${pick(r, NAMES[lang].last)}`

const AREA: Record<string, Record<string, string>> = {
  DE: { Hamburg: "40", Berlin: "30", Frankfurt: "69", Munich: "89", München: "89", Cologne: "221", Köln: "221", Stuttgart: "711", Düsseldorf: "211", Hanover: "511", Bremen: "421", Leipzig: "341", _: "30" },
  AT: { Vienna: "1", Wien: "1", Graz: "316", Linz: "732", Salzburg: "662", _: "1" },
  FI: { Helsinki: "9", Espoo: "9", Vantaa: "9", Tampere: "3", Turku: "2", Oulu: "8", _: "9" },
  SE: { Stockholm: "8", Gothenburg: "31", Göteborg: "31", Malmö: "40", Uppsala: "18", _: "8" },
  FR: { Paris: "1", Lyon: "4", Marseille: "4", Lille: "3", _: "1" },
  BE: { Brussels: "2", Antwerp: "3", _: "2" },
  NL: { Amsterdam: "20", Rotterdam: "10", Utrecht: "30", _: "20" },
}

/** Clearly fictional numbers in the 555 range, e.g. +49 40 555 0142. */
function phone(r: Rand, country: string, city: string): string {
  const nn = String(10 + Math.floor(r() * 89))
  const c = country.toUpperCase()
  if (c === "DK") return `+45 55 55 01 ${nn}`
  const code = { DE: "49", AT: "43", FI: "358", SE: "46", FR: "33", BE: "32", NL: "31" }[c] ?? "44"
  const area = AREA[c]?.[city] ?? AREA[c]?._ ?? "20"
  return `+${code} ${area} 555 01${nn}`
}

const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a").toLowerCase()
const slug = (s: string) => ascii(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const email = (name: string, org: string) => `${ascii(name).replace(/[^a-z]+/g, ".")}@${slug(org) || "pickup"}.example.test`

// ---------- time ----------

function zoneParts(ms: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date(ms))
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ""
  return { y: +get("year"), m: +get("month"), d: +get("day"), h: +get("hour") % 24, mi: +get("minute"), s: +get("second"), wd: get("weekday") }
}

/** ISO for a local wall-clock time in a timezone. */
function localIso(y: number, m: number, d: number, hhmm: string, tz: string): string {
  const [h, mi] = hhmm.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const p = zoneParts(guess, tz)
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - guess
  return new Date(guess - offset).toISOString()
}

/** The local date `back` working days before an instant (Mon..Fri). */
function workingDayBefore(iso: string, tz: string, back: number) {
  let ms = Date.parse(iso)
  let left = back
  while (left > 0) {
    ms -= 86_400_000
    const wd = zoneParts(ms, tz).wd
    if (wd !== "Sat" && wd !== "Sun") left--
  }
  return zoneParts(ms, tz)
}

// ---------- the dataset around the order ----------

function pickupSlot(orderId: string): { at: string; tz: string } | null {
  const wins = forOrder("time_windows", orderId)
  const w = wins.find((x) => x.purpose === "SELECTED_PICKUP_SLOT" && x.is_selected) ?? wins.find((x) => x.purpose === "SELECTED_PICKUP_SLOT") ?? wins.find((x) => x.purpose === "REQUESTED_PICKUP_SLOT")
  return w ? { at: String(w.start_at), tz: String(w.timezone ?? "Europe/Helsinki") } : null
}

function deliveryPromise(orderId: string): { at: string; tz: string } | null {
  const wins = forOrder("time_windows", orderId)
  const w = wins.find((x) => x.purpose === "CUSTOMER_DELIVERY_PROMISE") ?? wins.find((x) => x.purpose === "SELECTED_DELIVERY_SLOT")
  return w ? { at: String(w.start_at), tz: String(w.timezone ?? "Europe/Helsinki") } : null
}

function driverLine(order: OrderRow): string {
  const asg = activeAssignment(order.id)
  if (asg && asg.status !== "COMPLETED") {
    const d = driver(str(asg.driver_id))
    return `Driver ${String(d?.display_name ?? "on the gig")} is booked (fee EUR ${Math.round(Number(asg.fee_cents) / 100)}) and has not been told about this yet.`
  }
  if (forOrder("market_offers", order.id).some((o) => o.status === "PUBLISHED")) return "The gig is published to drivers; nobody has taken it yet, so no driver needs telling."
  return "No driver is booked yet and the gig is not published, so no driver needs telling."
}

const DESK: Record<string, string> = {
  service_desk: "the service desk", reception: "reception", security_gate: "the gate lodge", inspection_lot: "the reconditioning team at the inspection lot",
  showroom: "the showroom desk", secure_store: "the store office", fleet_desk: "the fleet desk", appointment_bay: "the appointment desk",
  staffed_appointment_desk: "the appointment desk", staffed_yard: "the yard office", staffed_yard_gate: "the yard gate office", vehicle_bay: "the vehicle bay office",
  source_collection_desk: "the collection desk",
}

const ROUTINE: Record<string, string> = {
  security_gate: "The driver shows ID and the order reference at the gate lodge; the gate calls the desk, and staff bring the car to the visitor bays.",
  inspection_lot: "The driver walks round the car with reconditioning staff at the inspection lot, they both sign the condition sheet, then the keys come out.",
  secure_store: "The driver waits in the store office while staff fetch the car from the locked hall; keys only against the signed release on file.",
  staffed_yard: "The driver reports at the yard office; yard staff drive the car out to the exit lane and hand over the keys there.",
  staffed_yard_gate: "The driver reports at the yard gate office; yard staff drive the car out to the exit lane and hand over the keys there.",
}

const QUIRKS = [
  "The phone is busiest 08:00 to 09:30; written messages get an answer within about two hours.",
  "Nobody is at the desk over lunch, roughly 12:00 to 12:45.",
  "Driver parking is the visitor bays by the main entrance, 15 minutes at most.",
  "They want the order reference in the subject line of every email.",
  "Keys come out only after the driver has signed the handover sheet at the desk.",
  "On Fridays the desk closes an hour before the opening hours say.",
  "Staff prefer a call the day before a pickup, not on the day itself.",
]

const ROUTINE_PICKUPS = [
  "Collected on time. Keys and papers were ready at the desk.",
  "Collected on time after a short walk-round check with staff.",
  "The driver waited 20 minutes: the car was still being washed.",
  "Collected 30 minutes late: the gate needed the order reference before letting the driver in.",
  "Collected on time. Staff asked the driver to sign their own handover sheet as well.",
  "The driver waited 15 minutes for the contact to come back from lunch.",
]

const HICCUP: Record<string, string> = {
  car_not_ready: "The driver waited 40 minutes: the final check was not done when the driver arrived.",
  keys_or_access: "The driver waited 25 minutes until staff found who had the keys.",
  no_answer: "Confirmed only after a second call the day before; then collected on time.",
  release_document_missing: "Handed over only after staff found the signed release in their inbox, 35 minutes after the driver arrived.",
  facts_disagree: "The car stood at the rear lot, not the front as the order said; staff walked the driver over.",
  fee_requested: "Staff asked about a handling fee at the desk; it was settled by phone with the customer, and the car left on time.",
}

const COLOURS = ["black", "white", "silver", "dark grey", "dark blue", "red", "graphite", "pearl white"]
const CONDITION = [
  "No damage noted on the order.",
  "Small stone chip on the windscreen, noted by the seller.",
  "Light scratches on the rear bumper, noted by the seller.",
  "Kerbed front left wheel rim, noted by the seller.",
]

const REG_DOC: Record<string, { name: string; detail: string }> = {
  DE: { name: "Zulassungsbescheinigung Teil I (registration certificate, part I)", detail: "travels with the car" },
  AT: { name: "Zulassungsschein (registration certificate)", detail: "travels with the car" },
  FI: { name: "Rekisteröintitodistus osa I (registration certificate, part I)", detail: "travels with the car" },
  DK: { name: "Registreringsattest (registration certificate)", detail: "travels with the car" },
  SE: { name: "Registreringsbevis del 1 (registration certificate, part 1)", detail: "travels with the car" },
  FR: { name: "Certificat d'immatriculation (registration certificate)", detail: "travels with the car" },
}

const HOURS_BY_KIND: Record<string, Record<string, string>> = {
  DEALERSHIP: { "Mon-Fri": "08:00-17:00", Sat: "10:00-14:00", Sun: "closed" },
  SOURCE_DEALER: { "Mon-Fri": "08:00-17:00", Sat: "closed", Sun: "closed" },
  INDEPENDENT_STORAGE: { "Mon-Fri": "07:00-16:00", Sat: "closed", Sun: "closed" },
  TRANSFER_YARD: { "Mon-Fri": "06:00-20:00", Sat: "08:00-14:00", Sun: "closed" },
}

function hoursOf(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const keys = Object.keys(o)
  if (!keys.length) return null
  const label: Record<string, string> = { mon_fri: "Mon-Fri", sat: "Sat", sun: "Sun" }
  const out: Record<string, string> = {}
  for (const k of keys) out[label[k] ?? k] = typeof o[k] === "string" && o[k] ? String(o[k]) : "closed"
  return out
}

// ---------- the thread, the call, the note, by kind of case ----------

type Who = "bahn" | "place" | "customer"
type Spec = { from: Who; to: Who; key: Key; day: 0 | 1; at: string }

/** Kind of case -> its messages (to, in the recipient's or writer's language) and one call. Times are local wall-clock. */
function plan(kind: string, privatePlace: boolean, requiresRelease: boolean, hasDelivery: boolean): { messages: Spec[]; call: { outcome: DepthCall["outcome"]; turns: [Who, Key][] } } {
  const m = (from: Who, to: Who, key: Key, at: string, day: 0 | 1 = 1): Spec => ({ from, to, key, day, at })
  switch (kind) {
    case "car_not_ready":
      return {
        messages: [m("bahn", "place", "askReady", "09:40"), m("place", "bahn", "notSure", "11:15"), m("bahn", "customer", "custUpdateReady", "11:40"), m("customer", "bahn", hasDelivery ? "custDeliveryWait" : "custWait", "13:05")],
        call: { outcome: "answered", turns: [["bahn", "cAskReady"], ["place", "cNotYet"], ["bahn", "cWhoLater"], ["place", "cAskFor"]] },
      }
    case "keys_or_access":
      return {
        messages: [m("bahn", "place", "askKeys", "09:35"), m("place", "bahn", privatePlace ? "keysUnclearPrivate" : "keysUnclear", "12:20"), m("bahn", "customer", "custUpdateKeys", "13:10"), m("customer", "bahn", "custKeysReply", "14:45")],
        call: { outcome: "answered", turns: [["bahn", "cAskKeys"], ["place", "cNoShiftPlan"], ["bahn", "cThanks"]] },
      }
    case "no_answer":
      return {
        messages: [m("bahn", "place", "askConfirm", "10:05"), m("bahn", "place", "reminder", "14:30"), m("customer", "bahn", "custAsksConfirm", "15:10"), m("bahn", "customer", "custNoReplyYet", "15:25")],
        call: { outcome: "voicemail", turns: [["bahn", "cVoicemail"]] },
      }
    case "release_document_missing":
    case "seller_hold":
      return {
        messages: [m("bahn", "customer", "askRelease", "09:20"), m("customer", "bahn", "releaseRequested", "10:50"), m("bahn", "place", "askReleaseRule", "11:30"), m("place", "bahn", requiresRelease ? "releaseNeeded" : "releaseSendIt", "13:40")],
        call: { outcome: "answered", turns: [["bahn", "cAskRelease"], ["place", requiresRelease ? "cNoRelease" : "cNoReleaseYet"]] },
      }
    case "facts_disagree":
    case "facts_disagree_open_gig":
      return {
        messages: [m("place", "bahn", "placeDiffers", "10:10"), m("bahn", "place", "askWhich", "10:35"), m("bahn", "customer", "custAskWhich", "10:50")],
        call: { outcome: "answered", turns: [["bahn", "cAskWhere"], ["place", "cWriteUs"]] },
      }
    case "fee_requested":
      return {
        messages: [m("place", "bahn", "feeAsk", "09:50"), m("bahn", "place", "feeCheck", "10:20"), m("bahn", "customer", "custFee", "10:40")],
        call: { outcome: "answered", turns: [["bahn", "cAskFee"], ["place", "cFeeWhat"]] },
      }
    default:
      return {
        messages: [m("bahn", "place", "confirmSlot", "10:00"), m("place", "bahn", "allSet", "11:30")],
        call: { outcome: "answered", turns: [["bahn", "cAskPlan"], ["place", "cAsPlanned"]] },
      }
  }
}

function noteText(kind: string, place: string, order: OrderRow, slotDayEn: string, amount: string | null): string {
  const lead: Record<string, string> = {
    car_not_ready: `${place} could not confirm on the phone this morning that the car will be ready ${slotDayEn}. The customer wants to hear before any date changes.`,
    keys_or_access: `Nobody at ${place} has named who hands over the keys ${slotDayEn}; they point to the shift plan, which is not made yet.`,
    no_answer: `${place} has not answered two messages and this morning's call (voicemail left).`,
    release_document_missing: `The signed release is still not on file. The customer has asked the seller for it, with no date promised.`,
    seller_hold: `The signed release is still not on file. The customer has asked the seller for it, with no date promised.`,
    facts_disagree: `${place} says the pickup details on the order do not match their plan; nothing confirmed in writing yet.`,
    facts_disagree_open_gig: `${place} says the pickup details on the order do not match their plan; nothing confirmed in writing yet.`,
    fee_requested: `${place} asks for a handling fee${amount ? ` of ${amount}` : ""}; the customer has not answered yet.`,
  }
  return `${lead[kind] ?? `Pickup ${slotDayEn} checked with ${place}.`} ${driverLine(order)}`
}

// ---------- the record ----------

export interface DepthInput {
  /** Order reference or id. */
  order: string
  case: DepthCase | null
  /** Anchor when there is no case: the dataset clock. */
  now: string
}

/** The baseline record for one order, or null for a demo order or an unknown one. */
export function generateDepth(input: DepthInput): CaseDepth | null {
  const order = findOrder(input.order)
  if (!order || DEMO_ORDER_REFS.has(order.reference)) return null
  const r = rng(hash(`${order.id}:depth:${DEPTH_VERSION}`))
  const c = input.case
  const kind = (c?.type ?? "readiness.other").split(".").pop() ?? "other"
  const anchor = c?.createdAt ?? input.now

  const cust = customer(order.customer_id)
  const custName = String(cust?.name ?? "the customer")
  const custCountry = String(cust?.country ?? "")
  const custLang = asLang(placeLanguage(custCountry))
  const { site, address } = pickupPlace(order)
  const placeName = site?.name ?? str(address?.name) ?? "the pickup place"
  const country = String(site?.country ?? address?.country ?? "")
  const city = String(site?.city ?? address?.city ?? "")
  const tz = String(site?.timezone ?? address?.timezone ?? "Europe/Helsinki")
  const placeLang = asLang(placeLanguage(country))
  const privatePlace = !site
  const requiresRelease = site?.requires_signed_release === true
  const endpoint = forOrder("order_endpoint_details", order.id).find((e) => e.boundary === "PICKUP")
  const v = vehicleFor(order)
  const car = v ? `${v.make} ${v.model}` : "the car"
  const mode = String(site?.handover_mode ?? "")
  const desk = DESK[mode] ?? (privatePlace ? "the person at the address" : "reception")

  // People: the dataset's contact when there is one, else made up in the place's language.
  const contactName = str(endpoint?.contact_name) ?? personName(r, placeLang)
  const deputyName = personName(r, placeLang)
  const custContactName = personName(r, custLang)
  const placeEmail = site?.pickup_contact_email ?? (str(endpoint?.contact_handle)?.includes("@") ? str(endpoint?.contact_handle)! : email("pickup", placeName))
  const contacts: DepthContact[] = [
    { name: contactName, role: str(endpoint?.contact_role) ?? (privatePlace ? "handover contact at the address" : `contact for Bahn pickups, ${desk}`), phone: phone(r, country, city), email: placeEmail, language: placeLang },
    { name: deputyName, role: privatePlace ? "colleague at the address" : `stands in at ${desk}`, phone: phone(r, country, city), email: email(deputyName, placeName), language: placeLang },
  ]
  const customerContact: DepthContact = { name: custContactName, role: `logistics coordinator at ${custName}`, phone: phone(r, custCountry, ""), email: email(custContactName, custName), language: custLang }

  // Dates in each language.
  const slot = pickupSlot(order.id)
  const promise = deliveryPromise(order.id)
  const amount = (c?.facts ?? []).map((f) => /EUR\s?(\d+)/.exec(f.statement)?.[1]).find(Boolean)
  const vars = (lang: Lang): V => ({
    ref: order.reference, car, place: placeName, contact: contactName, cust: custContactName.split(" ")[0]!,
    slot: slotPhrase(slot?.at ?? null, lang, slot?.tz ?? tz), slotDay: dayPhrase(slot?.at ?? null, lang, slot?.tz ?? tz),
    delivery: promise ? dayPhrase(promise.at, lang, promise.tz) : null, amount: amount ? `EUR ${amount}` : null,
  })
  const enV = vars("en")

  // Times: the working day before the case for the thread, the case's morning for the call and the note,
  // always after the order was created and before the case.
  const before = workingDayBefore(anchor, tz, 1)
  const today = zoneParts(Date.parse(anchor), tz)
  const created = Date.parse(String(order.created_at))
  const end = Date.parse(anchor) - 10 * 60_000
  let lastAt = created
  const clamp = (iso: string) => {
    let ms = Date.parse(iso)
    if (ms <= lastAt) ms = lastAt + 20 * 60_000
    if (ms > end) ms = Math.max(lastAt + 60_000, end - 5 * 60_000)
    lastAt = ms
    return new Date(ms).toISOString()
  }
  const label = (w: Who) => (w === "bahn" ? "Readiness desk (Bahn)" : w === "place" ? `${contactName} (${placeName})` : `${custContactName} (${custName})`)
  const langOf = (s: Spec): Lang => (s.from === "customer" || s.to === "customer" ? custLang : placeLang)

  const hasDatasetThread = conversationsFor(order.id).some((cv) => messagesFor(String(cv.id)).length > 0)
  const p = plan(kind, privatePlace, requiresRelease, !!promise)
  const messages: DepthMessage[] = hasDatasetThread
    ? []
    : p.messages.map((s, i) => {
        const lang = langOf(s)
        const text = say(lang, s.key, vars(lang))
        return {
          id: `depth-msg-${order.id}-${i + 1}`,
          at: clamp(localIso(before.y, before.m, before.d, s.at, tz)),
          from: label(s.from), fromKind: s.from === "place" ? "pickup_place" : s.from,
          to: label(s.to), channel: "email" as const, language: lang, text,
          ...(lang !== "en" ? { english: say("en", s.key, enV) } : {}),
        }
      })
  // A thread in the dataset is newer ground: the call and the note keep their own morning slot.
  if (hasDatasetThread) lastAt = created
  const callAt = clamp(localIso(today.y, today.m, today.d, "08:15", tz))
  const calls: DepthCall[] = [{
    id: `depth-call-${order.id}`,
    startedAt: callAt,
    by: "Readiness desk (a Bahn colleague, before the agent took the case)",
    with: p.call.outcome === "answered" ? `${placeName}, ${desk}` : placeName,
    language: placeLang,
    outcome: p.call.outcome,
    minutes: p.call.outcome === "answered" ? 2 + Math.floor(r() * 4) : 1,
    turns: p.call.turns.map(([who, key]) => ({
      speaker: who === "bahn" ? ("bahn" as const) : ("pickup_place" as const),
      text: say(placeLang, key, vars(placeLang)),
      ...(placeLang !== "en" ? { english: say("en", key, enV) } : {}),
    })),
  }]
  const notes: DepthNote[] = [{ at: clamp(localIso(today.y, today.m, today.d, "08:35", tz)), by: "Readiness desk, internal note", text: noteText(kind, placeName, order, enV.slotDay, enV.amount) }]

  // Documents beyond the dataset's own (release document, CMR stay where they are).
  const reg = REG_DOC[country.toUpperCase()] ?? { name: "Registration certificate", detail: "travels with the car" }
  const regKnown = r() < 0.8
  const digital = r() < 0.5
  const delivery = byId("sites", order.delivery_site_id) ?? byId("addresses", order.delivery_address_id)
  const crossBorder = !!delivery && String(delivery.country ?? "") !== country
  const documents: DepthDocument[] = [
    { name: reg.name, status: regKnown ? "with the car" : "not confirmed", detail: regKnown ? `${reg.detail}; ${placeName} says it is in the glovebox.` : `${placeName} has not said where it is yet.` },
    digital
      ? { name: "Service history", status: "digital", detail: "Digital service record; the seller can send a printout on request." }
      : { name: "Service history", status: "printed book", detail: "Printed service book in the glovebox, per the seller." },
    { name: "Handover protocol", status: "not started", detail: "The driver fills it in the Bahn app at pickup: photos of all four sides, the dashboard and the keys, signed by both sides." },
    { name: "Keys", status: "2 listed", detail: "Two keys listed on the order; the driver counts them at the handover." },
    ...(crossBorder ? [{ name: "Export papers", status: "not needed", detail: `Pickup in ${country}, delivery in ${String(delivery?.country ?? "")}: both in the EU, so no export papers.` }] : []),
  ]

  // The pickup place: hours, phone, routine, quirks.
  const datasetHours = hoursOf(site?.opening_hours) ?? hoursOf(address?.opening_hours)
  const kindKey = String(site?.kind ?? address?.kind ?? "")
  const openingHours = datasetHours ?? (privatePlace ? { "Mon-Fri": "08:00-16:30 (business address)", Sat: "closed", Sun: "closed" } : HOURS_BY_KIND[kindKey] ?? HOURS_BY_KIND.DEALERSHIP!)
  const shuffled = [...QUIRKS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  const quirks = shuffled.slice(0, 2)
  const place: CaseDepth["place"] = {
    name: placeName,
    phone: phone(r, country, city),
    email: placeEmail,
    answersThePhone: privatePlace ? `${contactName} answers; nobody else at the address handles pickups.` : `${desk.charAt(0).toUpperCase()}${desk.slice(1)} answers the main number; ask for ${contactName}, or ${deputyName} when ${contactName.split(" ")[0]} is out.`,
    contacts,
    openingHours,
    hoursSource: datasetHours ? "pickup place profile" : "told by the pickup place on the phone (not in the profile)",
    handoverRoutine: ROUTINE[mode] ?? (privatePlace
      ? `The driver rings ${contactName} on arrival; the car is handed over at the loading bay after a walk-round check.`
      : `The driver reports to ${desk} with ID and the order reference; staff bring the car out, walk round it with the driver and hand over the keys.`),
    quirks,
  }

  // Earlier pickups at this place (routine ones; the decisions there come from the decision history).
  const vehicles = table("vehicles").map((x) => `${x.make} ${x.model}`).filter((x) => x !== car)
  const drivers = table("drivers").map((d) => String(d.display_name ?? "")).filter(Boolean)
  const pr = rng(hash(`${site?.id ?? placeName}:pickups:${DEPTH_VERSION}`))
  const earlierPickups: DepthPickup[] = [9, 23, 44].map((daysBack, i) => {
    const ms = Date.parse(anchor) - (daysBack + Math.floor(pr() * 6)) * 86_400_000
    let z = zoneParts(ms, tz)
    if (z.wd === "Sat" || z.wd === "Sun") z = zoneParts(ms - (z.wd === "Sat" ? 1 : 2) * 86_400_000, tz)
    const time = `${String(9 + Math.floor(pr() * 6)).padStart(2, "0")}:${pr() < 0.5 ? "00" : "30"}`
    const outcome = i === 1 && HICCUP[kind] ? HICCUP[kind]! : pick(pr, ROUTINE_PICKUPS)
    return {
      reference: `CD-417${String(100 + (hash(`${site?.id ?? placeName}-${i}`) % 900)).padStart(3, "0")}`,
      when: localIso(z.y, z.m, z.d, time, tz),
      car: vehicles.length ? pick(pr, vehicles) : "a car",
      driver: drivers.length ? pick(pr, drivers) : "a Bahn driver",
      handedOverBy: i === 2 ? deputyName : contactName,
      outcome,
    }
  })

  const year = Number(v?.model_year ?? 2022)
  const mileage = Math.max(900, Math.round(((2026 - year) * 13_000 + r() * 9_000) / 100) * 100)
  return {
    v: DEPTH_VERSION,
    orderId: order.id,
    reference: order.reference,
    caseId: c?.id ?? null,
    caseType: c?.type ?? null,
    synthetic: true,
    car: { colour: pick(r, COLOURS), mileageKm: mileage, keys: "2 keys", condition: pick(r, CONDITION) },
    customerContact,
    place,
    messages,
    calls,
    notes,
    documents,
    earlierPickups,
  }
}

/** The same record for every case passed in, demo orders left out. */
export function generateAll(cases: (DepthCase & { orderId: string })[], now: string): CaseDepth[] {
  const seen = new Set<string>()
  const out: CaseDepth[] = []
  for (const c of cases) {
    if (seen.has(c.orderId)) continue
    const d = generateDepth({ order: c.orderId, case: c, now })
    if (d) {
      seen.add(c.orderId)
      out.push(d)
    }
  }
  return out
}
