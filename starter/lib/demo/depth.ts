// Deep, made-up records for the five cases the demo video shows, so the chat
// can answer what a colleague would know: names, phone numbers, what each side
// wrote, documents present and missing, how earlier pickups at the place went.
//
//   CD-420458  Ferrari Roma at Calverona Hamburg      round 1, Aino
//   CD-420442  Bentley at Orvendin Cars Stockholm     round 2, Sofie
//   CD-420347  Mercedes-Benz EQE at Arvelano Hamburg  fast-forward, Kaisa
//   CD-420593  BMW M4 at Velantora Helsinki           Aino's list
//   CD-420516  Volvo V60 at Velantora Helsinki        Aino's list
//
// Everything here is MADE UP for the demo and marked so: ids start with
// "demo-", rows carry data_origin "DEMO_DEPTH" (the packet marks its own
// fixtures "SYNTHETIC_FIXTURE"). The rows use the packet's own shapes
// (conversations, messages, order_notes, documents, order_endpoint_details), so
// the chat's read tools return them unchanged; lib/demo/overlay.ts adds them to
// the agent's table cache in memory. The packet files are never edited, and the
// engine (cards, derived cases, routing, counts) never sees these rows.
//
// Consistency rules the rows keep (lib/demo/depth.test.ts checks them):
// - A recorded or derived case says how many messages the agent read and when.
//   No message here is older than that read for 458, 516, 347 and 593.
// - Nothing contradicts the case's facts, opener or options; nothing resolves a case.
// - Place notes cite only the made-up history the seed already holds at that
//   place (who decided which earlier case), and add how it went.
// - Phone numbers use the 555 01xx range; e-mail addresses end in .example.

import type { Call } from "@/lib/control-room/types"

export type DemoRow = Record<string, unknown> & { id: string }

export const DEMO_ORIGIN = "DEMO_DEPTH"

export const DEMO_ORDERS = {
  "ord-00458": { reference: "CD-420458", caseId: "case-ord-00458-agent", placeId: "site-042" },
  "ord-00442": { reference: "CD-420442", caseId: "case-ord-00442-demo", placeId: "site-083" },
  "ord-00347": { reference: "CD-420347", caseId: "case-ord-00347-facts_disagree", placeId: "site-047" },
  "ord-00593": { reference: "CD-420593", caseId: "case-ord-00593-car_not_ready", placeId: "site-001" },
  "ord-00516": { reference: "CD-420516", caseId: "case-ord-00516-agent", placeId: "site-001" },
} as const

export type DemoOrderId = keyof typeof DEMO_ORDERS
export const DEMO_ORDER_IDS = Object.keys(DEMO_ORDERS) as DemoOrderId[]
export const DEMO_PLACE_IDS = [...new Set(Object.values(DEMO_ORDERS).map((o) => o.placeId))]

/**
 * When the agent read each order's messages, for the cases whose step says how
 * many it read. Demo messages on these orders must be newer, or the count would
 * be wrong. (CD-420442's made-up steps give no count.)
 */
export const AGENT_READ_AT: Partial<Record<DemoOrderId, string>> = {
  "ord-00458": "2026-10-21T09:00:11.000Z", // recorded run: "Read 3 conversations (8 messages)."
  "ord-00516": "2026-10-21T09:00:11.000Z", // recorded run: "Read 3 conversations (8 messages)."
  "ord-00347": "2026-10-21T08:55:00.000Z", // derived: "Read 4 messages about the pickup."
  "ord-00593": "2026-10-21T08:55:00.000Z", // derived: "Read 6 messages about the pickup."
}

// ---------- the pickup places ----------

export interface EarlierPickup {
  /** The made-up history decision this note belongs to (scripts/lib/seed-cr.ts). */
  caseId: string
  reference: string
  day: string
  who: string
  what: string
  howItWent: string
}

export interface PlaceDepth {
  placeId: string
  name: string
  contacts: { name: string; role: string; phone: string; email: string }[]
  routine: string
  quirks: string[]
  earlier: EarlierPickup[]
}

