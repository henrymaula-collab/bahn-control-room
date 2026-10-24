# needs, builder N2: variants 09 to 15 (the list side)

Written 24 Oct 23:05. N1 owns 01 to 08 (the queue: next/previous, auto-advance, later, keys, dock).
N2 answers Henry's problem from the list: where the list lives in the page, what many does to it
(grouping), how you jump by name (a palette), and an overview of the whole queue.

Facts the plan rests on (read in the code and the lab database, not guessed):
- `WorkRow` has car, pickup place, order id and decide-by; there is no kind on a row (the padding
  rows for red orders have none), so N2 groups by time and by pickup place, never by kind.
- `?many=40` gives 37: decide-by times run 12:25 to 16:45 in ten-minute steps, two at 18:00, three
  tomorrow, one Tue 27 Oct. Places repeat (Rivellon 4, Velantora 3, Tervavio 3, Vellendor 2) and
  five are private addresses, which are not one place and never bundle.
- At Henry's Safari size (CSS viewport 1064 x 544) the card fills the column: a list opened under
  the card starts at the fold (see needs-00 many40). So in-place variants scroll the opened list
  into view, and the others put the list beside the card or over it.
- `?tasks=column` already shows a list column; at 1064 px its rows truncate the car ("Toyota RA...")
  because the time shares the line. 15 moves the time to the second line.
- The time groups (same rule in every variant, copied into each folder so a variant moves alone):
  Within the hour (the red ones), This morning / This afternoon / This evening (before 12, 12 to 17,
  from 17), Tomorrow, Later, No set time. A single group gets no header.
- After a decision (`?decided=1`) a list that shows the current case marks it "Decided" in grey.

| nn | Slug | The idea | Parts | Borrowed from |
|---|---|---|---|---|
| 09 | time-groups | Other tasks opens in place, grouped by time; the first group is open, every later group is one row with its count. Opening scrolls the list into view. | Row | Things 3 Today / This Evening (visual needs-16), Lightfield grouped tasks (needs-02) |
| 10 | go-to-task | Command K: a palette in the upper third, type a car, place, order or time, Enter opens; grouped by time, first row ready, a key legend at the foot. The Other tasks row says Command K. | Row | Linear palette (needs-10), Chatwoot jump palette legend (needs-08), Raycast Enter / Command K (product 18) |
| 11 | list-panel | Other tasks opens the list as the side panel, in place of the situation (as Talk it through does); it stays open while you move between cases, the case you are on highlighted. | Row, Around | Apple HIG sidebars ("a content list between the sidebar and the detail") and sheets ("a panel if people repeatedly provide input and observe results"), Keitoto inbox (needs-13) |
| 12 | menu-counts | The side menu never lists tasks: under the sections, Your tasks by time as at most three counted lines; a click opens that group as a popover beside the menu. No row under the card. | Menu, Row | Things 3 sidebar counts (needs-16), Superhuman split counts (product 02), Dovetail popover (needs-05), HIG "no more than two levels" |
| 13 | place-bundles | Other tasks grouped by pickup place: the cars at the place you are on come first ("Also at Calverona"), then every place with several cars is one row that opens. | Row | HEY Bundles (product 15), Lightfield grouped by company (needs-02) |
| 14 | queue-overview | Two modes, as Stripe Radar has them: Other tasks turns the card column into the whole queue as a quiet table, grouped by time, one count line on top; a row opens its card, Escape goes back. | Row, Around | Stripe Radar list and detailed view (product 11), ops exception queue counts (needs-12), Queues "Start review" (needs-14) |
| 15 | split-column | Apple's split view: a list column between the menu and the card, grouped by time with sticky headers, the time on the second line so the car is never cut; type a letter to jump. | Around, Row | Apple HIG split view (hig-sidebars), Apple Mail / Linear inbox list beside the item (needs-01, needs-13), WAI-ARIA listbox type-ahead (rules.md 5) |

Spread over the axes: where the list lives (under the card 09 13, over it 10, beside it on the right
11, in the menu 12, instead of the card 14, beside it on the left 15); what many does (time groups
with later groups as counts 09, search 10, sticky time groups 11 15, counts only 12, place bundles 13,
a table with a count line 14); keyboard (10 Command K and arrows, 11 14 15 arrows Home End, 15
type-ahead, J/K kept everywhere). Motion per research/premium/product/rules.md: hover 100 ms on
background, popover and palette in 150 ms (8 px and fade), panel 200 to 250 ms with
`cubic-bezier(0.2, 0, 0, 1)`, all inside `prefers-reduced-motion: no-preference`. No chips, no pills,
no "·", no numbered circles, no caps; sentence-case grey group headers; type on the ramp tokens.
