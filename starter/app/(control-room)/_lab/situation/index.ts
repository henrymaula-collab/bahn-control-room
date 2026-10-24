// Slot `situation`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Shared by every variant: shared/kit.tsx (derived facts, the lab map, the order link) and shared/kit.css.
import type { SlotRegistry } from "../context"
import { SituationPanel } from "../../_ui/work-case"
import { PlaceCardSituation } from "./01-place-card/place-card"
import { LegLineSituation } from "./02-leg-line/leg-line"
import { BlockerFirstSituation } from "./03-blocker-first/blocker-first"
import { JourneySituation } from "./04-journey/journey"
import { MapSheetSituation } from "./05-map-sheet/map-sheet"
import { InspectorSituation } from "./06-inspector/inspector"
import { TwoEndsSituation } from "./07-two-ends/two-ends"
import { StaysSituation } from "./08-stays/stays"
import { CalloutsSituation } from "./09-callouts/callouts"
import { GroupedSituation } from "./10-grouped/grouped"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { SituationPanel } },
  "01": { slug: "place-card", title: "Place card: hero map, a three-fact strip", parts: { SituationPanel: PlaceCardSituation } },
  "02": { slug: "leg-line", title: "Leg line: A to B on one line, map on request", parts: { SituationPanel: LegLineSituation } },
  "03": { slug: "blocker-first", title: "Blocker first", parts: { SituationPanel: BlockerFirstSituation } },
  "04": { slug: "journey", title: "Journey: pickup, driver, delivery as steps", parts: { SituationPanel: JourneySituation } },
  "05": { slug: "map-sheet", title: "Map sheet: the panel is the map", parts: { SituationPanel: MapSheetSituation } },
  "06": { slug: "inspector", title: "Inspector: dense, for experts", parts: { SituationPanel: InspectorSituation } },
  "07": { slug: "two-ends", title: "Two ends under an arc", parts: { SituationPanel: TwoEndsSituation } },
  "08": { slug: "stays", title: "Stays: folds to a strip when the chat opens", parts: { SituationPanel: StaysSituation } },
  "09": { slug: "callouts", title: "Callouts: the places named on the map", parts: { SituationPanel: CalloutsSituation } },
  "10": { slug: "grouped", title: "Grouped: Apple inset lists", parts: { SituationPanel: GroupedSituation } },
}

export default variants
