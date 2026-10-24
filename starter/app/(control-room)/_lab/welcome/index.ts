// Slot `welcome`: every variant, by number. Owned by this slot's builder (see ../CONTRACT.md).
// Add a line per variant: "07": { slug: "triage-queue", title: "Triage queue", parts: { ... } }.
// Shared helpers for every variant: ./shared.tsx and ./shared.css (copy them with a variant).
import type { SlotRegistry } from "../context"
import { WelcomePanel } from "../../_ui/overview-view"
import { Briefing } from "./01-briefing/briefing"
import { FirstOpen } from "./02-first-open/first-open"
import { Countdown } from "./03-countdown/countdown"
import { MapsCard } from "./04-maps-card/maps-card"
import { Sheet } from "./05-sheet/sheet"
import { ByTime } from "./06-by-time/by-time"
import { ByPlace } from "./07-by-place/by-place"
import { AgentOn } from "./08-agent-on/agent-on"
import { FleetBar } from "./09-fleet-bar/fleet-bar"
import { Listen } from "./10-listen/listen"
import { Strip } from "./11-strip/strip"
import { Arrival } from "./12-arrival/arrival"
import { Asphalt } from "./13-asphalt/asphalt"
import { Find } from "./14-find/find"
import { TetherPanel } from "./15-tether/tether"

const variants: SlotRegistry = {
  "00": { slug: "today", title: "Today", parts: { WelcomePanel } },
  "01": { slug: "briefing", title: "The day in the greeting", parts: { WelcomePanel: Briefing } },
  "02": { slug: "first-open", title: "First task open", parts: { WelcomePanel: FirstOpen } },
  "03": { slug: "countdown", title: "Time left, counting down", parts: { WelcomePanel: Countdown } },
  "04": { slug: "maps-card", title: "A maps card and a legend on the map", parts: { WelcomePanel: MapsCard } },
  "05": { slug: "sheet", title: "A full-height sheet", parts: { WelcomePanel: Sheet } },
  "06": { slug: "by-time", title: "Grouped by when", parts: { WelcomePanel: ByTime } },
  "07": { slug: "by-place", title: "Grouped by pickup place", parts: { WelcomePanel: ByPlace } },
  "08": { slug: "agent-on", title: "The agent, right now", parts: { WelcomePanel: AgentOn } },
  "09": { slug: "fleet-bar", title: "The key as one bar", parts: { WelcomePanel: FleetBar } },
  "10": { slug: "listen", title: "Listen to the day", parts: { WelcomePanel: Listen } },
  "11": { slug: "strip", title: "One line over the map", parts: { WelcomePanel: Strip } },
  "12": { slug: "arrival", title: "The greeting arrives first", parts: { WelcomePanel: Arrival } },
  "13": { slug: "asphalt", title: "Asphalt panel", parts: { WelcomePanel: Asphalt } },
  "14": { slug: "find", title: "Find any car", parts: { WelcomePanel: Find } },
  "15": { slug: "tether", title: "Rows tied to their cars", parts: { WelcomePanel: TetherPanel } },
}

export default variants
