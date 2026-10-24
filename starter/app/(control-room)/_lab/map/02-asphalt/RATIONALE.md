# map 02: Bahn's asphalt map

References: Bahn's own asphalt tones (driver app, dark website sections; already in `app/(control-room)/_ui/map-style.ts` as the DARK palette, `?map=dark`); AP Transit live NYC map (Awwwards Honourable Mention, https://www.awwwards.com/sites/ap-transit-nyc-subway-map, `research/premium/visual/shots/map-04-ap-transit-subway-map.png`); Dispatch dashboard dark (Piotr Bakker, https://dribbble.com/shots/4524530-Dispatch-dashboard-dark-mode, `research/premium/visual/shots/map-07-borneo-active-alerts.png`).

Borrowed: AP Transit's lit marks on a dark ground (light is the signal, the map is the night); Dispatch's small dark card pinned to the selected alert; Bahn's asphalt for land, birch for type and the one button.

Why it helps: on asphalt the red dots glow and green steps back (78% opacity, a size smaller), so "what needs a person" is the brightest thing on screen. The cream welcome panel floats on the dark map with maximum contrast, which is the strongest first frame for the video.

Trade-off: Henry has not chosen dark; the rest of the app stays light, so the Overview becomes the one dark page, and red text (13:00) has to move to red-300 on the dark card.
