// Slot `rows`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { OptionsSheet } from "../../_ui/question"
import { CaseRowsList } from "../../_ui/work-case"
import { SublineRows } from "./01-sublines/sublines"
import { SettingsGroupRows } from "./02-settings-group/settings-group"
import { LinksLineRows } from "./03-links-line/links-line"
import { ActionListSheet } from "./04-action-list/action-list"
import { PanelOptions, PanelRows } from "./05-panels/panels"
import { TasksSheetRows } from "./06-tasks-sheet/tasks-sheet"
import { AgentPreviewRows } from "./07-agent-preview/agent-preview"
import { BottomSheet } from "./08-bottom-sheet/bottom-sheet"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Rows: CaseRowsList, OptionsSheet } },
  "01": { slug: "sublines", title: "A grey line in every row", parts: { Rows: SublineRows } },
  "02": { slug: "settings-group", title: "One inset group, one open at a time", parts: { Rows: SettingsGroupRows } },
  "03": { slug: "links-line", title: "One line of quiet links, popovers", parts: { Rows: LinksLineRows } },
  "04": { slug: "action-list", title: "Other options as an action list", parts: { OptionsSheet: ActionListSheet } },
  "05": { slug: "panels", title: "Why and Other options as the side panel", parts: { Rows: PanelRows, OptionsSheet: PanelOptions } },
  "06": { slug: "tasks-sheet", title: "Other tasks as a sheet with a find field", parts: { Rows: TasksSheetRows } },
  "07": { slug: "agent-preview", title: "Talk it through speaks first", parts: { Rows: AgentPreviewRows } },
  "08": { slug: "bottom-sheet", title: "Other options rise from the bottom", parts: { OptionsSheet: BottomSheet } },
}

export default variants
