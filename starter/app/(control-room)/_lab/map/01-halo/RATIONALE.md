# map 01: A halo on every red dot

References: FrostFlow OS live fleet map (Juang Bagus, Dribbble, https://dribbble.com/shots/27468564-FrostFlow-OS-Logistics-Operations-Dashboard, `research/premium/visual/shots/map-06-fleetflow-live-map.png`); Apple HIG Maps (https://developer.apple.com/design/human-interface-guidelines/maps, `research/premium/product/shots/map-01-apple-hig-cluster.png`); MapLibre hover effect (https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/, `research/premium/product/shots/map-07-maplibre-hover-effect.png`).

Borrowed: FrostFlow's one problem marker with a soft red halo; Apple's rule that a selected element gets "an outline and color variation" (here an ink ring on the open dot); MapLibre's instant hover highlight (the dot and halo grow in 150 to 200 ms).

Why it helps: a 12 px dot in a 26 px halo is the only soft-edged thing on the map, so red is found before green is even read, and the 28 px button meets WCAG's 24 px target. Hover names the car and its time without a click (dots stay unlabelled, Henry's rule), and the ink ring keeps "which one is open" obvious while the card covers the map.

Trade-off: 26 halos are more ink than 26 dots; in the Helsinki cluster they merge into one soft red patch, which reads as "a lot here" but hides the count.
