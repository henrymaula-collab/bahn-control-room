// Slot `card`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { Question } from "../../_ui/question"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Question } },
}

export default variants