export const DEMO_PLACES: Record<string, PlaceDepth> = {
  "site-042": {
    placeId: "site-042",
    name: "Calverona Hamburg",
    contacts: [
      { name: "Lukas Brandt", role: "workshop (Werkstatt), the storekeeper who releases cars", phone: "+49 40 555 0142", email: "werkstatt@calverona.example" },
      { name: "Jasper Alderfield", role: "site desk, bookings", phone: "+49 40 555 0140", email: "site-042@example.test" },
    ],
    routine:
      "Cars wait in the secure store behind the workshop at Birkenquellweg 81. The storekeeper releases a car only inside the booked slot, against the driver's ID and a signed release from the seller sent by email to werkstatt@calverona.example. Drivers ring at the workshop door, not at the showroom; the yard gate is opened from inside. Open Mon to Fri 08:30 to 19:00, Sat 09:00 to 13:00.",
    quirks: [
      "The workshop answers the phone; the site desk only takes bookings and cannot say whether a release has arrived.",
      "Releases sent to the general site address are not seen by the workshop the same day.",
    ],
    earlier: [
      { caseId: "hist-case-0288", reference: "CD-411288", day: "19 Oct", who: "Kaisa", what: "the branch and the order named different handover points; she went with the branch", howItWent: "the driver went to the workshop door and the pickup ran on time" },
      { caseId: "hist-case-0177", reference: "CD-411177", day: "29 Sep", who: "Jonas", what: "nobody had named who releases the keys; he held the driver until the workshop named Lukas Brandt", howItWent: "the car left 40 minutes late, delivered the same day" },
      { caseId: "hist-case-0250", reference: "CD-411250", day: "25 Sep", who: "Lea", what: "the handover point was unclear while the gig was posted; she paused the gig", howItWent: "the branch confirmed the workshop door within the hour and the gig went out again" },
      { caseId: "hist-case-0204", reference: "CD-411204", day: "10 Aug", who: "Jonas", what: "the car was still in the workshop; he moved the pickup one day", howItWent: "picked up the next morning, delivered a day late, the customer did not complain" },
    ],
  },
  "site-083": {
    placeId: "site-083",
    name: "Orvendin Cars Stockholm",
    contacts: [
      { name: "Uma Aldermere", role: "collection desk (utlämningen)", phone: "+46 8 555 0173", email: "utlamning@orvendin.example" },
      { name: "Johan Ekwall", role: "accounts (ekonomi), puts holds on and lifts them", phone: "+46 8 555 0179", email: "ekonomi@orvendin.example" },
    ],
    routine:
      "A source dealer: Orvendin sells the car and is also the pickup place. Cars leave only from the collection desk at the staffed entrance, Silverlundsvägen 24. Quote the order reference; the desk matches the VIN against the buyer's signed release (utlämningsfullmakt) naming Bahn as carrier. Open Mon to Fri 09:00 to 17:00, closed at weekends.",
    quirks: [
      "Accounts checks incoming payments twice a day, at 10:00 and 15:00 Stockholm time, and lifts a hold only after one of those checks.",
      "The collection desk is unstaffed 12:00 to 12:45 for lunch.",
      "Orvendin hands out temporary export plates together with the keys.",
    ],
    earlier: [
      { caseId: "hist-case-0046", reference: "CD-411046", day: "15 Oct", who: "Aino", what: "the car was still being prepared; she moved the pickup to the next working day", howItWent: "picked up the next day at 10:20, the ferry was rebooked one day later, delivered on the promised day" },
      { caseId: "hist-case-0128", reference: "CD-411128", day: "14 Oct", who: "Sofie", what: "nobody was named to hand over the keys; she held the driver until the desk named someone", howItWent: "the driver had arrived in the lunch break and waited 25 minutes for Uma Aldermere" },
      { caseId: "hist-case-0327", reference: "CD-411327", day: "8 Oct", who: "Sofie", what: "the order and the desk disagreed on the entrance while the gig was posted; she paused the gig", howItWent: "the desk confirmed the staffed entrance the same afternoon and the gig was taken within two hours" },
      { caseId: "hist-case-0165", reference: "CD-411165", day: "11 Sep", who: "Sofie", what: "the desk asked a storage fee for a car left over the weekend; she accepted it", howItWent: "the pickup ran on time" },
    ],
  },
  "site-047": {
    placeId: "site-047",
    name: "Arvelano Hamburg",
    contacts: [
      { name: "Phoebe Alderfield", role: "site desk", phone: "+49 40 555 0156", email: "site-047@example.test" },
      { name: "Malte Venhaus", role: "stock control (Lagerverwaltung), owns the stock screen and the yard", phone: "+49 40 555 0158", email: "lager@arvelano.example" },
    ],
    routine:
      "Showroom handover at Lichtuferallee 5: the driver waits outside the showroom and staff bring the car out for inspection and keys. Some cars stand in the yard round the corner; stock control's screen says which. Open Mon to Fri 08:30 to 19:00, closed at weekends.",
    quirks: ["The stock screen is right and old order notes are not (lesson accepted on 12 Oct)."],
    earlier: [
      { caseId: "hist-case-0332", reference: "CD-411332", day: "12 Oct", who: "Mikko", what: "the order note and the stock screen named different handover points while the gig was posted; he paused the gig", howItWent: "stock control confirmed the yard within two hours, the gig went out again and the pickup ran on time" },
    ],
  },
  "site-001": {
    placeId: "site-001",
    name: "Velantora Helsinki",
    contacts: [
      { name: "Adrian Alderbrook", role: "branch desk, assigns the collection bay", phone: "+358 9 555 0121", email: "site-001@example.test" },
      { name: "Ville Saarinen", role: "stock control (varastonhallinta), keeps the keys at the collection bay desk", phone: "+358 9 555 0128", email: "varasto@velantora.example" },
    ],
    routine:
      "Appointment bay at Kuparisaarenkuja 10: the driver calls the branch desk 30 minutes before arrival and waits for a bay number, never a free forecourt space. Keys are with stock control at the collection bay desk, not at reception. The side gate is for vehicles coming in only. Open Mon to Fri 08:30 to 19:00, Sat 09:00 to 13:00.",
    quirks: [
      "Velantora moves cars between the branch and its warehouse in Vantaa; only stock control's screen says where a car is that day.",
      "Reception cannot see stock control's list.",
    ],
    earlier: [
      { caseId: "hist-case-0116", reference: "CD-411116", day: "9 Oct", who: "Mikko", what: "the car was not ready; he kept the slot and had the branch called again", howItWent: "the car came out 50 minutes late" },
      { caseId: "hist-case-0006", reference: "CD-411006", day: "25 Sep", who: "Aino", what: "nobody had named the key holder; she kept the slot and had the branch called again", howItWent: "stock control named the key holder within the hour, pickup on time" },
      { caseId: "hist-case-0069", reference: "CD-411069", day: "8 Sep", who: "Aino", what: "the car was not ready; she asked the customer", howItWent: "the car turned out to be in Vantaa and came back the next day; pickup one day late" },
      { caseId: "hist-case-0025", reference: "CD-411025", day: "1 Sep", who: "Aino", what: "no key holder named; she held the driver until stock control named one", howItWent: "pickup 35 minutes late" },
    ],
  },
}

