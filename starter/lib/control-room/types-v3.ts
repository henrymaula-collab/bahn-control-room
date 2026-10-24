// Contract for the v3 platform (Overview map, Your tasks lists, the situation panel).
// The engine serves these shapes; the UI builds on fixtures of the same shapes.
// Words in every string follow design/BAHN-VOCABULARY.md.
import type { CaseStatus } from "./types";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Green on the map = on_plan, red = needs_person. */
export type CarState = "on_plan" | "needs_person" | "agent_working";

export type PositionSource = "tracking" | "estimated" | "at_pickup" | "at_delivery";

/** One car on the road today, one dot on the Overview map. */
export interface MapCar {
  orderId: string;
  reference: string; // "CD-420458"
  vehicle: string; // "Ferrari Roma"
  state: CarState;
  position: LatLng;
  positionSource: PositionSource;
  from: string; // pickup place, Bahn's words ("Calverona Hamburg")
  to: string; // delivery city or place
  caseId?: string; // set whenever the order has a case; a red car's case opens in Your tasks
  nextAt?: string; // ISO; decideBy for red cars, estimated delivery otherwise
  reason?: string; // red cars only: why, in a few of Bahn's words ("Ferry sold out", "Release document missing")
}

/** One row in the Your tasks list. */
export interface WorkRow {
  caseId: string;
  orderId: string;
  vehicle: string;
  place: string; // pickup place short name
  decideBy?: string;
  status: CaseStatus;
}

export interface Overview {
  now: string;
  counts: {
    carsToday: number;
    onTheRoad: number;
    needsPerson: number; // whole team
    needYou: number; // the signed-in person
    agentWorking: number;
    handledByAgentToday: number;
  };
  cars: MapCar[];
  needYou: WorkRow[]; // most urgent first
}

export interface WorkLists {
  needYou: WorkRow[];
  agentWorking: WorkRow[];
  doneToday: WorkRow[];
}

/** A label and a value, shown as two columns. Never a sentence. */
export interface KeyFact {
  label: string; // "Stopped"
  value: string; // "Pickup place not answering"
}

export interface Stop {
  place: string;
  city: string;
  country: string;
  position: LatLng;
  window?: { from: string; to: string };
  booked: boolean;
}

/** What "The situation ›" opens in the side panel. */
export interface Situation {
  orderId: string;
  reference: string;
  vehicle: string;
  pickup: Stop;
  delivery: Stop & { estimatedDelivery?: string };
  driver?: string; // first name; absent when nobody is assigned
  waitingOn?: KeyFact; // { label: "Waiting", value: "Kovellin, the customer" }
  facts: KeyFact[]; // at most 5
}

/** Added to GET /api/cr/cases/:id next to the existing fields. */
export interface CaseV3Extras {
  why: KeyFact[]; // at most 3: Stopped, Needs, Yours
  situation: Situation;
  /** One line under the primary button: what the agent does after a yes ("The agent then calls the
   *  pickup place back on Thursday ..."). Only while the case waits for a person, and only when true. */
  next?: string;
}
