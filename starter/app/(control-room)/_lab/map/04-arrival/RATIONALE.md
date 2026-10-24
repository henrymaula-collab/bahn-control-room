# map 04: The map arrives

References: Apple HIG Motion (https://developer.apple.com/design/human-interface-guidelines/motion, raw copy `research/premium/product/raw/rules/hig-motion.md`: brief, precise, optional motion); Material 3 easing and duration tokens (https://m3.material.io/styles/motion/easing-and-duration/tokens-specs, `research/premium/product/raw/rules/m3-motion-tokens.md`); Flighty's live map above the list (https://flighty.com, `research/premium/visual/shots/map-05-flighty-live-map.png`).

Borrowed: one ease-out curve for everything, no overshoot; a sequence that tells the story in order (the fleet, the agent's work, then what needs a person), each step within M3's 400 to 900 ms range.

Why it helps: the Overview is the first shot of the video. In about 2.5 s the camera settles on Northern Europe, 272 green cars fade in, the agent's 14 appear, the 26 red drop in one after another and Aino's three pulse once. After that the map is still, so it never competes with the decision.

Trade-off: it plays on every visit to the Overview, which a person opening it 40 times a day may find slow; a real build would play it once per session. Reduced motion skips it.