/** The place's notes as one paragraph, the way Bahn keeps them on the pickup place's profile. */
export function placeNoteText(placeId: string): string {
  const p = DEMO_PLACES[placeId]
  if (!p) return ""
  const who = p.contacts.map((c) => `${c.name}, ${c.role}, ${c.phone}, ${c.email}`).join("; ")
  const earlier = p.earlier.map((e) => `${e.day} (${e.reference}, ${e.who}): ${e.what}; ${e.howItWent}.`).join(" ")
  return `Bahn's notes on ${p.name} (made-up demo history): ${p.routine} Who to call: ${who}. ${p.quirks.join(" ")} Earlier pickups here: ${earlier}`
}

/**
 * The pickup place's profile, enriched: the packet's access note followed by
 * Bahn's notes (the "note on the place"). The overlay puts this row in place of
 * the packet's row in memory; every other field is the packet's own.
 */
export const DEMO_SITE_NOTES: Record<string, string> = Object.fromEntries(DEMO_PLACE_IDS.map((id) => [id, placeNoteText(id)]))

/** For a chat tool (get_place_history / get_pickup_place): the place's notes, structured. */
export function placeNotes(placeId: string | null | undefined) {
  const p = placeId ? DEMO_PLACES[placeId] : undefined
  if (!p) return null
  return {
    made_up_history: true,
    routine: p.routine,
    quirks: p.quirks,
    contacts: p.contacts,
    earlier_pickups: p.earlier.map((e) => ({ when: e.day, order: e.reference, who: e.who, what: e.what, how_it_went: e.howItWent })),
  }
}

// ---------- rows in the packet's shapes ----------

const demo = <T extends Record<string, unknown>>(row: T & { id: string }): DemoRow => ({ ...row, data_origin: DEMO_ORIGIN })

function note(id: string, orderId: DemoOrderId, at: string, author: { type: "customer" | "operator"; id: string }, body: string): DemoRow {
  return demo({ id, order_id: orderId, authored_at: at, author_type: author.type, author_id: author.id, body, visibility: "OPERATIONS" })
}

function message(
  id: string,
  conversationId: string,
  orderId: DemoOrderId,
  at: string,
  from: { type: string; id: string },
  to: { type: string; id: string },
  channel: string,
  language: string,
  body: string,
  visibility: "PUBLIC" | "INTERNAL" = "PUBLIC",
): DemoRow {
  return demo({
    id, conversation_id: conversationId, order_id: orderId, authored_at: at, author_type: from.type, author_id: from.id,
    recipient_type: to.type, recipient_id: to.id, channel, language, body, visibility,
  })
}

function doc(id: string, orderId: DemoOrderId, kind: string, status: string, required: boolean, files: number, at: string, extra: Record<string, unknown> = {}): DemoRow {
  return demo({ id, order_id: orderId, kind, status, required, file_count: files, signature_scope: "NONE", updated_at: at, ...extra })
}

function window(id: string, orderId: DemoOrderId, purpose: string, start: string, end: string, timezone: string, source: "OPS" | "CUSTOMER" | "SITE", statedAt: string): DemoRow {
  return demo({ id, order_id: orderId, purpose, start_at: start, end_at: end, timezone, source, is_selected: false, stated_at: statedAt })
}

