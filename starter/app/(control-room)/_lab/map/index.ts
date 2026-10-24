// Slot `map`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// The variants share one engine, ./kit (CarMap with options, the two pin cards, the paper style).
import type { SlotRegistry } from "../context"
import { CarMap } from "../../_ui/car-map"
import { PinCard } from "../../_ui/overview-view"
import { CardAsk, CardWhy } from "./kit/cards"
import { HaloMap } from "./01-halo/halo"
import { AsphaltMap } from "./02-asphalt/asphalt"
import { YoursMap } from "./03-yours/yours"
import { ArrivalMap } from "./04-arrival/arrival"
import { AgentAtWorkMap } from "./05-agent-at-work/agent-at-work"
import { KeyOnMapMap } from "./06-key-on-map/key-on-map"
import { PaperMap } from "./07-paper/paper"
import { FlyToMap } from "./08-fly-to/fly-to"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { CarMap, PinCard } },
  "01": { slug: "halo", title: "A halo on every red dot", parts: { CarMap: HaloMap, PinCard: CardAsk } },
  "02": { slug: "asphalt", title: "Bahn's asphalt map", parts: { CarMap: AsphaltMap, PinCard: CardAsk } },
  "03": { slug: "yours", title: "Your cases are the big dots", parts: { CarMap: YoursMap, PinCard: CardAsk } },
  "04": { slug: "arrival", title: "The map arrives", parts: { CarMap: ArrivalMap, PinCard: CardAsk } },
  "05": { slug: "agent-at-work", title: "The agent's cars take turns", parts: { CarMap: AgentAtWorkMap, PinCard: CardAsk } },
  "06": { slug: "key-on-map", title: "The key on the map, as switches", parts: { CarMap: KeyOnMapMap, PinCard: CardWhy } },
  "07": { slug: "paper", title: "Paper map, fading under the panel", parts: { CarMap: PaperMap, PinCard: CardAsk } },
  "08": { slug: "fly-to", title: "Fly to the car, card docked", parts: { CarMap: FlyToMap, PinCard: CardWhy } },
}

export default variants
