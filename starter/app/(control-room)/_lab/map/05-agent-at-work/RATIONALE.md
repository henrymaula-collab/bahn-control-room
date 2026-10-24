# map 05: The agent's cars take turns

References: Onfleet, on-duty drivers as circles "with a subtle flashing animation" (https://support.onfleet.com/hc/en-us/articles/360023669612-Map-Sidebar, `research/premium/product/shots/map-02-onfleet-map-and-sidebar.png`); Apple HIG Motion, "avoid adding motion to UI interactions that occur frequently" and sustained oscillation (https://developer.apple.com/design/human-interface-guidelines/motion, `research/premium/product/raw/rules/hig-motion.md`).

Borrowed: Onfleet's idea that live work shows as a light flash on the worker's mark, not as moving cars; Apple's caution about everything pulsing at once.

Why it helps: today the 14 agent cars breathe in sync, which reads as decoration. Here they are steady green dots and every 1.1 s one of them sends out a ring, in turn, like a call going out. The map says "the agent is working through a list", one thing moves at a time, and the red dots stay the calmest strong signal.

Trade-off: the rhythm is a portrait of the agent working, not a live feed of its calls (the map has no per-call data); a real build could ping a car when its call actually starts.
