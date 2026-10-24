// Slot `rule`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { RuleCard } from "./00-today/rule-card"
import { RuleBeside } from "./01-beside/beside"
import { RuleSwitch } from "./02-switch/switch"
import { RuleThirty } from "./03-thirty/thirty"
import { RuleFirstCase } from "./04-first-case/first-case"
import { RuleLimits } from "./05-limits/limits"
import { RuleGate } from "./06-gate/gate"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { RuleCard } },
  "01": { slug: "beside", title: "The evidence beside the card", parts: { RuleCard: RuleBeside } },
  "02": { slug: "switch", title: "The rule as a setting with a switch", parts: { RuleCard: RuleSwitch } },
  "03": { slug: "thirty", title: "Thirty answers as one picture", parts: { RuleCard: RuleThirty } },
  "04": { slug: "first-case", title: "What changes, on the case waiting now", parts: { RuleCard: RuleFirstCase } },
  "05": { slug: "limits", title: "The limits first", parts: { RuleCard: RuleLimits } },
  "06": { slug: "gate", title: "The gate as a merge box", parts: { RuleCard: RuleGate } },
}

export default variants
