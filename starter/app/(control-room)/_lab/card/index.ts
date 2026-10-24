// Slot `card`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// Shared logic and look for every variant: ./shared/kit.tsx and ./shared/kit.css (builder C).
import type { SlotRegistry } from "../context"
import { Question } from "../../_ui/question"
import { QuestionFirst } from "./01-question-first/card"
import { Consequences } from "./02-consequences/card"
import { LiveDeadline } from "./03-live-deadline/card"
import { WhyPopover } from "./04-why-popover/card"
import { Legwork } from "./05-legwork/card"
import { CommandBar } from "./06-command-bar/card"
import { Cycle } from "./07-cycle/card"
import { ChooseOne } from "./08-choose-one/card"
import { TwoAnswers } from "./09-two-answers/card"
import { NextSteps } from "./10-next-steps/card"
import { MessageFirst } from "./11-message-first/card"
import { ReviewFrame } from "./12-review-frame/card"
import { Labelled } from "./13-labelled/card"
import { SourceQuote } from "./14-source-quote/card"
import { AgentAsks } from "./15-agent-asks/card"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Question } },
  "01": { slug: "question-first", title: "Question first", parts: { Question: QuestionFirst } },
  "02": { slug: "consequences", title: "Consequences", parts: { Question: Consequences } },
  "03": { slug: "live-deadline", title: "Live deadline", parts: { Question: LiveDeadline } },
  "04": { slug: "why-popover", title: "Why this", parts: { Question: WhyPopover } },
  "05": { slug: "legwork", title: "The agent's legwork", parts: { Question: Legwork } },
  "06": { slug: "command-bar", title: "Command bar", parts: { Question: CommandBar } },
  "07": { slug: "cycle", title: "Options in place", parts: { Question: Cycle } },
  "08": { slug: "choose-one", title: "Choose one", parts: { Question: ChooseOne } },
  "09": { slug: "two-answers", title: "Two answers", parts: { Question: TwoAnswers } },
  "10": { slug: "next-steps", title: "Next steps", parts: { Question: NextSteps } },
  "11": { slug: "message-first", title: "The message first", parts: { Question: MessageFirst } },
  "12": { slug: "review-frame", title: "Review frame", parts: { Question: ReviewFrame } },
  "13": { slug: "labelled", title: "Labelled for a newcomer", parts: { Question: Labelled } },
  "14": { slug: "source-quote", title: "In their own words", parts: { Question: SourceQuote } },
  "15": { slug: "agent-asks", title: "The agent asks", parts: { Question: AgentAsks } },
}

export default variants
