# map 08: Fly to the car, card docked

References: Apple HIG Maps, selecting a place opens its card next to the map (https://developer.apple.com/design/human-interface-guidelines/maps, `research/premium/product/shots/map-01-apple-hig-cluster.png`); Dispatch dashboard, the selected alert's card with its actions (https://dribbble.com/shots/4524530-Dispatch-dashboard-dark-mode, `research/premium/visual/shots/map-07-borneo-active-alerts.png`); Flighty's status lines that lead with the change (https://flighty.com/, `research/premium/visual/shots/map-05-flighty-live-map.png`, `research/premium/product/map.md` 06).

Borrowed: Apple Maps' camera move to the selected place and the place card docked in a corner instead of floating over the map; Flighty's "say what changed first" ("Seller hold on the car", then the car, then "Decide by 13:00"); previous and next through every red car (arrow keys too).

Why it helps: a click on a red dot answers "where exactly, and what is wrong" in one move, the card never covers the dot, and a person can walk all 26 red cars from the map without going back to a list. Escape or a click on the map flies back to Northern Europe.

Trade-off: the camera move costs 0.8 s per click and the tiles at the closer zoom can take a moment to load from OpenFreeMap.
