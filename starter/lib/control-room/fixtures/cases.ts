import type { Case } from "../types"
import type { Draft } from "../views"
import { hel, today } from "./clock"

// Readiness cases built from real orders in the dataset. Facts quote the
// dataset's own messages and records; the agent's calls are the simulated
// phone (see calls.ts). Times are Helsinki wall time on Wed 21 Oct 2026.

export const CASES: Case[] = [
  // 1. Aino: the seller holds a Ferrari at a German pickup place. Has a call in German.
  {
    id: "case-420458",
    orderId: "ord-00458",
    desk: "ops-readiness",
    type: "readiness.release_document_missing",
    headline: "The seller has put the Ferrari Roma on hold at Calverona Hamburg.",
    decideBy: today("13:00"),
    reasons: ["papers_missing", "needs_the_customer"],
    facts: [
      {
        id: "f458-1",
        statement: "The car is at the branch, but the seller has stopped the handover until an invoice is paid.",
        source: { kind: "pickup_place", name: "Calverona Hamburg, branch desk", channel: "call", at: today("11:38") },
        strength: "confirmed",
      },
      {
        id: "f458-2",
        statement: "The branch will refuse the handover until the seller clears the hold and sends a signed release.",
        source: { kind: "pickup_place", name: "Calverona Hamburg, branch desk", channel: "call", at: today("11:39") },
        strength: "confirmed",
      },
      {
        id: "f458-3",
        statement: "No signed release document is on the order.",
        source: { kind: "record", name: "Documents", channel: "record", recordRef: "documents:doc-0262", at: hel("2026-10-19", "13:59") },
        strength: "confirmed",
      },
      {
        id: "f458-4",
        statement: "The customer asked the seller for the release. It might come in the afternoon, but they could not promise it.",
        source: { kind: "customer", name: "Kovellin Automobilhandel", channel: "email", at: hel("2026-10-19", "14:32") },
        strength: "stale",
      },
      {
        id: "f458-5",
        statement: "No pickup slot is booked and no driver has seen a gig. The customer can hand over from Mon 26 Oct.",
        source: { kind: "record", name: "Order", channel: "record", recordRef: "time_windows:win-x7a4e5ec0950a4ec7", at: hel("2026-10-18", "15:25") },
        strength: "confirmed",
      },
    ],
    agentSteps: [
      { at: today("11:30"), kind: "read", summary: "Read the order, Calverona's pickup rules and two email threads with Kovellin." },
      { at: today("11:31"), kind: "lookup", summary: "Checked the documents. No signed release is on file.", factIds: ["f458-3"] },
      { at: today("11:36"), kind: "call", summary: "Called Calverona Hamburg in German. The branch desk answered.", callId: "call-458", factIds: ["f458-1", "f458-2"] },
      { at: today("11:40"), kind: "propose", summary: "Stopped here: clearing the hold needs the customer." },
    ],
    suggestion: {
      id: "o458-email",
      label: "Email Kovellin to clear the seller's hold",
      effect: "The agent sends the email and keeps the pickup unbooked. When the release arrives, it checks it with Calverona before any driver is booked.",
      changes: [{ kind: "customer_message", detail: "An email to Kovellin Automobilhandel, in German, from the Readiness desk." }],
    },
    alternatives: [
      {
        id: "o458-wednesday",
        label: "Plan the pickup for Wed 28 Oct instead",
        effect: "Gives the seller two more days. Kovellin has to agree to the later delivery date.",
        changes: [
          { kind: "date", detail: "Pickup moves from Mon 26 Oct to Wed 28 Oct, 10:00–13:00 in Hamburg." },
          { kind: "date", detail: "Delivery moves from Mon 26 Oct to Wed 28 Oct." },
          { kind: "customer_message", detail: "An email to Kovellin asking them to agree to the new dates." },
        ],
      },
      {
        id: "o458-mine",
        label: "I'll handle it myself",
        effect: "The case stays yours. The agent does nothing more on it until you hand it back.",
        changes: [{ kind: "none", detail: "Nothing is sent and nothing is booked." }],
      },
    ],
    status: "waiting_for_person",
    routedTo: {
      personId: "aino",
      why: "Sent to you because you are the one on shift who has handled release documents at German pickup places, 8 since August.",
      mode: "only_one_on_shift",
      at: today("11:40"),
    },
    placeId: "site-042",
    customerId: "cus-030",
    lessonIdsUsed: ["lesson-kovellin-german"],
    createdAt: today("11:40"),
  },

  // 2. Sofie: nobody can say who holds the keys.
  {
    id: "case-420516",
    orderId: "ord-00516",
    desk: "ops-readiness",
    type: "readiness.keys_or_access",
    headline: "Velantora Helsinki cannot say who has the keys for the Volvo V60.",
    decideBy: today("12:15"),
    reasons: ["facts_disagree", "needs_the_customer"],
    facts: [
      {
        id: "f516-1",
        statement: "Reception does not have the keys, and the side gate is only a vehicle entrance, not a handover desk.",
        source: { kind: "pickup_place", name: "Velantora Helsinki, site desk", channel: "call", at: today("11:24") },
        strength: "confirmed",
      },
      {
        id: "f516-2",
        statement: "The stock screen lists a warehouse transfer but no person who can release the car. Stock control will call back, with no time given.",
        source: { kind: "pickup_place", name: "Velantora Helsinki, site desk", channel: "call", at: today("11:24") },
        strength: "confirmed",
      },
      {
        id: "f516-3",
        statement: "The customer's pickup note says to use the side gate.",
        source: { kind: "customer", name: "Auvelloria Motor Collection", channel: "record", recordRef: "order_notes:note-x7b4b75e5977108cd", at: hel("2026-10-18", "13:44") },
        strength: "stale",
      },
      {
        id: "f516-4",
        statement: "The customer said reception has the keys.",
        source: { kind: "customer", name: "Auvelloria Motor Collection", channel: "message", at: hel("2026-10-19", "13:44") },
        strength: "stale",
      },
      {
        id: "f516-5",
        statement: "The customer asked again this morning whether the key desk is confirmed.",
        source: { kind: "customer", name: "Auvelloria Motor Collection", channel: "message", at: today("10:54") },
        strength: "stated",
      },
    ],
    agentSteps: [
      { at: today("11:19"), kind: "read", summary: "Read the order, the customer's pickup note and both chats with Auvelloria." },
      { at: today("11:20"), kind: "lookup", summary: "Saw that the note and the chat point to two different places for the keys.", factIds: ["f516-3", "f516-4"] },
      { at: today("11:22"), kind: "call", summary: "Called Velantora Helsinki. The site desk answered.", callId: "call-516", factIds: ["f516-1", "f516-2"] },
      { at: today("11:26"), kind: "propose", summary: "Stopped here: only the customer can name the key holder." },
    ],
    suggestion: {
      id: "o516-ask",
      label: "Ask Auvelloria to name the key holder",
      effect: "The agent sends the message and keeps the driver on hold. When Auvelloria answers, it calls Velantora to confirm the name.",
      changes: [{ kind: "customer_message", detail: "A chat message to Auvelloria Motor Collection." }],
    },
    alternatives: [
      {
        id: "o516-wait",
        label: "Wait for stock control until 14:00",
        effect: "Nothing is sent. The agent calls Velantora again at 14:00 if nobody has called back.",
        changes: [{ kind: "none", detail: "Nothing changes on the order." }],
      },
      {
        id: "o516-mine",
        label: "I'll handle it myself",
        effect: "The case stays yours. The agent does nothing more on it until you hand it back.",
        changes: [{ kind: "none", detail: "Nothing is sent and nothing is booked." }],
      },
    ],
    status: "waiting_for_person",
    routedTo: {
      personId: "sofie",
      why: "Sent to you because you have handled 6 key questions at Velantora Helsinki since August.",
      mode: "best_record",
      at: today("11:26"),
    },
    placeId: "site-001",
    customerId: "cus-005",
    lessonIdsUsed: ["lesson-velantora-stock"],
    createdAt: today("11:26"),
  },

  // 3. Mikko: showroom or yard, and the gig is still posted.
  {
    id: "case-420347",
    orderId: "ord-00347",
    desk: "ops-readiness",
    type: "readiness.facts_disagree",
    headline: "Arvelano Hamburg cannot say where the EQE is, and its gig is still posted.",
    decideBy: today("12:10"),
    reasons: ["facts_disagree", "costs_extra_money"],
    facts: [
      {
        id: "f347-1",
        statement: "The booking says showroom handover, the handover sheet says the nearby yard. Nobody can confirm where the car or its keys are.",
        source: { kind: "pickup_place", name: "Arvelano Hamburg, site desk", channel: "call", at: today("09:42") },
        strength: "confirmed",
      },
      {
        id: "f347-2",
        statement: "Stock control will call back by 15:00 (14:00 in Hamburg).",
        source: { kind: "pickup_place", name: "Arvelano Hamburg, site desk", channel: "call", at: today("09:42") },
        strength: "stated",
      },
      {
        id: "f347-3",
        statement: "The €456 gig is posted in the driver app. No driver has booked it yet.",
        source: { kind: "record", name: "Driver marketplace", channel: "record", recordRef: "market_offers:offer-xd48500b8f7b43193", at: hel("2026-10-15", "21:32") },
        strength: "confirmed",
      },
      {
        id: "f347-4",
        statement: "The pickup slot is Fri 23 Oct, 12:00–14:00 (11:00–13:00 in Hamburg).",
        source: { kind: "record", name: "Order", channel: "record", at: hel("2026-10-15", "14:05") },
        strength: "confirmed",
      },
    ],
    agentSteps: [
      { at: today("11:44"), kind: "read", summary: "Read the order, the open gig and the morning call notes." },
      { at: today("11:46"), kind: "lookup", summary: "Checked the driver app. The gig is still visible to drivers.", factIds: ["f347-3"] },
      { at: today("11:48"), kind: "propose", summary: "Stopped here: withdrawing a gig changes a booking." },
    ],
    suggestion: {
      id: "o347-withdraw",
      label: "Withdraw the gig until stock control calls back",
      effect: "Drivers stop seeing the gig. The agent calls Arvelano after 15:00 and brings the gig back to you once the place is confirmed.",
      changes: [{ kind: "booking", detail: "The €456 gig is withdrawn from the driver app. Nobody has booked it, so no driver loses a gig." }],
    },
    alternatives: [
      {
        id: "o347-keep",
        label: "Keep the gig posted",
        effect: "A driver could book the gig before the pickup place is confirmed.",
        changes: [{ kind: "none", detail: "Nothing changes on the order." }],
      },
      {
        id: "o347-mine",
        label: "I'll handle it myself",
        effect: "The case stays yours. The agent does nothing more on it until you hand it back.",
        changes: [{ kind: "none", detail: "Nothing is sent and nothing is booked." }],
      },
    ],
    status: "waiting_for_person",
    routedTo: {
      personId: "mikko",
      why: "Sent to you because you have withdrawn 4 gigs at Hamburg pickup places since September.",
      mode: "best_record",
      at: today("11:48"),
    },
    placeId: "site-047",
    customerId: "cus-035",
    createdAt: today("11:48"),
  },

  // 4. Jonas: empty pickup, the driver is still waiting.
  {
    id: "case-420593",
    orderId: "ord-00593",
    desk: "ops-readiness",
    type: "readiness.car_not_ready",
    headline: "Yara has waited two hours at Velantora Helsinki and the BMW M4 is not there.",
    decideBy: today("12:20"),
    reasons: ["costs_extra_money", "needs_the_customer"],
    facts: [
      {
        id: "f593-1",
        statement: "The car is not in the release queue. The desk sees a similar stock reference but will not hand it over.",
        source: { kind: "pickup_place", name: "Velantora Helsinki, site desk", channel: "call", at: today("10:21") },
        strength: "confirmed",
      },
      {
        id: "f593-2",
        statement: "Yara wrote: \"I can wait another 30 minutes. After that I need a new plan for my travel back.\" Nobody has written back since.",
        source: { kind: "driver", name: "Driver Yara Sivellin", channel: "app", at: today("10:57") },
        strength: "stated",
      },
      {
        id: "f593-3",
        statement: "The customer's system still lists this branch. They are asking their stock team and do not want a different car.",
        source: { kind: "customer", name: "Pellavaro Auto", channel: "email", at: today("10:39") },
        strength: "stated",
      },
      {
        id: "f593-4",
        statement: "Yara's gig fee is €134.",
        source: { kind: "record", name: "Driver marketplace", channel: "record", at: hel("2026-10-20", "01:51") },
        strength: "confirmed",
      },
    ],
    agentSteps: [
      { at: today("11:58"), kind: "read", summary: "Read the attempted pickup, the chat with Yara and the email from Pellavaro." },
      { at: today("11:59"), kind: "lookup", summary: "Saw that Yara's 30 minutes ran out at 11:27." , factIds: ["f593-2"] },
      { at: today("12:00"), kind: "propose", summary: "Stopped here: releasing Yara costs extra money." },
    ],
    suggestion: {
      id: "o593-release",
      label: "Release Yara and pay it as an empty pickup",
      effect: "Yara gets a message in the driver app and heads home. The agent asks Velantora and Pellavaro which place really holds this car before a new pickup is planned.",
      changes: [
        { kind: "driver_message", detail: "Message to Yara: thanks for waiting, please head back, this gig is paid as an empty pickup." },
        { kind: "cost", detail: "Yara's €134 fee is paid for an empty pickup.", amountEur: 134 },
      ],
    },
    alternatives: [
      {
        id: "o593-wait",
        label: "Ask Yara to wait until 12:30",
        effect: "Yara waits. If the car is not found by 12:30, this comes back to you.",
        changes: [{ kind: "driver_message", detail: "Message to Yara: please wait until 12:30, the customer's stock team is checking." }],
      },
      {
        id: "o593-mine",
        label: "I'll handle it myself",
        effect: "The case stays yours. The agent does nothing more on it until you hand it back.",
        changes: [{ kind: "none", detail: "Nothing is sent and nothing is booked." }],
      },
    ],
    status: "waiting_for_person",
    routedTo: {
      personId: "jonas",
      why: "Sent to you because you have handled 5 empty pickups at Velantora Helsinki since August.",
      mode: "best_record",
      at: today("12:00"),
    },
    placeId: "site-001",
    customerId: "cus-015",
    createdAt: today("12:00"),
  },

  // 5. Aino: the pickup place does not answer, the pickup is tomorrow.
  {
    id: "case-420015",
    orderId: "ord-00015",
    desk: "ops-readiness",
    type: "readiness.no_answer",
    headline: "Mervikko Espoo has not confirmed who releases the BMW i4 tomorrow.",
    decideBy: today("14:00"),
    reasons: ["pickup_place_not_answering", "needs_the_customer"],
    facts: [
      {
        id: "f015-1",
        statement: "Nobody answered at Mervikko Espoo, twice.",
        source: { kind: "agent", name: "Readiness agent", channel: "call", at: today("11:52") },
        strength: "confirmed",
      },
      {
        id: "f015-2",
        statement: "The release contact on the order form, Elena Alderbrook, has never been confirmed by the branch.",
        source: { kind: "record", name: "Order form", channel: "record", at: hel("2026-10-16", "11:45") },
        strength: "stated",
      },
      {
        id: "f015-3",
        statement: "The customer has asked twice. This morning: \"We still have no name from the branch.\"",
        source: { kind: "customer", name: "Suvellio Motors", channel: "message", at: today("10:52") },
        strength: "stated",
      },
      {
        id: "f015-4",
        statement: "Pickup is tomorrow, Thu 22 Oct, 11:00–13:00. Delivery is promised the same day, 13:00–15:00.",
        source: { kind: "record", name: "Order", channel: "record", at: hel("2026-10-16", "11:45") },
        strength: "confirmed",
      },
    ],
    agentSteps: [
      { at: today("11:38"), kind: "read", summary: "Read the order and the WhatsApp thread with Suvellio." },
      { at: today("11:40"), kind: "call", summary: "Called Mervikko Espoo. No answer.", callId: "call-015a" },
      { at: today("11:44"), kind: "message", summary: "Emailed the branch desk and asked who releases the car." },
      { at: today("11:52"), kind: "call", summary: "Called Mervikko Espoo again. No answer.", callId: "call-015b", factIds: ["f015-1"] },
      { at: today("11:53"), kind: "propose", summary: "Stopped here: the customer is waiting for an answer from us." },
    ],
    suggestion: {
      id: "o015-reply",
      label: "Tell Suvellio we are still calling the branch",
      effect: "The agent sends the reply and calls Mervikko again at 13:00. If nobody answers by 14:00, this comes back to you with the option to move the pickup.",
      changes: [{ kind: "customer_message", detail: "A WhatsApp reply to Suvellio Motors." }],
    },
    alternatives: [
      {
        id: "o015-friday",
        label: "Move the pickup to Fri 23 Oct",
        effect: "Gives the branch a day to answer. Suvellio has to agree to the later delivery.",
        changes: [
          { kind: "date", detail: "Pickup moves from Thu 22 Oct to Fri 23 Oct, 11:00–13:00." },
          { kind: "date", detail: "Delivery moves from Thu 22 Oct to Fri 23 Oct." },
          { kind: "customer_message", detail: "A WhatsApp message to Suvellio asking them to agree." },
        ],
      },
      {
        id: "o015-mine",
        label: "I'll handle it myself",
        effect: "The case stays yours. The agent does nothing more on it until you hand it back.",
        changes: [{ kind: "none", detail: "Nothing is sent and nothing is booked." }],
      },
    ],
    status: "waiting_for_person",
    routedTo: {
      personId: "aino",
      why: "Sent to you because you have handled 4 unanswered calls at Mervikko Espoo since September.",
      mode: "best_record",
      at: today("11:53"),
    },
    placeId: "site-005",
    customerId: "cus-013",
    createdAt: today("11:53"),
  },

  // 6. Agent still working: second car of a two-car gig, who holds Tuesday's keys.
  {
    id: "case-420384",
    orderId: "ord-00384",
    desk: "ops-readiness",
    type: "readiness.keys_or_access",
    headline: "The agent is asking Tervavio Tampere who holds the second Golf's keys on Tuesday.",
    reasons: ["car_not_ready"],
    facts: [
      {
        id: "f384-1",
        statement: "Hanna, who drives both Golfs, asked who confirms Tuesday's keys. No overnight custody has been agreed.",
        source: { kind: "driver", name: "Driver Hanna Wenverin", channel: "app", at: today("11:57") },
        strength: "stated",
      },
    ],
    agentSteps: [
      { at: today("11:58"), kind: "call", summary: "Called Tervavio Tampere. The site desk is checking and calls back before 15:00." },
      { at: today("11:59"), kind: "wait", summary: "Waiting for the call back." },
    ],
    suggestion: { id: "o384-wait", label: "Wait for Tervavio's call back", effect: "The agent confirms the key holder with the driver.", changes: [{ kind: "none", detail: "Nothing changes." }] },
    alternatives: [],
    status: "agent_working",
    placeId: "site-034",
    customerId: "cus-019",
    createdAt: today("11:58"),
  },

  // 7. Agent still working: no direct contact at the pickup place.
  {
    id: "case-420010",
    orderId: "ord-00010",
    desk: "ops-readiness",
    type: "readiness.no_answer",
    headline: "The agent is getting a direct contact at Kervalin Frankfurt for the E-Class.",
    reasons: ["pickup_place_not_answering"],
    facts: [],
    agentSteps: [
      { at: today("11:12"), kind: "call", summary: "Called the Kervalin switchboard. They will send the branch contact by email." },
      { at: today("11:13"), kind: "wait", summary: "Waiting for the email. The agent calls again at 14:00 if it has not come." },
    ],
    suggestion: { id: "o010-wait", label: "Wait for the contact", effect: "The agent confirms who releases the keys.", changes: [{ kind: "none", detail: "Nothing changes." }] },
    alternatives: [],
    status: "agent_working",
    customerId: "cus-026",
    createdAt: today("11:12"),
  },

  // 8. Handled by the agent alone, under a trust rule the shift lead turned on.
  {
    id: "case-421022",
    orderId: "ord-01022",
    desk: "ops-readiness",
    type: "readiness.fee_requested",
    headline: "Arvellumio Vehicle Hub asked for a €35 storage fee for the S-Class. The agent accepted it.",
    reasons: ["costs_extra_money"],
    facts: [
      {
        id: "f1022-1",
        statement: "The hub asks €35 for storage before it releases the car on Mon 26 Oct.",
        source: { kind: "pickup_place", name: "Arvellumio Vehicle Hub Hamburg", channel: "call", at: today("10:05") },
        strength: "confirmed",
      },
    ],
    agentSteps: [
      { at: today("10:05"), kind: "call", summary: "Called Arvellumio Vehicle Hub Hamburg to confirm Monday's pickup." },
      { at: today("10:07"), kind: "propose", summary: "Accepted the €35 fee and confirmed the pickup, under the rule Kaisa turned on." },
    ],
    suggestion: {
      id: "o1022-accept",
      label: "Accept the €35 fee and confirm the pickup",
      effect: "The pickup on Mon 26 Oct is confirmed with the hub.",
      changes: [{ kind: "cost", detail: "€35 storage fee, paid at pickup.", amountEur: 35 }],
    },
    alternatives: [],
    status: "handled_by_agent",
    placeId: "site-074",
    customerId: "cus-052",
    createdAt: today("10:07"),
  },
]

