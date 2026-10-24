# needs, builder N1: variants 01 to 08 (the queue side)

Written 24 Oct 22:58. N2 owns 09 to 15 (the list side: grouping, palette, overview of the queue).

The problem (Henry): the Needs-you list nested in the side menu fails with many tasks; today's
fallback is "Other tasks N" under the card. N1 answers it from the queue: the person never needs
the list to move on. The side menu keeps "Your tasks N" (a count, never a list). Each variant
must hold at 3, 12 and 37 tasks and say what happens right after a decision.

Facts the plan rests on (read in the code, not guessed):
- Aino's queue is sorted by decide-by: BMW M4 12:30, Ferrari Roma 13:00, Volvo V60 13:00. On the
  Ferrari, previous = BMW, next = Volvo. `?many=12` and `?many=40` pad it (37 at most).
- After a real decision the page refreshes, the decided case leaves `useNeedsYou().rows`, and
  `nextHref` is the most urgent one left. `?decided=1` shows the moment without saving.
- There is no undo route for a decision (the decision is saved and carried out at once), so no
  variant fakes an Undo of a decision. "Later" and "Skip" have no engine field either: they live in
  the browser's sessionStorage and say so in their rationale.
- `GET /api/cr/cases/:id` gives the next case's headline (used by 05 to show what comes next).

| nn | Slug | The idea | Parts | Borrowed from (board ids) |
|---|---|---|---|---|
| 01 | foot-steps | Previous and Next pinned at the foot of the card column, "2 of 12" between them, the next car named. After a decision, Next becomes the one black button. | Row, Done | Expense drawer (visual needs-11), Stripe Radar detailed view (product 11) |
| 02 | next-opens | Decide, and the next case opens by itself after a short count, with Stay on this case and Open now. The last one ends in one calm sentence. Under the card: only what comes next. | Done, Row | Superhuman Achieve Inbox Zero (product 01), Zendesk Play "Next available / Stay on ticket" (product 05, shot needs-07), Zendesk end of view (needs-09) |
| 03 | later | A third answer besides the two buttons: "Not now", until a time (12:30, 13:00, when the pickup place answers). The task leaves and the next opens; the queue says when it comes back. H opens it. | Row | Superhuman Remind Me (product 04), Linear snooze (product 07/09, shot needs-03), Untitled UI Remind me (visual needs-15) |
| 04 | run-line | One line above the card: where you are in the queue as a strip of marks sorted by time (red within the hour), the one you are on drawn solid; hover or focus names a mark, a click opens it. Decided marks fill. | Top, Done | GitHub review progress (product 13), Queues "Time left" order (visual needs-14), HEY Focus & Reply (product 14) |
| 05 | up-next | The next case's own headline peeks under this one, so you read what is coming before you get there; after a decision it rises into place. | Around, Done | Superhuman (the next conversation opens at once, product 01), Linear inbox list beside the item (visual needs-01) |
| 06 | keys | The queue by keyboard: J and K, Enter for the black button, O for Other options, T to talk it through, ? for the key sheet. One quiet line at the foot teaches them. | Row | Linear Triage keys (product 07), Raycast Enter / Cmd K (product 18), Chatwoot palette legend (visual needs-08) |
| 07 | dock | A small dock floats at the bottom of the card column and stays while cases change: previous, where you are, next. After a decision it says what was done and what opens next. | Around | Undo-countdown toast (visual decide-01), docked music toast (decide-02), bulk-action dock (decide-03) |
| 08 | skip-reason | Guided: no list on the page, only the next one by time and "Skip for now", which asks why in one tap; the reason goes to the shift lead. | Row | Zendesk Guided mode and skip reason (product 06, shot needs-08), Superhuman J to move on (product 01) |

Spread over the axes: where it lives (foot 01, under the card 02/03/06/08, above the card 04,
beside/under the card 05, floating dock 07); what many does (always a count and the next one, never
a long list on the page; 04 draws 37 marks as one strip); keyboard (all keep J/K; 03 H, 06 the full
set); after a decision (01 Next as the black button, 02 opens by itself, 04 a filled mark, 05 the
next headline rises, 07 the dock speaks). Motion: 200 ms with `cubic-bezier(0.2, 0, 0, 1)` for the
queue moves, 100 to 150 ms for hover, all inside `prefers-reduced-motion: no-preference`
(research/premium/product/rules.md). No chips, no pills for state, no "·", no numbered circles.
