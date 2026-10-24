# card: 15 concepts (builder C, 24 Oct ~23:05)

The card = deadline, situation, question, primary + secondary, the "what happens next" line.
Henry's bar: one question with a default answer, everything else one tap away; the situation and
the question are two blocks on the ramp; a red deadline must read as danger; calm, premium.

Shared kit in `card/shared/` (not a variant: the shot pipeline only picks `NN-slug` folders):
`useCard` (today's `useQuestion` + the answer verb), `CardTail` (the email preview and the Other
options sheet through `_lab/parts.tsx`, so `decide:` and `rows:` variants still combine),
`useCaseData` (lazy GET /api/cr/cases/:id for evidence: calls, facts, agent steps, knowledge),
`useRoomClock` (the room's clock from /api/cr/overview, for minutes left). CSS under `.lab-card`.

| nn | slug | Axis it explores | References (boards) |
|---|---|---|---|
| 01 | question-first | hierarchy flipped: the question is the title, the situation its message; stacked full-width answers | HIG Alerts (PP 10), HIG Buttons (PP 09), Daybridge (PV card-10) |
| 02 | consequences | the next line as "If you send the email:" with each change, new value first, old in brackets | Polar (PV card-11), Flighty was/now (PV card-13), Stripe Radar consequences (PP 13) |
| 03 | live-deadline | the deadline as a live strip: time, minutes left, a bar that drains through the last hour | HIG Live Activities (PP 12), Flighty (PV card-13) |
| 04 | why-popover | evidence one tap away in a popover beside the answer: what the agent found, the track record, the alternative | Linear Triage Intelligence (PP 01, 02) |
| 05 | legwork | the agent's done steps as one grey log line above the question, expandable | Zendesk pre-approved actions log (PP 05) |
| 06 | command-bar | expert: keyboard first, every option in an action list (Cmd+K), Cmd+Return for the default | Raycast action panel (PP 15), Claude in Chrome plan approval (PP chat-05) |
| 07 | cycle | the options in place: step through them, the question, button and next line change together | Superhuman Instant Reply (PP 07) |
| 08 | choose-one | every option as a radio row, the suggestion preselected, one submit named by the choice | GitHub Submit review (PP 16), purchase request stepper (PV card-15) |
| 09 | two-answers | the answers as two tiles, each a verb and its consequence | HEY Screener (PP 17), Stripe Radar actions (PP 13), shift approve (PV card-09) |
| 10 | next-steps | what happens next as steps on a hairline: you, then the agent, then the gig | approval flow sentence (PV card-06), Superhuman Auto Reminders (PP 08) |
| 11 | message-first | the actual words that go out, in the card, original language with English one tap away | Zendesk auto assist (PP 03, 04) |
| 12 | review-frame | header (car, reference, deadline) / body / a footer bar with the answer at the trailing edge | Stripe Radar review page (PP 13), Zendesk footer (PP 03), sub work order (PV card-08) |
| 13 | labelled | newcomer: three small grey sentence-case labels say what each block is | Claude in Chrome plan approval (PP chat-05), partnership details (PV card-03) |
| 14 | source-quote | evidence as the pickup place's own words under the situation; the call one tap away | approval request card quote (PV card-04), Linear "why" (PP 01), exception summary (PV card-02) |
| 15 | agent-asks | who is asking: the agent's short note, signed and timed, the person answers | Zendesk auto assist box (PP 03), Claude in Chrome plan approval (PP chat-05) |

Coverage of the axes: hierarchy 01, 13, 15, 12; deadline 03, 12, 06; actions 01, 06, 07, 08, 09, 12;
next line 02, 10, 09; evidence 04, 05, 11, 14; density expert 06, 05, newcomer 13, 08.
Every variant keeps: the verb from `answerFor`, red deadline within the hour (semibold red-700 plus
a brand-red dot, the map's "needs a person"), no chips, no "·", no caps, two weights, the ramp.