/** Messages the agent drafted, in the recipient's language, with an English line. */
export const DRAFTS: Record<string, Draft> = {
  "o458-email": {
    to: "Kovellin Automobilhandel, by email",
    language: "de",
    text: "Guten Tag, Calverona Hamburg gibt den Ferrari Roma (CD-420458) nicht heraus: Der Verkäufer hat die Übergabe gestoppt, bis eine Rechnung bezahlt ist, und eine unterschriebene Freigabe fehlt. Können Sie die Sperre mit dem Verkäufer klären und uns die unterschriebene Freigabe schicken? Wir buchen erst dann einen Fahrer.",
    translation: "Hello, Calverona Hamburg will not release the Ferrari Roma (CD-420458): the seller has stopped the handover until an invoice is paid, and a signed release is missing. Could you clear the hold with the seller and send us the signed release? We will only book a driver after that.",
  },
  "o458-wednesday": {
    to: "Kovellin Automobilhandel, by email",
    language: "de",
    text: "Guten Tag, solange die Sperre des Verkäufers besteht, verschieben wir die Abholung des Ferrari Roma (CD-420458) auf Mittwoch, 28. Oktober. Sind Sie mit der Lieferung am selben Tag einverstanden?",
    translation: "Hello, while the seller's hold is in place we are moving the Ferrari Roma's pickup (CD-420458) to Wednesday 28 October. Do you agree to delivery on the same day?",
  },
  "o516-ask": {
    to: "Auvelloria Motor Collection, in the support chat",
    language: "en",
    text: "Velantora Helsinki checked the Volvo V60 (CD-420516): reception has no keys and the side gate is not a handover desk. Could you tell us who will hand over the car and keys on Mon 26 Oct? The pickup slot stays as it is, and we will not send a driver until the name is confirmed.",
  },
  "o593-release": {
    to: "Yara Sivellin, in the driver app",
    language: "fi",
    text: "Kiitos kun odotit, Yara. Autoa ei löydy tänään, joten voit lähteä takaisin. Tämä keikka maksetaan tyhjänä noutona.",
    translation: "Thanks for waiting, Yara. The car cannot be found today, so you can head back. This gig is paid as an empty pickup.",
  },
  "o593-wait": {
    to: "Yara Sivellin, in the driver app",
    language: "fi",
    text: "Voitko odottaa vielä klo 12.30 asti? Asiakkaan varastotiimi tarkistaa, missä auto on.",
    translation: "Can you wait until 12:30? The customer's stock team is checking where the car is.",
  },
  "o015-reply": {
    to: "Suvellio Motors, on WhatsApp",
    language: "en",
    text: "Mervikko Espoo has not answered our two calls today, and we have emailed the branch desk. We call again at 13:00 and will write to you by 14:00. Tomorrow's pickup stays booked for now.",
  },
  "o015-friday": {
    to: "Suvellio Motors, on WhatsApp",
    language: "en",
    text: "Mervikko Espoo has not confirmed who releases the BMW i4. We suggest moving the pickup and the delivery to Fri 23 Oct. Is that all right with you?",
  },
}

