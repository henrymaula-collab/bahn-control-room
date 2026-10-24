# welcome: plan (builder W, 24 Oct ~23:05)

Today (00): "Welcome back to *Bahn Express*, Aino." in Owners Wide, the black pill "3 tasks for you to
get started", every task row, the key with counts. Henry approved it; it opens the video. Two real
problems seen in today's shots: at `many=12` the panel runs off the bottom of the frame (the key is
cut), and with nothing to do (Kaisa) the panel says the same thing twice (pill + key, nothing about
the agent).

Every variant keeps Bahn's brand (Owners Wide display line, Geist UI, birch / asphalt, red-700 for
a deadline within the hour, green / red dots) and `WelcomePanelProps`. Every variant fits the frame
at 3, 12 and 0 tasks (never runs off the bottom) and says something useful when empty.
Shared helpers in `shared.tsx` (lab-param-keeping links, the case brief and agent feed reads, the
row-to-pin tether) and `shared.css` (scoped under `.lab-welcome`).

| nn | slug | The idea (axis) | References (boards) |
|---|---|---|---|
| 01 | briefing | Voice: the greeting carries the day in one two-tone sentence ("Welcome back, Aino. Three cars need you by 13:00."); the pill starts the first task by name | Flighty welcome-05, Town welcome-14, Zendesk Play (PP 10) |
| 02 | first-open | Rows: the most urgent task is open in the panel (its situation and the question), the rest are closed rows | Axiom welcome-10, Apple HIG notifications (PP 18) |
| 03 | countdown | Live: time left as the row's figure, ticking from the room's clock, the first deadline drains as a hairline | Apple HIG Live Activities (PP 17), Flighty card-13 |
| 04 | maps-card | Place and size: a narrow Apple-Maps-like card, the key moves onto the map as its legend | TravelPerk map-01, Apple HIG sidebars / sheets (raw/pp) |
| 05 | sheet | Place and size: a full-height sheet; header fixed, the list scrolls, the key pinned at the foot (12 and 40 fit) | Flighty map-05, Apple HIG sheets (raw/pp), Things needs-16 |
| 06 | by-time | Many: rows grouped by when ("Within the hour", "Later today", "Tomorrow"); later groups fold to one line | Things 3 Today (PP 13), Lightfield needs-02 |
| 07 | by-place | Many: rows grouped by pickup place, so one call covers several cars | Shopify Home order tasks (PP 04), Fin welcome-06 |
| 08 | agent-on | Live: under her tasks, what the agent is doing right now, one real case at a time | Tembo welcome-02, Ctrl.ai welcome-01 |
| 09 | fleet-bar | Key: the three counts as one proportional bar of every car today, words under it | Supply chain welcome-16, Apple storage bar (shot taken for this slot) |
| 10 | listen | Voice: a dated title and Listen; the brief is read aloud and each row (and its pin) lights as it is read | Linear Pulse (PP welcome-01) |
| 11 | strip | Place and size: one line across the top of the map; the rows open on demand | Apple HIG Live Activities (PP 17), Superhuman split counts (PP 09) |
| 12 | arrival | Motion: the greeting arrives alone, then settles into the panel; rows and counts follow | Flora welcome-08, Daybridge welcome-17 |
| 13 | asphalt | Surface: the panel in Bahn's asphalt (their driver app and website strip), birch pill | Bahn driver app + bahnexpress.com stat strip (design/) |
| 14 | find | Call to action: a find field under the greeting (car, place or CD number) over all of today's cars | Attio welcome-04, Magnific welcome-03, Amie needs-09 |
| 15 | tether | Map link: a hairline from the row to its pin; the most urgent one is tied by default | Flighty map-05, FleetFlow map-06 |
</content>
</invoke>