function contact(id: string, orderId: DemoOrderId, placeId: string, addressId: string, at: string, name: string, role: string, access?: string): DemoRow {
  return demo({
    id, order_id: orderId, boundary: "PICKUP", site_id: placeId, address_id: addressId,
    contact_name: name, contact_role: role, contact_status: "CONFIRMED",
    ...(access ? { access_instruction: access } : {}), access_status: "NEEDS_VERIFICATION",
    stated_by: "SITE_CONTACT", stated_at: at, last_confirmed_at: at, last_confirmed_source: "SITE_CONTACT_REPLY",
  })
}

// Who's who in the messages (packet ids).
const KOVELLIN = { type: "customer", id: "cus-030" }
const VEKARINO = { type: "customer", id: "cus-007" }
const PELLAVARO = { type: "customer", id: "cus-015" }
const ORVENDIN = { type: "site_contact", id: "site-083" }
const KASPER = { type: "driver", id: "drv-165" }
const YARA = { type: "driver", id: "drv-139" }
const desk = (id: string) => ({ type: "operator", id })

// ----- CD-420458, Ferrari Roma at Calverona Hamburg (round 1) -----
// The packet already holds the threads (German and English), the branch's 08:38
// call note and the agent's German call. Added: the order's car details and the
// seller's name from the customer, the workshop contact from the call, the
// documents besides the release, and the place's notes.
const rows458: Partial<Record<string, DemoRow[]>> = {
  order_notes: [
    note("demo-note-458-car", "ord-00458", "2026-10-08T15:52:00Z", { type: "customer", id: "cus-030" },
      "Fahrzeug: Ferrari Roma 2023, Rosso Corsa, Innenraum Cuoio, 18.420 km. Zwei Schlüssel, beide im Schlüsselschrank der Werkstatt von Calverona Hamburg. Kleiner Steinschlag an der Frontschürze links, sonst ohne Mängel. Gekauft von der Rotherbach Sportwagen GmbH (Verkäufer, Ansprechpartnerin Ilka Vossberg, Buchhaltung, +49 40 555 0193); der Wagen steht bis zur Abholung im Lager von Calverona. Die Zulassungsbescheinigung Teil II bleibt bis zur vollständigen Zahlung beim Verkäufer. Ansprechpartnerin bei uns: Henrike Albers, Disposition, +49 40 555 0187, disposition@kovellin.example. Unser Endkunde übernimmt den Wagen am Dienstag, 27. Oktober, bei uns in der Moosbrunnenstraße."),
  ],
  order_endpoint_details: [
    contact("demo-ep-458-workshop", "ord-00458", "site-042", "addr-00042", "2026-10-21T09:01:04Z", "Lukas Brandt",
      "workshop (Werkstatt) at Calverona Hamburg, releases the car from the secure store; phone +49 40 555 0142; the seller's signed release goes by email to werkstatt@calverona.example",
      "Ring at the workshop door on Birkenquellweg, not at the showroom. The storekeeper releases the Ferrari only with the seller's signed release on file and the driver's ID, inside the booked slot."),
  ],
  documents: [
    doc("demo-doc-458-zb2", "ord-00458", "REGISTRATION_CERTIFICATE_PART_II", "HELD_BY_SELLER", false, 0, "2026-10-08T15:52:00Z"),
    doc("demo-doc-458-zb1", "ord-00458", "REGISTRATION_CERTIFICATE_PART_I", "WITH_THE_CAR", true, 0, "2026-10-08T15:52:00Z"),
    doc("demo-doc-458-handover", "ord-00458", "SIGNED_HANDOVER", "PREPARED", true, 0, "2026-10-18T12:25:00Z", { medium: "DIGITAL" }),
    doc("demo-doc-458-photos", "ord-00458", "CONDITION_PHOTO", "REQUESTED", true, 0, "2026-10-18T12:25:00Z"),
  ],
  time_windows: [
    // The agent's own draft asks for the release "by Fri 23 Oct so we can still book a driver".
    window("demo-win-458-release-by", "ord-00458", "LATEST_DAY_FOR_THE_RELEASE_TO_BOOK_A_DRIVER_FOR_MONDAY", "2026-10-23T06:30:00Z", "2026-10-23T16:00:00Z", "Europe/Berlin", "OPS", "2026-10-21T09:01:56Z"),
    // From the customer's order note: Kovellin hands the Ferrari to its own buyer the day after delivery.
    window("demo-win-458-onward", "ord-00458", "CUSTOMER_HANDS_THE_CAR_TO_ITS_OWN_BUYER", "2026-10-27T09:00:00Z", "2026-10-27T11:00:00Z", "Europe/Berlin", "CUSTOMER", "2026-10-08T15:52:00Z"),
  ],
}

