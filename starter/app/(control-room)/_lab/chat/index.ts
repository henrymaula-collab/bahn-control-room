// Slot `chat`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Shared by every variant: core.tsx (state, send, the yes), parts.tsx (markup), base.css (look under .lab-chat-base).
import type { SlotRegistry } from "../context"
import { ChatPanel } from "../../_ui/work-case"
import { TwoLinesChat } from "./01-two-lines/two-lines"
import { BriefChat } from "./02-brief/brief"
import { ChecklistChat } from "./03-checklist/checklist"
import { VoiceChat } from "./04-voice/voice"
import { AnswerFirstChat } from "./05-answer-first/answer-first"
import { ApproveChat } from "./06-approve/approve"
import { CaseLogChat } from "./07-case-log/case-log"
import { GlowChat } from "./08-glow/glow"
import { InlineChat } from "./09-inline/inline"
import { RepliesChat } from "./10-replies/replies"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { ChatPanel } },
  "01": { slug: "two-lines", title: "Two lines, then ask", parts: { ChatPanel: TwoLinesChat } },
  "02": { slug: "brief", title: "The brief, with sources", parts: { ChatPanel: BriefChat } },
  "03": { slug: "checklist", title: "The work as a live checklist", parts: { ChatPanel: ChecklistChat } },
  "04": { slug: "voice", title: "Talk, with captions", parts: { ChatPanel: VoiceChat } },
  "05": { slug: "answer-first", title: "The answer in one line", parts: { ChatPanel: AnswerFirstChat } },
  "06": { slug: "approve", title: "The offer takes the field's place", parts: { ChatPanel: ApproveChat } },
  "07": { slug: "case-log", title: "The conversation as the case record", parts: { ChatPanel: CaseLogChat } },
  "08": { slug: "glow", title: "Lifted, with a light at the edge", parts: { ChatPanel: GlowChat } },
  "09": { slug: "inline", title: "Under the suggestion", parts: { ChatPanel: InlineChat } },
  "10": { slug: "replies", title: "The yes is a reply", parts: { ChatPanel: RepliesChat } },
}

export default variants
