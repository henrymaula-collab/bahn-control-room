# welcome 11: One line over the map

- References: Apple HIG Live Activities, a compact presentation that shows only what people need at a glance and grows on demand (https://developer.apple.com/design/human-interface-guidelines/live-activities, `research/premium/product/raw/pp/hig-live-activities.md`); Superhuman's split counts, one count instead of a list, never "0" (https://help.superhuman.com/hc/en-us/articles/46005619081101, `research/premium/product/shots/needs-04-superhuman-split.png`); TravelPerk's lone card over a full map (`research/premium/visual/shots/map-01-travelperk-nobody-traveling.png`).
- Borrowed: the whole welcome in one pill-shaped line: "Aino, three cars need you by 13:00." in Bahn's display face, the black pill "Start with the BMW M4", and "All three" that drops the rows under it (Escape closes). The key moves to the map's corner as its legend.
- Why for ops: the lowest-load Overview in the set; the map gets the whole frame, the sentence says how much and by when, and the one button starts the work. The rows are one tap away for whoever wants them.
- The map keeps its cars beside a zero-width box (panelRef), so it uses the full width; the strip floats over the map's top edge.
- Trade-off: her three cars are not visible until she asks; the greeting loses "Welcome back to Bahn Express".