// ----- CD-420442, Bentley at Orvendin Cars Stockholm (round 2) -----
// The hold itself is made up (lib/demo/scenario.ts, fact f-demo-hold, the call
// at 08:46). Added: that call as a transcript (DEMO_CALLS), the desk's written
// confirmation in Swedish, the customer's and the driver's threads in Finnish,
// the documents, the order's car details and the place's notes. The packet's
// own rows stay: Kasper's flight, hotel and ferry, the CMR, the ETA chat.
const rows442: Partial<Record<string, DemoRow[]>> = {
  conversations: [
    demo({ id: "demo-conv-442-desk", order_id: "ord-00442", category: "pickup_and_release", channel: "email", counterparty_type: "site_contact", counterparty_id: "site-083", started_at: "2026-10-21T08:52:00Z", updated_at: "2026-10-21T08:52:00Z", status: "OPEN", owner: "ops-readiness", waiting_on: "SELLER_HOLD_CLEARANCE", next_check_at: "2026-10-21T13:05:00Z" }),
    demo({ id: "demo-conv-442-customer", order_id: "ord-00442", category: "documents_and_proof", channel: "email", counterparty_type: "customer", counterparty_id: "cus-007", started_at: "2026-10-19T09:05:00Z", updated_at: "2026-10-19T09:20:00Z", status: "OPEN" }),
    demo({ id: "demo-conv-442-driver", order_id: "ord-00442", assignment_id: "asg-x039646aa3b394099", category: "driver_travel", channel: "driver_chat", counterparty_type: "driver", counterparty_id: "drv-165", started_at: "2026-10-20T16:40:00Z", updated_at: "2026-10-21T06:31:00Z", status: "OPEN" }),
  ],
  messages: [
    message("demo-msg-442-cust-1", "demo-conv-442-customer", "ord-00442", "2026-10-19T09:05:00Z", VEKARINO, desk("ops-import"), "email", "fi",
      "Hei, Orvendin lähettää meille luovutusvaltakirjan pohjan, kun kauppa on maksettu. Allekirjoitamme sen ja lähetämme teille kopion. Terveisin Ilari Venhola, hankinta, Vekarino Vehicle Group, +358 40 555 0164"),
    message("demo-msg-442-cust-2", "demo-conv-442-customer", "ord-00442", "2026-10-19T09:20:00Z", desk("ops-import"), VEKARINO, "email", "fi",
      "Kiitos, Ilari. Tarvitsemme allekirjoitetun luovutusvaltakirjan ennen kuin kuljettaja lähtee noutoon torstaina 22.10. klo 10 Ruotsin aikaa."),
    message("demo-msg-442-drv-1", "demo-conv-442-driver", "ord-00442", "2026-10-20T16:40:00Z", desk("ops-travel"), KASPER, "driver_chat", "fi",
      "Hei Kasper! Varattu: Vesper Air ke 21.10. klo 18.45 Helsingistä Tukholmaan (FL4DDCBFE8) ja yö hotelli Bracken Housessa. Nouto Orvendin Carsilta to 22.10. klo 10, lautta samana iltana klo 19 East Nordic -terminaalista, lähtöselvitys viimeistään klo 17.30 (WBV-FERRY-00442)."),
    message("demo-msg-442-drv-2", "demo-conv-442-driver", "ord-00442", "2026-10-21T06:12:00Z", KASPER, desk("ops-travel"), "driver_chat", "fi",
      "Huomenta! Kaikki selvä, lähden kentälle neljän jälkeen. Huomenna olen Orvendinilla vähän ennen kymmentä. Ovatko avaimet ja vientikilvet siellä valmiina?"),
    message("demo-msg-442-drv-3", "demo-conv-442-driver", "ord-00442", "2026-10-21T06:31:00Z", desk("ops-travel"), KASPER, "driver_chat", "fi",
      "Huomenta Kasper! Readiness-tiimi tarkistaa noudon tänään ja vahvistaa sen sinulle iltapäivällä."),
    message("demo-msg-442-desk-1", "demo-conv-442-desk", "ord-00442", "2026-10-21T08:52:00Z", ORVENDIN, desk("ops-readiness"), "email", "sv",
      "Hej! Som jag sa i telefon nyss: Bentley Continental GT till order CD-420442 står klar hos oss, men vi som säljare har lagt en spärr på bilen. Köparens faktura OV-2026-3318 från den 6 oktober är fortfarande obetald (förfallodag 20 oktober). Vi lämnar inte ut bilen förrän vår ekonomiavdelning har hävt spärren och vi har köparens undertecknade utlämningsfullmakt med Bahn som transportör. Fullmakten skickas till utlamning@orvendin.example. Vi kontrollerar inbetalningar klockan 10 och klockan 15. Syns betalningen och fullmakten vid kontrollen klockan 15 i dag kan er förare hämta bilen i morgon klockan 10 som planerat. Kommer den senare kontrollerar vi nästa gång i morgon klockan 10, och då kan bilen lämnas ut tidigast klockan 11. Föraren ska ha med legitimation och ordernumret; exportskyltarna och båda nycklarna lämnas ut tillsammans. Skicka ingen förare innan ni har hört från oss. Vänliga hälsningar, Uma Aldermere, Utlämningen, Orvendin Cars Stockholm, +46 8 555 0173"),
  ],
  order_notes: [
    note("demo-note-442-car", "ord-00442", "2026-10-18T08:50:00Z", { type: "customer", id: "cus-007" },
      "Bentley Continental GT 2024, väri Glacier White, sisusta Beluga-nahka, 12 300 km. Kaksi avainta ja huoltokirja, molemmat Orvendinin luovutustiskillä. Takapuskurissa pieni naarmu, näkyy Orvendinin kuvissa. Ostettu Orvendin Carsilta Tukholmasta; luovutusvaltakirjan allekirjoittaa meillä Ilari Venhola. Yhteyshenkilö: Ilari Venhola, hankinta, +358 40 555 0164, hankinta@vekarino.example. Vastaanottaja Tampereella: Nadia Hollowmere, lastauslaituri, Hietasädekatu 59."),
    note("demo-note-442-import", "ord-00442", "2026-10-18T09:40:00Z", { type: "operator", id: "ops-import" },
      "Import from Sweden to Finland. The seller, Orvendin Cars Stockholm, is also the pickup place: its collection desk hands the car over only against the buyer's signed release (utlämningsfullmakt) naming Bahn as carrier, and matches the VIN on it. Vekarino's invoice from Orvendin is due Tue 20 Oct. Orvendin hands out temporary export plates with the keys. Ferry booked Thu 22 Oct 19:00 Stockholm time from the East Nordic terminal (WBV-FERRY-00442, check-in by 17:30), arriving in South Finland Fri 23 Oct 17:00 Helsinki time. If the pickup slips to Friday, the Friday ferries still reach Tampere before the Mon 26 Oct 12:00 delivery; a pickup after Friday 17:00 does not, because Orvendin is closed at weekends."),
  ],
  order_endpoint_details: [
    contact("demo-ep-442-desk", "ord-00442", "site-083", "addr-00083", "2026-10-21T08:46:00Z", "Uma Aldermere",
      "collection desk (utlämningen) at Orvendin Cars Stockholm; phone +46 8 555 0173; utlamning@orvendin.example. Holds are lifted by Johan Ekwall in accounts, +46 8 555 0179",
      "Staffed collection entrance, Silverlundsvägen 24. Quote CD-420442; the desk matches the VIN against the buyer's signed release. Unstaffed 12:00 to 12:45."),
  ],
  documents: [
    doc("demo-doc-442-release", "ord-00442", "RELEASE_AUTHORITY", "MISSING", true, 0, "2026-10-18T09:40:00Z"),
    doc("demo-doc-442-regcert", "ord-00442", "REGISTRATION_CERTIFICATE_PART_2", "HELD_BY_SELLER", false, 0, "2026-10-18T09:40:00Z"),
    doc("demo-doc-442-plates", "ord-00442", "TEMPORARY_EXPORT_PLATES", "PREPARED", true, 1, "2026-10-20T13:10:00Z"),
    doc("demo-doc-442-photos", "ord-00442", "CONDITION_PHOTO", "VERIFIED", false, 12, "2026-10-19T14:02:00Z"),
  ],
  time_windows: [
    window("demo-win-442-pay-1", "ord-00442", "SELLER_PAYMENT_CHECK_HOLD_CAN_BE_LIFTED", "2026-10-21T13:00:00Z", "2026-10-21T13:15:00Z", "Europe/Stockholm", "SITE", "2026-10-21T08:46:05Z"),
    window("demo-win-442-pay-2", "ord-00442", "SELLER_PAYMENT_CHECK_HOLD_CAN_BE_LIFTED", "2026-10-22T08:00:00Z", "2026-10-22T08:15:00Z", "Europe/Stockholm", "SITE", "2026-10-21T08:46:05Z"),
    window("demo-win-442-flight", "ord-00442", "DRIVER_FLIGHT_HELSINKI_TO_STOCKHOLM", "2026-10-21T15:45:00Z", "2026-10-21T17:00:00Z", "Europe/Helsinki", "OPS", "2026-10-20T16:27:00Z"),
    window("demo-win-442-ferry", "ord-00442", "FERRY_CHECK_IN_CUTOFF_AND_DEPARTURE", "2026-10-22T15:30:00Z", "2026-10-22T17:00:00Z", "Europe/Stockholm", "OPS", "2026-10-19T11:39:00Z"),
    // Orvendin closes Fri 17:00 and is shut at weekends; a Friday ferry still makes Monday in Tampere.
    window("demo-win-442-latest", "ord-00442", "LATEST_PICKUP_THAT_KEEPS_THE_DELIVERY_PROMISE", "2026-10-23T07:00:00Z", "2026-10-23T15:00:00Z", "Europe/Stockholm", "OPS", "2026-10-21T08:49:00Z"),
  ],
}