/** Three likely reasons per alternative, phrased as rules someone could reuse. */
export const WHY_CHOICES: Record<string, string[]> = {
  "o458-wednesday": [
    "Kovellin has already asked the seller twice. A third email will not move it.",
    "Seller holds over an unpaid invoice take more than a working day to clear.",
    "A later date the customer agrees to is better than a pickup that may fail.",
  ],
  "o458-mine": [
    "Seller holds need a phone call with the customer, not an email.",
    "I know the people at Kovellin and can sort it faster myself.",
    "The email draft says too much about the seller's invoice.",
  ],
  "o516-wait": [
    "Velantora's stock control usually calls back within two hours.",
    "Auvelloria has been asked enough. Do not ask the customer again before the pickup place answers.",
    "The pickup is on Monday, so there is time to wait today.",
  ],
  "o516-mine": [
    "This needs a call with the customer, not a chat message.",
    "I know who to ask at Velantora.",
    "The message says too much about the pickup place's own mistake.",
  ],
  "o347-keep": [
    "Withdrawing and posting a gig again makes the price go up.",
    "Stock control answers before any driver could reach Hamburg.",
    "Drivers who book early can be told to wait. Losing them costs more.",
  ],
  "o347-mine": [
    "I want to call Arvelano's stock control myself.",
    "The customer should hear about this from a person first.",
    "The gig price needs a look before anything changes.",
  ],
  "o593-wait": [
    "The customer's stock team found cars within the hour before.",
    "A second pickup trip costs more than 30 more minutes.",
    "Yara offered to wait, so ask again before paying an empty pickup.",
  ],
  "o593-mine": [
    "Yara has waited long enough. I want to talk to Yara myself.",
    "The empty pickup fee needs the customer's agreement first.",
    "This BMW may be at another branch. I know which one.",
  ],
  "o015-friday": [
    "A branch that does not answer the day before will not be ready tomorrow.",
    "Suvellio has asked twice. They prefer a sure date over waiting.",
    "Electric cars at Mervikko need the charging cable checked, which takes a day.",
  ],
  "o015-mine": [
    "I know someone at Mervikko who answers their mobile.",
    "The customer should hear this from a person after two days of waiting.",
    "The reply promises a time we cannot keep.",
  ],
}
