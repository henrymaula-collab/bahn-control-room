// Slot `decide`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { DecisionDone } from "../../_ui/question"
import { SendPreview } from "../../_ui/send-preview"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { SendPreview, Done: DecisionDone } },
}

export default variants