// ----- CD-420347, Mercedes-Benz EQE at Arvelano Hamburg (fast-forward) -----
// The packet holds the five messages and the open gig. Added: the car details
// from the customer (Danish), the contacts and the place's notes. No new
// message: stock control's call back is due by 14:00 local, after "now".
const rows347: Partial<Record<string, DemoRow[]>> = {
  order_notes: [
    note("demo-note-347-car", "ord-00347", "2026-10-15T07:10:00Z", { type: "customer", id: "cus-035" },
      "Mercedes-Benz EQE 350+ 2024, farve obsidiansort, 9.800 km. To nøgler og ladekabel (type 2) i bagagerummet. Bilen skal være ladet til mindst 80 % før afhentning. Ingen kendte skader. Kontakt: Freja Lindvig, indkøb, +45 86 555 0131, indkob@tervellin.example. Modtager i Aarhus: Daniel Alderfield, lageret, Ravbuevej 54."),
  ],
  order_endpoint_details: [
    contact("demo-ep-347-desk", "ord-00347", "site-047", "addr-00047", "2026-10-21T06:42:00Z", "Phoebe Alderfield",
      "site desk at Arvelano Hamburg; phone +49 40 555 0156. Stock control: Malte Venhaus, +49 40 555 0158, calls back by 14:00 local time"),
  ],
  documents: [doc("demo-doc-347-handover", "ord-00347", "SIGNED_HANDOVER", "PREPARED", true, 0, "2026-10-15T08:01:00Z", { medium: "DIGITAL" })],
}

