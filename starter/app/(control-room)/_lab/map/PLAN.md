# map: plan (builder MM, 25 Oct ~00:05)

The Overview map behind the welcome panel. Today: light Bahn map, green dots (one layer), the agent's
cars breathing in sync, red dots with a ring, a popup card with the question and "Open the case".
Henry's locked decisions kept in every variant: dots only (no car names on the map), Northern Europe
frame, green = on plan, red = needs a person, the agent's cars green with a calm pulse.

Shared engine: `kit/` (one CarMap with options, same props as today's `CarMap`, plus the pin cards).
Every variant is one options object + its own CSS + its card. Axes spread:

| nn | slug | Axis | The idea | References (boards) |
|---|---|---|---|---|
| 01 | halo | pin language | Red dots grow to 12 px with a soft static halo; hover names the car and its time; the open one gets an ink ring | FrostFlow map-06 (halo), Apple HIG Maps (selected outline), MapLibre hover (PP 07) |
| 02 | asphalt | light vs dark | Bahn's asphalt map; red glows, green dims, the card in asphalt with a birch button | Bahn driver app palette (map-style.ts), AP Transit map-04, Dispatch dark map-07 |
| 03 | yours | pin language | The person's own cases are bigger with an ink ring; everyone else's red is smaller; the welcome rows and the map agree at a glance | Onfleet (PP 02, list and pins are the same objects), Apple HIG selection |
| 04 | arrival | live feel, motion | The first second of the video: the camera settles in, green fades in, the agent's cars, then red drops in, yours pulse once | Mapbox/MapLibre camera easing, Flighty live map map-05, rules.md motion |
| 05 | agent-at-work | motion = agent working | One agent car pings at a time, in turn, instead of all fourteen breathing together | Onfleet "subtle flashing" on-duty drivers (PP 02), Apple HIG motion (avoid sustained oscillation) |
| 06 | key-on-map | the key's place | The key moves onto the map as three switches with counts; switch off green to leave only what needs a person | Onfleet filter bar = legend with counts (PP 02), Flexport "Exceptions" (PP 05), Fibery map-03 |
| 07 | paper | base map, what the panel covers | Apple's muted map in Bahn's paper tones; the map fades out under the welcome panel so the cars start beside it | Apple HIG muted style (PP 01b), TravelPerk map-01, Airbnb map-02 |
| 08 | fly-to | red dot to case | Click a red dot: the map flies to the car, its card docks bottom right with the reason, a black "Open the case" and next/previous through every red car (arrow keys); Esc flies back | Apple Maps place card (HIG callout), Dispatch map-07, Flighty status lines (PP 06) |

Cards: `CardAsk` (01, 03, 04, 05, 07: the question and a black pill), `CardAsphalt` (02), `CardWhy`
(06, 08: Flighty-style "what stopped" line instead of the question).
