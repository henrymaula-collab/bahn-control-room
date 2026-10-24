// Slot `decide`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
import type { SlotRegistry } from "../context"
import { DecisionDone } from "../../_ui/question"
import { SendPreview } from "../../_ui/send-preview"
import { UndoPillDone, UndoPillPreview } from "./01-undo-pill/undo-pill"
import { UndoInButtonDone, UndoInButtonPreview } from "./02-undo-in-button/undo-in-button"
import { InlineDraftDone, InlineDraftPreview } from "./03-inline-draft/inline-draft"
import { ComposeSheetDone, ComposeSheetPreview } from "./04-compose-sheet/compose-sheet"
import { SideBySideDone, SideBySidePreview } from "./05-side-by-side/side-by-side"
import { SendAndNextDone, SendAndNextPreview } from "./06-send-and-next/send-and-next"
import { AgentFeedDone, AgentFeedPreview } from "./07-agent-feed/agent-feed"
import { ReceiptPanelDone, ReceiptPanelPreview } from "./08-receipt-panel/receipt-panel"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { SendPreview, Done: DecisionDone } },
  "01": { slug: "undo-pill", title: "Undo pill", parts: { SendPreview: UndoPillPreview, Done: UndoPillDone } },
  "02": { slug: "undo-in-button", title: "Undo in the button", parts: { SendPreview: UndoInButtonPreview, Done: UndoInButtonDone } },
  "03": { slug: "inline-draft", title: "Inline draft", parts: { SendPreview: InlineDraftPreview, Done: InlineDraftDone } },
  "04": { slug: "compose-sheet", title: "Compose sheet", parts: { SendPreview: ComposeSheetPreview, Done: ComposeSheetDone } },
  "05": { slug: "side-by-side", title: "Side by side", parts: { SendPreview: SideBySidePreview, Done: SideBySideDone } },
  "06": { slug: "send-and-next", title: "Send and next", parts: { SendPreview: SendAndNextPreview, Done: SendAndNextDone } },
  "07": { slug: "agent-feed", title: "Agent feed", parts: { SendPreview: AgentFeedPreview, Done: AgentFeedDone } },
  "08": { slug: "receipt-panel", title: "Receipt panel", parts: { SendPreview: ReceiptPanelPreview, Done: ReceiptPanelDone } },
}

export default variants
