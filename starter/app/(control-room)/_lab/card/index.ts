// Slot `card`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// Shared logic and look for every variant: ./shared/kit.tsx and ./shared/kit.css (builder C).
import type { SlotRegistry } from "../context"
import { Question } from "../../_ui/question"
import { Consequences } from "./02-consequences/card"
import { LiveDeadline } from "./03-live-deadline/card"
import { Legwork } from "./05-legwork/card"
import { CommandBar } from "./06-command-bar/card"
import { Cycle } from "./07-cycle/card"
import { TwoAnswers } from "./09-two-answers/card"
import { ReviewFrame } from "./12-review-frame/card"
import { Labelled } from "./13-labelled/card"
import { SourceQuote } from "./14-source-quote/card"
// Builder C2: 16 to 20, structurally different cards (PLAN-C2.md).
import { Focus } from "./16-focus/card"
import { Timetable } from "./17-timetable/card"
import { MacAlert } from "./19-mac-alert/card"
import { YourTurn } from "./20-your-turn/card"

// Cut in review (RV2, 25 Oct): 01, 04, 08, 10, 11, 15, 18. Folders kept; reasons in the Desktop LAS-MIG.md.
const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { Question } },
  "02": { slug: "consequences", title: "Consequences", parts: { Question: Consequences } },
  "03": { slug: "live-deadline", title: "Live deadline", parts: { Question: LiveDeadline } },
  "05": { slug: "legwork", title: "The agent's legwork", parts: { Question: Legwork } },
  "06": { slug: "command-bar", title: "Command bar", parts: { Question: CommandBar } },
  "07": { slug: "cycle", title: "Options in place", parts: { Question: Cycle } },
  "09": { slug: "two-answers", title: "Two answers", parts: { Question: TwoAnswers } },
  "12": { slug: "review-frame", title: "Review frame", parts: { Question: ReviewFrame } },
  "13": { slug: "labelled", title: "Labelled for a newcomer", parts: { Question: Labelled } },
  "14": { slug: "source-quote", title: "In their own words", parts: { Question: SourceQuote } },
  "16": { slug: "focus", title: "Focus", parts: { Question: Focus } },
  "17": { slug: "timetable", title: "Timetable", parts: { Question: Timetable } },
  "19": { slug: "mac-alert", title: "Mac alert", parts: { Question: MacAlert } },
  "20": { slug: "your-turn", title: "Your turn", parts: { Question: YourTurn } },
}

export default variants
