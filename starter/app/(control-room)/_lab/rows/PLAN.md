# rows: the disclosure rows under the card and the Other options sheet (builder RR, variants 01 to 08)

Written 25 Oct ~00:20. Parts: `Rows` (CaseRowsListProps: thread, missing, why, whyTitle, chatOpen,
onTalk, talkRef) and `OptionsSheet` (OptionsSheetProps). Today: "Talk it through" with the kind line
("New kind of case"), "Why it came to you" (Stopped / Needs / Yours), then the needs slot's row
"Other tasks N", and Other options as a centred modal sheet: pick a step, then one tap on a reason.

Coordination with `needs` (PLAN-N1, PLAN-N2): N1 owns the queue (previous/next, auto-advance, later,
keys, dock, skip) and N2 the list (time groups in place 09, palette 10, list as the side panel 11,
menu counts 12, place bundles 13, list view 14, split column 15). Nobody took "a sheet from Other
tasks"; this slot does it in 06. A rows variant draws its own Other tasks only while no needs
variant is chosen (`?v=needs:nn` wins: then it renders `<NeedsRow />` in its place), so
`?v=rows:03,needs:09` still shows N2's list. Where a rows variant draws Other tasks it must hold at
3, 12 and 37 tasks without running off the page: 01 names the next one and caps the list, 03 opens a
popover that scrolls, 06 opens a sheet with a filter field.

Facts: at Henry's Safari size (CSS 1064 x 544) the rows start near the fold under the card; Talk it
through has no conversation on cases without one (`missing`); the thread has the agent's opener and
the kind's knowledge (`knowledgeWords`, `gateWords` in chat-words.ts); Why it came to you is three
short facts on the Ferrari.

| nn | Slug | The idea | Parts | References |
|---|---|---|---|---|
| 01 | sublines | Every row says what is inside on a grey second line, so most people never open one: the kind line, the first fact of why, the next task by name. Other tasks opens in place, five at most, then "Show all 36". | Rows | Okta getting started (rows-03), partnership collapsible (rows-07) |
| 02 | settings-group | The rows as one inset grouped list (Apple Settings), hairlines between, one open at a time inside the group, arrow keys between the headers. | Rows | Apple HIG lists and tables, Axiom one-open rows (rows-01) |
| 03 | links-line | No rows: one quiet line of text buttons under the card (Talk it through, Why you, 2 other tasks); Why and Other tasks open as popovers that scroll; the card keeps the whole fold. | Rows | Zendesk "Details" beside the actions (card-03), Linear why popover (rows-01 product), HIG popovers |
| 04 | action-list | Other options as Raycast's action panel anchored to the button: each step with its consequence and a number key; picking one turns the same panel into the reasons, also numbered. | OptionsSheet | Raycast action panel, Superhuman Command teaches keys |
| 05 | panels | One panel at a time: Why it came to you and Other options open as the side panel, like Talk it through opens the chat; no scrim, the card stays readable. | Rows, OptionsSheet | Apple HIG sheets ("use a panel ... observe results"), M3 side sheet 400dp |
| 06 | tasks-sheet | Other tasks opens a sheet in the same language as Other options: a filter field once there are more than eight, the rows sorted by decide-by, arrows and Enter. | Rows | Apple HIG sheets, WAI-ARIA listbox type-ahead (rules.md 5) |
| 07 | agent-preview | Talk it through shows the agent's own first line and how far this kind is from the agent doing it alone, so the conversation invites itself and the loop shows on every case. | Rows | Linear related-issue preview (rows-01 product), Intercom Copilot panel (chat-04) |
| 08 | bottom-sheet | Other options rise from the bottom of the card's column with Apple's two detents: medium first (the step, what it changes, the reasons as one-tap buttons, the question still visible above), large when there is more to read; a grabber switches. | OptionsSheet | Apple HIG sheets (detents, grabber, "keep sheet interactions brief") |

Changed while building: 08 was "compare-sheet" (every step side by side), but the props carry only the alternatives, not the agent's suggestion, and the Ferrari has one alternative, so a comparison would show one column. The bottom sheet replaces it.

Motion per research/premium/product/rules.md: hover 100 ms on background, popovers 150 ms in / 100 ms
out (8 px and fade), panels 250 ms in / 200 ms out with `cubic-bezier(0.2, 0, 0, 1)`, all inside
`prefers-reduced-motion: no-preference`. No chips, no pills for state, no "·", no numbered circles
(number keys are shown as plain keycaps in grey, the Raycast way), no caps.
