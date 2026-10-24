# card: five more concepts, 16 to 20 (builder C2, 25 Oct ~00:30)

Why these exist: 01 to 15 keep today's structure (one column, deadline, situation, question, the
answers, a line added). Henry asked for premium details with a design reason and "Apple, but for
this industry", with an open mind. Each of 16 to 20 changes the card's structure, not a line in it,
and still asks one question with a default answer, everything else one tap away.

Shared: C's kit (`shared/kit.tsx`: `useCard`, `CardTail` for the email preview and the Other options
sheet through `_lab/parts.tsx`, `CardDone`, `useCaseData`, `useMinutesLeft`, `sourceQuote`), so
`decide:` and `rows:` variants still combine. Every rule under `.lab-card-NN`; 16 also reaches the
frame with `:has(.lab-card-16.c16-focus)`, which matches only while that variant is on screen.

| nn | slug | Structure | References (boards) |
|---|---|---|---|
| 16 | focus | The question owns the screen: the situation panel steps back (an inspector toggle top right brings it), the card centres in the whole work area, the question is the one large line, answers centred with the default on the trailing side | Superhuman Get Me To Zero dialog (PP needs-05), HEY Focus (PP needs.md 14), HIG Alerts (centred title, default trailing; raw hig-alerts.md) |
| 17 | timetable | The deadline organises the card: a time column (now, decide by, then) like a timetable, a rail between now and the deadline with a now dot that walks down the hour; situation at "now", question and answers at the deadline, what follows under "then" | HIG Live Activities (defined start and end, raw hig-live-activities.md), Flighty times (PV card-13), time left as its own column (PV needs-14) |
| 18 | two-roads | The question splits the card: a drawn switch under it leads to two roads side by side, each followed to its end (you, the agent, the order) with its own button at the foot; the suggested road raised and drawn in ink | approval flow as steps (PV card-06), Polar consequences (PV card-11), Stripe Radar per-action consequences (PP 13) |
| 19 | mac-alert | The card as a macOS alert at its best: a floating panel, the Bahn mark as the app icon, the question as the bold message, the situation as informative text, an accessory "Details" disclosure with the first-hand words, buttons on the trailing edge ("Other options…" with the ellipsis, the default last), Return answers | HIG Alerts macOS anatomy (raw hig-alerts.md), Claude in Chrome permission prompt (PP chat-05b), Superhuman dialog (PP needs-05) |
| 20 | your-turn | A conversation rhythm: the agent's turn on the left (its mark, the legwork it did, what it found, its question), the person's single answer on the right with the deadline written as "Your answer by 13:00", the legwork one tap away | Hark short confirms (PV chat-05), Zendesk pre-approved action log (PP card-05), Claude in Chrome plan approval (PP chat-05) |

Different from 01 to 15: 16 hides the side panel and centres (none does); 17 puts a time column
beside the card (03 is a strip on top, 10 steps after the answer); 18 follows each answer to its end
in two raised columns under a drawn switch (09 is two buttons with one sentence each); 19 floats the
card as a panel with an icon column and trailing buttons (01 is an iOS stack in the page); 20 splits
agent and person left and right (15 is the agent's note with the answers under it, all on the left).

Kept everywhere: the verb from `answerFor`, red within the hour (semibold red-700 plus the map's red
dot), two weights, two greys, no chips, no "·", no caps, no numbered circles, the ramp tokens only.
Long text: Volvo (156 characters) and the Bentley (CD-420442, Sofie) set into the Volvo's card.