// ----- CD-420593, BMW M4 at Velantora Helsinki (Aino's list) -----
// The packet holds the empty pickup: Yara at the branch since 10:00, the desk's
// "similar stock reference", the customer's "do not substitute". Added after
// the agent's read at 08:55: the customer's stock person (Finnish) and Yara's
// latest message. Neither resolves where the car is.
const rows593: Partial<Record<string, DemoRow[]>> = {
  messages: [
    message("demo-msg-593-cust", "conv-x58def5b205f6ebf7", "ord-00593", "2026-10-21T08:56:00Z", PELLAVARO, desk("ops-support"), "customer_email", "fi",
      "Varastomme etsii autoa yhä. Velantoran listalla näkyvä samankaltainen varastonumero ei ole meidän BMW:mme, joten älkää missään tapauksessa luovuttako toista autoa tilalle. Palaan asiaan viimeistään klo 13. Sanni Kivelä, varasto, Pellavaro Auto, +358 40 555 0148"),
    message("demo-msg-593-yara", "conv-x58def5b205f6ebf7", "ord-00593", "2026-10-21T08:58:00Z", YARA, desk("ops-support"), "driver_chat", "en",
      "Still waiting in Velantora's car park. My train back to Jyväskylä leaves Pasila at 14:06; I make it if I leave here by 13:30. Tell me if I stay or go."),
  ],
  order_notes: [
    note("demo-note-593-car", "ord-00593", "2026-10-19T05:20:00Z", { type: "customer", id: "cus-015" },
      "BMW M4 Competition 2022, väri Isle of Man Green, 41 200 km, rekisteritunnus DEMO-FI-MRF24B. Kaksi avainta. Vasemmassa takavanteessa kiveniskemä. Auton pitäisi olla Velantora Helsingin luovutusjonossa. Yhteyshenkilö: Sanni Kivelä, varasto, +358 40 555 0148, varasto@pellavaro.example. Vastaanottaja Turussa: Eva Lumenwick, Valokaislantie 77, oma pysäköintipaikka."),
  ],
  order_endpoint_details: [
    contact("demo-ep-593-desk", "ord-00593", "site-001", "addr-00001", "2026-10-21T07:21:00Z", "Adrian Alderbrook",
      "branch desk at Velantora Helsinki; phone +358 9 555 0121. Stock control: Ville Saarinen, +358 9 555 0128"),
  ],
  documents: [doc("demo-doc-593-handover", "ord-00593", "SIGNED_HANDOVER", "PREPARED", true, 0, "2026-10-19T06:17:00Z", { medium: "DIGITAL" })],
}

// ----- CD-420516, Volvo V60 at Velantora Helsinki (Aino's list) -----
// The packet holds the threads and the agent's Finnish call with Ville
// Saarinen (car in Vantaa, ready from 12:00 Tue 27 Oct). Added: car details
// from the customer (Finnish), Ville as the contact from the call, the place's notes.
const rows516: Partial<Record<string, DemoRow[]>> = {
  order_notes: [
    note("demo-note-516-car", "ord-00516", "2026-10-14T12:10:00Z", { type: "customer", id: "cus-005" },
      "Volvo V60 T6 Recharge 2026, väri Crystal White, 6 900 km, rekisteritunnus DEMO-FI-PV2HSD. Kaksi avainta ja latauskaapeli. Ei tunnettuja vaurioita. Yhteyshenkilö: Oona Hietamäki, myynti, +358 40 555 0152, myynti@auvelloria.example. Vastaanottaja: Adrian Ivywick, Pilvirannanpolku 57, Helsinki; oma pysäköintipaikka pihalla."),
  ],
  order_endpoint_details: [
    contact("demo-ep-516-stock", "ord-00516", "site-001", "addr-00001", "2026-10-21T09:00:58Z", "Ville Saarinen",
      "stock control (varastonhallinta) at Velantora Helsinki; phone +358 9 555 0128; the keys are at the collection bay desk, no key holder named yet"),
  ],
  documents: [doc("demo-doc-516-handover", "ord-00516", "SIGNED_HANDOVER", "PREPARED", true, 0, "2026-10-17T08:05:00Z", { medium: "DIGITAL" })],
}

