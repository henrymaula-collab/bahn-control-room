import type { Call } from "../types"
import { today } from "./clock"

// The agent's calls. The phone is simulated; the voices are rendered by the agent
// workstream into public/calls/<id>.mp3. Until a file exists the screen says so.

export const CALLS: Call[] = [
  {
    id: "call-458",
    caseId: "case-420458",
    orderId: "ord-00458",
    placeId: "site-042",
    language: "de",
    startedAt: today("11:36"),
    outcome: "answered",
    audioUrl: "/calls/call-9x56kmpv1.mp3",
    factIds: ["f458-1", "f458-2"],
    turns: [
      {
        speaker: "agent",
        at: today("11:36"),
        text: "Guten Tag, hier ist der Readiness-Agent von Bahn. Ich rufe wegen des Ferrari Roma an, Auftrag CD-420458. Können wir den Wagen am Montag abholen?",
        translation: "Hello, this is Bahn's Readiness agent. I'm calling about the Ferrari Roma, order CD-420458. Can we collect the car on Monday?",
      },
      {
        speaker: "pickup_place",
        at: today("11:37"),
        text: "Der Wagen steht bei uns. Aber der Verkäufer hat die Übergabe gestoppt, solange die Rechnung offen ist.",
        translation: "The car is here. But the seller has stopped the handover while the invoice is unpaid.",
      },
      {
        speaker: "agent",
        at: today("11:38"),
        text: "Liegt Ihnen eine unterschriebene Freigabe für das Fahrzeug vor?",
        translation: "Do you have a signed release for the car?",
      },
      {
        speaker: "pickup_place",
        at: today("11:38"),
        text: "Nein, keine. Bitte schicken Sie keinen Fahrer, auch wenn die alte Abholnotiz noch sichtbar ist. Wir geben den Wagen erst heraus, wenn der Verkäufer die Sperre aufhebt und eine unterschriebene Freigabe schickt.",
        translation: "No, none. Please do not send a driver, even if the old collection note is still visible. We only release the car once the seller lifts the hold and sends a signed release.",
      },
      {
        speaker: "agent",
        at: today("11:39"),
        text: "Verstanden. Wir klären das mit dem Kunden und melden uns innerhalb einer Stunde wieder bei Ihnen.",
        translation: "Understood. We'll sort it out with the customer and get back to you within the hour.",
      },
      {
        speaker: "pickup_place",
        at: today("11:39"),
        text: "Gut, danke. Auf Wiederhören.",
        translation: "Good, thank you. Goodbye.",
      },
    ],
  },
  {
    id: "call-516",
    caseId: "case-420516",
    orderId: "ord-00516",
    placeId: "site-001",
    language: "en",
    startedAt: today("11:22"),
    outcome: "answered",
    audioUrl: "/calls/call-516.mp3",
    factIds: ["f516-1", "f516-2"],
    turns: [
      { speaker: "agent", at: today("11:22"), text: "Hello, this is Bahn's Readiness agent, calling about the Volvo V60 on order CD-420516. Who should our driver ask for the keys on Monday?" },
      { speaker: "pickup_place", at: today("11:23"), text: "Reception does not have the keys for this car. And the side gate is only for vehicles coming in, it is not a collection desk." },
      { speaker: "agent", at: today("11:23"), text: "Can you see who holds the car in your stock system?" },
      { speaker: "pickup_place", at: today("11:24"), text: "It says warehouse transfer, but there is no name. Stock control has to check it. Please hold the driver until they do." },
      { speaker: "agent", at: today("11:24"), text: "Thank you. We'll hold the driver and get back to you within the hour." },
    ],
  },
  { id: "call-015a", caseId: "case-420015", orderId: "ord-00015", placeId: "site-005", language: "fi", startedAt: today("11:40"), outcome: "no_answer", turns: [], factIds: [] },
  { id: "call-015b", caseId: "case-420015", orderId: "ord-00015", placeId: "site-005", language: "fi", startedAt: today("11:52"), outcome: "no_answer", turns: [], factIds: ["f015-1"] },
]
