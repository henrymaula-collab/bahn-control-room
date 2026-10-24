// Slot `needs`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// Cut by the reviewer (folders kept, reasons in ~/Desktop/Bahn-lab-bilder/01-needs-you/LAS-MIG.md): 04 run-line, 06 keys, 08 skip-reason.
import type { SlotRegistry } from "../context"
import { OtherTasks } from "../../_ui/work-case"
import { FootSteps, FootStepsDone } from "./01-foot-steps/foot-steps"
import { TimeGroups } from "./09-time-groups/time-groups"
import { NextOpensDone, NextOpensRow } from "./02-next-opens/next-opens"
import { LaterDone, LaterNote, LaterRow } from "./03-later/later"
import { GoToTask, GoToTaskRow } from "./10-go-to-task/go-to-task"
import { ListPanelAround, ListPanelDone, ListPanelRow } from "./11-list-panel/list-panel"
import { UpNext, UpNextDone } from "./05-up-next/up-next"
import { MenuCounts, MenuCountsRow } from "./12-menu-counts/menu-counts"
import { PlaceBundles } from "./13-place-bundles/place-bundles"
import { QueueOverviewAround, QueueOverviewRow } from "./14-queue-overview/queue-overview"
import { SplitColumn, SplitColumnRow } from "./15-split-column/split-column"
import { DockAround, DockDone, DockNoRow } from "./07-dock/dock"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Row: OtherTasks } },
  "01": { slug: "foot-steps", title: "Previous and Next at the foot", parts: { Row: FootSteps, Done: FootStepsDone } },
  "09": { slug: "time-groups", title: "Time groups in place", parts: { Row: TimeGroups } },
  "02": { slug: "next-opens", title: "The next one opens by itself", parts: { Row: NextOpensRow, Done: NextOpensDone } },
  "03": { slug: "later", title: "Not now, until a time", parts: { Row: LaterRow, Top: LaterNote, Done: LaterDone } },
  "10": { slug: "go-to-task", title: "Go to a task, Command K", parts: { Row: GoToTaskRow, Menu: GoToTask } },
  "11": { slug: "list-panel", title: "The list beside the card", parts: { Row: ListPanelRow, Around: ListPanelAround, Done: ListPanelDone } },
  "05": { slug: "up-next", title: "The next case peeks under this one", parts: { Row: UpNext, Done: UpNextDone } },
  "12": { slug: "menu-counts", title: "Counts in the menu, a popover beside it", parts: { Menu: MenuCounts, Row: MenuCountsRow } },
  "13": { slug: "place-bundles", title: "Bundled by pickup place", parts: { Row: PlaceBundles } },
  "14": { slug: "queue-overview", title: "The whole queue as a list view", parts: { Row: QueueOverviewRow, Around: QueueOverviewAround } },
  "15": { slug: "split-column", title: "A list column beside the card", parts: { Around: SplitColumn, Row: SplitColumnRow } },
  "07": { slug: "dock", title: "A dock that stays while cases change", parts: { Around: DockAround, Done: DockDone, Row: DockNoRow } },
}

export default variants
