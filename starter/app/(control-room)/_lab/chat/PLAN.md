# chat: plan (builder T, 24 Oct ~23:05)

Slot `chat` = "Talk it through": opener, thinking state, tool steps, messages, field, voice, the
carry-out offer and its confirmation. Part: `ChatPanel { thread, personId, open, now, onClose }`.
Every variant uses the shared logic in `core.tsx` (a copy of today's CaseChat state: send over SSE,
the real decide action on "Send the email", the lab fixtures), so variants differ in structure and
interaction, not in behaviour. Today's problems seen in `chat-00-*`: the opener is one six-line
paragraph that repeats the card; "3 steps" says nothing until opened; "Thinking" is vague; the offer
is two buttons floating under a long answer.

Extra lab states this slot reads itself (not in states.json, shot by `research/premium/chat-builder/extra-shots.mjs`):
`?voice=listening|speaking` (the voice state with a fixed level and transcript) and
`?chat=offer&decided=1` (the offer right after the yes; nothing saved).

| nn | slug | The idea | Axes | References (boards) |
|---|---|---|---|---|
| 01 | two-lines | The opener is the agent's own two sentences that matter (what is new, what it rests on); everything else one tap away; two real questions to start with as quiet rows | opener, input | Input (visual chat-07), Graceview (visual chat-10), Apple HIG Generative AI "example inputs" |
| 02 | brief | Intercom's copilot brief: the steps as one plain sentence on top, each answer ends with where it comes from, the offer as a card that names who gets it and what happens next | tool steps, offer | Intercom Copilot (product chat-04), Fin Operator (visual chat-01) |
| 03 | checklist | The wait is a live checklist on a thin rail: ticked steps, the running one in its own words, "Writing the answer"; it folds into "Read 3 things" | thinking, steps | Origin (visual chat-02), Apple HIG "specific, reassuring feedback" |
| 04 | voice | Voice first: a round talk control as the field, the newest answer as large captions, the transcript above in grey; listening and speaking states; approval only on screen | voice, messages | ElevenLabs widget (product chat-03), ChatGPT Voice FAQ (product board 08) |
| 05 | answer-first | Every answer leads with its first sentence in ink; the rest is grey and folds after three lines; the person's question is a small grey heading, no bubbles | messages, density | Fin Operator "The gap:" (visual chat-01), Profound (visual chat-04), Mutiny (visual chat-06) |
| 06 | approve | The offer takes the field's place as an approval card: Enter sends, Esc says not now, one line on what the agent never does alone; the done state in place | offer, confirmation, keyboard | Zendesk auto assist (product card-04), Claude in Chrome permission (product chat-05b) |
| 07 | case-log | The conversation as the case record: names and times on every turn, the agent's steps as event lines, the decision as the last event "logged with your reason" | messages, steps, confirmation | Zendesk pre-approved action line (product card-05), GitHub Copilot rationale (product board 09) |
| 08 | glow | A floating panel lifted off the page, the question in large type like Ask Siri, and while the agent works the panel's edge breathes in the agent's colours instead of a spinner | placement, thinking, voice | Apple Intelligence / Siri (chat-builder shots), Untitled UI side panel (visual chat-09) |
| 09 | inline | Under the suggestion: the conversation lives in the card under the rows, only the latest exchange shows, earlier ones fold, the situation stays beside it | placement | Intercom Copilot (inline in the inbox), v4 placement test (bilder/v4/chat/placement-*) |
| 10 | replies | The yes is a reply: under the agent's offer, "Send the email" and "Not now" sit like Messages suggestions; the tap becomes your words and the agent answers in one sentence with the time | offer, confirmation | Hark (visual chat-05), Apple Messages suggestions (chat-builder shots), Mutiny "Done" (visual chat-06) |

Motion: hover 100 to 150 ms colour; panel 250 ms in / 200 ms out with `cubic-bezier(0.2, 0, 0, 1)`;
steps in 200 ms; nothing bounces; every loop stops under `prefers-reduced-motion`.
Words: agent, person, pickup place, order, gig; never ticket, human, escalate, AI, assistant.
