# situation: plan (builder SI, 24 Oct ~23:58)

The panel beside the card: open by default (Henry, 20:40), so it has to give the picture at a glance
and stay calm next to a Title 1 card. Data per case (Situation): car, reference, A and B (place, city,
position, window, booked), driver, waitingOn, facts (the case type's fact first: Release Missing,
Car Not ready, ...). The blocking fact = the first engine fact that is not Pickup, Driver or Delivery.

Two facts the data adds that today's panel misses:
- Ferrari: A and B are 0.3 km apart in Hamburg, so the map at zoom 12 draws the two pins on top of
  each other. A variant either zooms to separate them, says "0.3 km apart", or drops the map.
- BMW: 165 km apart, both windows booked, a driver booked; the blocker is "Car: Not ready".

Shared kit (`shared/`): derived values (stops with times, facts deduped as today, blocker, distance
words), a lab route map (straight or arc leg, muted, callout labels, close-stop zoom), the order link.

| nn | Concept | Map | A/B and leg | Facts and blocker | Order link | References |
|---|---|---|---|---|---|---|
| 01 | place-card | hero, edge to edge, muted | stops as a short list under a stat strip | three-cell strip (blocker, driver, distance) | full-width row at the foot | Apple HIG Maps place card + muted style |
| 02 | leg-line | none until asked ("Show on the map") | one horizontal leg A ——— B, distance on the line, places and times under each end | label and value under it | text link | Flighty flight row, Fastship origin-destination line |
| 03 | blocker-first | small | stops as today, compact | the blocker leads with a red dot (the map's needs-a-person red), waiting under it, the rest grey | text link | Wattline problem line, Stripe Radar factors first, Onfleet late mark |
| 04 | journey | small strip | vertical journey: Pickup, Driver, Delivery as steps; the blocked step marked, later steps faint | facts folded into the steps | text link | Qudra tracking timeline, Zendesk interactions timeline |
| 05 | map-sheet | the whole panel is the map | pins on the map, the details on a floating sheet at the foot | label and value on the sheet | row on the sheet | Find My / Apple Maps sheet (HIG place card), Nexroute card over map |
| 06 | inspector | none (one icon shows it) | two dense lines, tabular times | dense label and value, blocker in 600 | the reference in the header is the link | Zendesk context panel, Linear density |
| 07 | two-ends | medium, an arc instead of a road | two place cards side by side under the arc | one line of facts under them | text link | Fletes arc route, Fastship |
| 08 | stays | small | a summary row (A to B) that opens the stops | label and value | text link | Apple HIG nonmodal sheets, Samsara route summary; when the chat or the email takes the panel, the situation folds to a strip at the top instead of leaving |
| 09 | callouts | medium, the places named on the map; stops that close cluster into one pin | no separate A/B rows | label and value | text link | Apple HIG Maps annotations and clustering, Fletes callouts |
| 10 | grouped | small, inside the first group | Apple inset grouped lists: route group, facts group with values on the right | values right-aligned like Settings | a group of its own, "Open the order" with the Orders icon | Apple HIG lists, place card "Open in Apple Maps" |

Rules for all: type on the ramp (headline for the car, subhead for the rest, body nowhere bigger),
ink and ink-2 only, red only as the needs-a-person dot, no pills, no "·", no caps, no numbered circles
(A and B letters only), motion 150 ms colour / 200-250 ms panels with ease-out, all under
prefers-reduced-motion: no-preference. Every selector under `.lab-situation-NN` or the kit's
`.lab-situation-base` (only ever on a variant's panel).
