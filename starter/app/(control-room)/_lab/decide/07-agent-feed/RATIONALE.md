# decide 07: Agent feed

**Reference**: Zendesk pre-approved actions as log lines, https://support.zendesk.com/hc/en-us/articles/7051314237466-Using-auto-assist-to-solve-tickets, shot `research/premium/product/shots/card-05-zendesk-preapproved-action-log.png` (board `product/decide.md` 09); Linear triage, accept then the default status, https://linear.app/docs/triage (board `product/decide.md` 08); Dock "Request sent! You'll hear back...", https://nicelydone.club/examples/screens/958c8a59-c5a8-45e0-8314-87824edbe172, shot `research/premium/visual/shots/decide-07-dock-request-sent-next.png`.

**What it borrows**: Zendesk shows what the AI did as plain grey lines with a tick; Dock's success says who acts next. Here Send turns the email panel into "What happens now": the email to Kovellin (Undo while it can still be held back), the agent calling Calverona Hamburg, the follow-up at 10:00, and the decision going into the case record. After the decision the card keeps the same log, read back from the case's own steps once the agent's call-back has run, and ends on the kind's count ("Seller hold on the car, 1 of 16").

**Why it helps**: this is the loop closing in front of the person: her yes, then the agent's legwork, in the order it happens, in the room's own words. Nothing to interpret, every line one sentence.

**Trade-off**: more lines than any other variant; with a slow live model the "at work" line can sit for a while (the card looks again every 1.5 s, six times).
