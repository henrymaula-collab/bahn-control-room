// Slot `decide`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { DecisionDone } from "../../_ui/question"
import { SendPreview } from "../../_ui/send-preview"
import { UndoPillDone, UndoPillPreview } from "./01-undo-pill/undo-pill"
import { UndoInButtonDone, UndoInButtonPreview } from "./02-undo-in-button/undo-in-button"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { SendPreview, Done: DecisionDone } },
  "01": { slug: "undo-pill", title: "Undo pill", parts: { SendPreview: UndoPillPreview, Done: UndoPillDone } },
  "02": { slug: "undo-in-button", title: "Undo in the button", parts: { SendPreview: UndoInButtonPreview, Done: UndoInButtonDone } },
}

export default variants
