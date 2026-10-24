// Slot `menu`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// The variants share ./kit (the lockup, the rows, the frame with today's classes).
import type { SlotRegistry } from "../context"
import { Shell } from "../../_ui/shell"
import { SectionsShell } from "./01-sections/sections"
import { InkShell } from "./02-ink/ink"
import { RailShell } from "./03-rail/rail"
import { NextDueShell } from "./04-next-due/next-due"
import { FlyoutShell } from "./05-flyout/flyout"
import { KeysShell } from "./06-keys/keys"
import { OnShiftShell } from "./07-on-shift/on-shift"
import { RaisedShell } from "./08-raised/raised"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Shell } },
  "01": { slug: "sections", title: "Your work, then Operations", parts: { Shell: SectionsShell } },
  "02": { slug: "ink", title: "The open section in asphalt", parts: { Shell: InkShell } },
  "03": { slug: "rail", title: "Collapses to a rail", parts: { Shell: RailShell } },
  "04": { slug: "next-due", title: "The next deadline under Your tasks", parts: { Shell: NextDueShell } },
  "05": { slug: "flyout", title: "Your tasks fly out on hover", parts: { Shell: FlyoutShell } },
  "06": { slug: "keys", title: "Go-to keys (G then a letter)", parts: { Shell: KeysShell } },
  "07": { slug: "on-shift", title: "Who is on shift with you", parts: { Shell: OnShiftShell } },
  "08": { slug: "raised", title: "The open section raised, like Arc", parts: { Shell: RaisedShell } },
}

export default variants
