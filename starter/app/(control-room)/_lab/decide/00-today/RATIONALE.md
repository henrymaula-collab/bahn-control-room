# decide 00: today

What it is: today's component in the demo app (branch `v4`), the email preview panel (To, Subject, Language, the text, In English, Send/Edit/Cancel) and the card right after a decision ("Decided by Aino at 12:04", "Next case").

Where: app/(control-room)/_ui/send-preview.tsx `SendPreview`, _ui/question.tsx `DecisionDone`.

Why it is here: every comparison starts with today, so a variant has to beat it to be worth adopting.
