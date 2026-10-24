// Slot `needs`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { OtherTasks } from "../../_ui/work-case"
import { TimeGroups } from "./09-time-groups/time-groups"
import { GoToTask, GoToTaskRow } from "./10-go-to-task/go-to-task"
import { ListPanelAround, ListPanelRow } from "./11-list-panel/list-panel"
import { MenuCounts, MenuCountsRow } from "./12-menu-counts/menu-counts"
import { PlaceBundles } from "./13-place-bundles/place-bundles"
import { QueueOverviewAround, QueueOverviewRow } from "./14-queue-overview/queue-overview"
import { SplitColumn, SplitColumnRow } from "./15-split-column/split-column"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Row: OtherTasks } },
  "09": { slug: "time-groups", title: "Time groups in place", parts: { Row: TimeGroups } },
  "10": { slug: "go-to-task", title: "Go to a task, Command K", parts: { Row: GoToTaskRow, Menu: GoToTask } },
  "11": { slug: "list-panel", title: "The list beside the card", parts: { Row: ListPanelRow, Around: ListPanelAround } },
  "12": { slug: "menu-counts", title: "Counts in the menu, a popover beside it", parts: { Menu: MenuCounts, Row: MenuCountsRow } },
  "13": { slug: "place-bundles", title: "Bundled by pickup place", parts: { Row: PlaceBundles } },
  "14": { slug: "queue-overview", title: "The whole queue as a list view", parts: { Row: QueueOverviewRow, Around: QueueOverviewAround } },
  "15": { slug: "split-column", title: "A list column beside the card", parts: { Around: SplitColumn, Row: SplitColumnRow } },
}

export default variants
