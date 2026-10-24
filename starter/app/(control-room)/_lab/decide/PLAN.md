# decide: plan (builder D, 24 Oct ~23:10)

The moment the loop closes on camera: Aino reads the German email, taps Send, the agent carries the
decision out (the replayed call-back), the decision lands in the case record and History, and the
room moves on. Every variant keeps Henry's rule: the email is shown before it goes (To, Subject,
Language, the full German text, "In English", Send / Edit / Cancel).

Shared engine (`_shared/`, not a variant): a send window. Send does not post at once; it starts a
10 s window (Polaris: a toast with an action stays 10 s; Gmail Undo Send 5 to 30 s), paused on hover
and focus. Undo (button, Z or Cmd+Z) cancels and reopens the email; at 0 the window calls the card's
own `onSend`, so the decision, the carry-out and History run exactly as today. Leaving the case
inside the window sends at once (Gmail sends when you move on). Lab-only photo states, read from the
URL by the variants: `send=wait` (inside the window, frozen, never posts) and `send=sent` (the window
passed, the agent at work). `decided=1` is the moment after. After a real decision the Done parts read
the case back (`/api/cr/cases/:id`, `/knowledge`) for the agent's new steps and the kind's count
("Seller hold on the car, 1 of 16").

| nn | slug | Preview (where, translation) | Confirm and undo | After the decision | References (boards) |
|---|---|---|---|---|---|
| 01 | undo-pill | side panel, Mail-like header rows, In English under the text | panel closes on Send, a dark pill under the card: "Sending to Kovellin" + Undo + seconds | receipt as the card's first line; Next case becomes the primary | Gmail Undo Send (PP 01), Untitled UI undo countdown (PV 01), Profound "view" (PV 08) |
| 02 | undo-in-button | side panel | Send turns into Undo in the same spot, a ring drains 10 s; the panel stays as the record of what went, docked receipt at its foot | compact done with the kind's count moving ("New kind" to "1 of 16") | Night Drive docked toast (PV 02), Untitled UI (PV 01), Polaris 10 s (rules) |
| 03 | inline-draft | inline in the card under the question, the situation stays beside; German / English as a two-way switch | the draft folds into one receipt line with Undo | the answered question with a check; the next case as a quiet row | Zendesk auto assist (PP 04), Attio agent draft (PV 10), BuyOps inline (PV 05) |
| 04 | compose-sheet | a centred sheet, Apple's nav bar: Cancel / The email / Send | the sheet drops away; "Undo Send" bar bottom left | a calm centred moment: one tick, one sentence, Next case | Apple HIG sheets and alerts (PP 05, rules), Profound published (PV 08), Gmail (PP 01) |
| 05 | side-by-side | the panel widens: German and English in two columns, sentence by sentence | top toast with Undo | "What changes" as was / now lines from the option's changes | Flighty was/now (PV card-13), Easymail sending details (PV 09), Gmail (PP 01) |
| 06 | send-and-next | side panel; split primary "Send and next" with "Send and stay" one tap away | the next case opens at once; a toast that survives the move holds Undo (Undo brings the email back) | if you stayed: "Next case in 5 s" with Stay | Superhuman Inbox Zero + Z undo (PP needs 01/03, decide 02), Zendesk Play "Submit and next / Stay" (PP needs 05, decide 03) |
| 07 | agent-feed | side panel | after Send the panel becomes the agent's live log: Undo row first, then the sent email, the call, the follow-up | the same log in the card, from the case's real steps after the decision | Zendesk pre-approved action log (PP 09), Linear accept then default status (PP 08), Dock "what happens next" (PV 07) |
| 08 | receipt-panel | side panel | the panel turns into a receipt (Lightspark "Payout submitted"): Sent, one grey sentence, Undo | receipt stays in the panel with "In History" and "Next case"; the menu count drops (Stripe Radar) | Lightspark (PV 06), Stripe Radar queue (PP 07), Profound (PV 08) |
| 09 | interlinear | side panel; In English puts each English sentence under its German one, hover pairs them | Cmd+Enter sends; small toast bottom right with Undo | a short timeline of what happens now, with times, ending at the kind's count | Linear toast (brief), Zendesk log lines (PP 09), Polaris 10 s (rules) |
| 10 | full-focus | the email takes the whole work area at reading width, like a letter; Esc goes back | the letter slides up and away; Undo under the card | the queue moment: "2 left", the next case's car and place as the primary | HEY Focus & Reply (PP needs 14), Superhuman (PP 02), Apple HIG motion (rules) |

Spread: preview place (panel x6 in different forms, inline, sheet, wide, full focus), translation
(disclosure, two-way switch, columns, interlinear), confirm (pill, in-button, fold, bar, toast,
split, log, receipt), after (receipt line, count, answered question, calm tick, what changes,
auto-advance, live log, receipt panel, timeline, queue). No chips, no "·", no caps kickers, no
numbered circles; ink, ink-2, now, raise, press only; motion 150 to 250 ms, ease-out, off under
reduced motion.
