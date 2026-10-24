// Slot `map`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { CarMap } from "../../_ui/car-map"
import { PinCard } from "../../_ui/overview-view"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { CarMap, PinCard } },
}

export default variants
