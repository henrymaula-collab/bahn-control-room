# decide 01: Undo pill

**Reference**: Gmail Undo Send, https://support.google.com/mail/answer/2819488 (board `research/premium/product/decide.md` 01); Untitled UI undo countdown, https://dribbble.com/shots/27750801-Command-menu-Untitled-UI, shot `research/premium/visual/shots/decide-01-untitled-undo-countdown.png`; Profound "Published" with a view link, shot `research/premium/visual/shots/decide-08-profound-published-view.png`.

**What it borrows**: Gmail's delayed send (Send closes the email at once; it actually goes when the window ends, so Undo is honest); Untitled UI's one-sentence result plus Undo with time left, here a hairline that drains over 10 s instead of a ticking number; Profound's "the next thing is the primary button" after the result.

**Why it helps**: no "Are you sure?" on the most frequent action (Apple HIG: no alerts for undoable actions). The pill sits under the card, where the eye already is, says what goes where ("Sending the email to Kovellin Automobilhandel"), and pauses while the pointer is on Undo (Polaris). Z undoes. After it, the card's first line is the receipt ("Email sent by Aino at 12:04") and Next case is the one filled button; Return takes it.

**Trade-off**: the email leaves 10 s later than the tap, and the panel closes before the person sees the result, so the receipt lives in a floating pill rather than in the card.
