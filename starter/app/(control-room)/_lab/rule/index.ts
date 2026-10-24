// Slot `rule`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { RuleCard } from "./00-today/rule-card"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { RuleCard } },
}

export default variants
