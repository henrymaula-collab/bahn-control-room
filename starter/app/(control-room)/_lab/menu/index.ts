// Slot `menu`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { Shell } from "../../_ui/shell"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Shell } },
}

export default variants
