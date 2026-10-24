// Slot `rows`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { OptionsSheet } from "../../_ui/question"
import { CaseRowsList } from "../../_ui/work-case"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Rows: CaseRowsList, OptionsSheet } },
}

export default variants
