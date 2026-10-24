# decide 02: Undo in the button

**Reference**: Night Drive "Added to Night Drive / Undo" (Diana Larussa), https://dribbble.com/shots/27752078-Add-to-Playlist-Dark-Music-App-UI-Component-Music-Player-Save, shot `research/premium/visual/shots/decide-02-night-drive-undo-toast.png`; Untitled UI "Undo 5s", shot `research/premium/visual/shots/decide-01-untitled-undo-countdown.png`; Polaris toast timing (10 s with an action, paused on hover) in `research/premium/product/rules.md` section 4.

**What it borrows**: Night Drive docks the confirmation at the foot of the same panel, where the eye already is; Untitled UI puts the time left on the Undo itself. Here Send turns into Undo in the very same spot, with a ring that empties over 10 s and "Goes to Kovellin in 7 s" beside it; afterwards the foot reads "Sent to Kovellin Automobilhandel at 12:04" and the email stays open as the record of what went.

**Why it helps**: the pointer is already on the button, so undoing a slip costs no travel (Fitts); the text greys the moment it is committed, so nobody wonders whether it went. After the decision the card shows the kind's count moving, "New kind of case" sliding away for "1 of 16", which is the loop closing in one line: this answer teaches the agent.

**Trade-off**: a ring is one more moving thing in a calm room; the count needs one read of the case afterwards (`/api/cr/cases/:id`).