/** Every demo row, by the packet table it belongs to. */
export const DEMO_ROWS: Record<string, DemoRow[]> = (() => {
  const out: Record<string, DemoRow[]> = {}
  for (const part of [rows458, rows442, rows347, rows593, rows516])
    for (const [table, list] of Object.entries(part)) out[table] = [...(out[table] ?? []), ...(list ?? [])]
  return out
})()

// ---------- the agent's calls (Postgres cr_calls, written by npm run demo:reset) ----------

const turn = (at: string, speaker: "agent" | "pickup_place", text: string, translation: string) => ({ at, speaker, text, translation })

/**
 * CD-420442: the call behind the case's step "Called the collection desk at
 * Orvendin Cars Stockholm" (08:46) and its fact f-demo-hold. 458 and 516 keep
 * their recorded calls (with audio); 347 and 593 had no call by the agent.
 */
export const DEMO_CALLS: Call[] = [
  {
    id: "demo-call-442-orvendin",
    caseId: "case-ord-00442-demo",
    orderId: "ord-00442",
    placeId: "site-083",
    language: "sv",
    startedAt: "2026-10-21T08:45:02.000Z",
    outcome: "answered",
    factIds: ["f-demo-hold"],
    turns: [
      turn("2026-10-21T08:45:10.000Z", "pickup_place", "Orvendin Cars, utlämningen, Uma Aldermere.", "Orvendin Cars, collection desk, Uma Aldermere."),
      turn("2026-10-21T08:45:18.000Z", "agent",
        "Hej Uma, jag är Bahns digitala assistent. Jag ringer om upphämtningen av Bentley Continental GT på order CD-420442 i morgon, torsdag, klockan tio. Är bilen klar att lämnas ut?",
        "Hi Uma, I'm Bahn's digital assistant. I'm calling about the pickup of the Bentley Continental GT on order CD-420442 tomorrow, Thursday, at ten. Is the car ready to be handed over?"),
      turn("2026-10-21T08:45:34.000Z", "pickup_place",
        "Bilen står klar, men vi som säljare har lagt en spärr på den. Köparens faktura är fortfarande obetald, så vi lämnar inte ut den förrän spärren är hävd och vi har en undertecknad utlämningsfullmakt här.",
        "The car is ready, but as the seller we have put a hold on it. The buyer's invoice is still unpaid, so we won't hand it over until the hold is lifted and we have a signed release here."),
      turn("2026-10-21T08:45:52.000Z", "agent", "Tack. Vem häver spärren, och vem ska skriva under fullmakten?", "Thank you. Who lifts the hold, and who has to sign the release?"),
      turn("2026-10-21T08:46:05.000Z", "pickup_place",
        "Vår ekonomiavdelning, Johan Ekwall, häver den när betalningen syns hos oss. Vi kontrollerar inbetalningar klockan tio och klockan femton. Fullmakten skriver köparen under, Vekarino, med Bahn som transportör, och den skickas till utlamning@orvendin.example.",
        "Our accounts department, Johan Ekwall, lifts it once the payment shows on our side. We check incoming payments at ten and at three. The buyer, Vekarino, signs the release naming Bahn as carrier, and it goes to utlamning@orvendin.example."),
      turn("2026-10-21T08:46:20.000Z", "agent",
        "Om betalningen och fullmakten kommer i dag, kan föraren hämta bilen i morgon klockan tio som planerat?",
        "If the payment and the release arrive today, can the driver collect the car tomorrow at ten as planned?"),
      turn("2026-10-21T08:46:31.000Z", "pickup_place",
        "Ja, om det syns vid kontrollen klockan femton. Kommer det senare kontrollerar vi nästa gång i morgon klockan tio, och då kan bilen lämnas ut tidigast klockan elva. Skicka ingen förare innan ni har hört från oss.",
        "Yes, if it shows at the three o'clock check. If it comes later, we check next tomorrow at ten, and then the car can go out at eleven at the earliest. Don't send a driver before you have heard from us."),
      turn("2026-10-21T08:46:44.000Z", "agent",
        "Uppfattat: spärr tills betalningen syns, köparens undertecknade fullmakt till utlamning@orvendin.example, kontroller klockan tio och femton. Jag återkommer. Tack, Uma.",
        "Understood: a hold until the payment shows, the buyer's signed release to utlamning@orvendin.example, checks at ten and three. I'll get back to you. Thank you, Uma."),
    ],
  },
]
