# rule: Kaisa meets the agent's proposal to handle a kind alone (builder RR, variants 01 to 06)

Written 25 Oct ~00:05. The demo gap: the video's fast-forward (Kaisa, shift lead, turns on "Details
disagree while the gig is posted", 29 of 30 agree, 4 people) has no screen in the demo app. The
moment has to make the loop's payoff visible: who answered and how they agreed (one tap away),
what the agent will do alone from now on, the switch, and how Kaisa takes it back. Calm, no tiles.

Facts the plan rests on (read in cr_lab, not guessed):
- The 30 answers are real rows of History (`GET /api/cr/history?person=kaisa&scope=everyone`, kind
  `facts_disagree_open_gig`): Jonas 9, Mikko 8, Lea 7, Sofie 6, from 12 Aug to 19 Oct, each with a
  car, a pickup place, a date and the person's own reason (four reasons, repeated). The one answer
  that differs is Sofie's, CD-411328 Porsche Taycan at Avelrano Odense, 6 Oct: "Go with what the
  pickup place said and update the driver's instruction", "The pickup place's own word is newer
  than the note."
- The gate (`GET /api/cr/kinds`): at least 16 agreeing answers, at least 2 people, lower bound 0.806;
  this kind is at 0.827. People took 9 minutes on these at the median.
- One case of the kind is waiting now: CD-420347 Mercedes-Benz EQE at Arvelano Hamburg, in Mikko's
  tasks. Turning the rule on makes it `handled_by_agent` at once (checked through the real route,
  then put back with `POST /api/lab/rule`). So "what changes next time" can be shown on a real case.
- The engine: an ON rule stays, marked blocked, if the kind stops passing the gate (loop.ts
  kindRules); Turn it off is the same route with "off". Nothing else is backed (no trial mode, no
  per-place scope), so no variant offers one.
- The rule page has the side panel's room reserved (WorkFrame opens "situation" by default and the
  rule item has none). 01 fills it with the evidence; the others give it back so the card centres.

| nn | Slug | The idea | References |
|---|---|---|---|
| 01 | beside | Like every case: the proposal is the card, the evidence is the panel beside it where the situation sits (the four people with their portraits and counts, the one answer that differs, their own reasons, History one tap on). | Stripe Radar rule test (past matches beside the rule), Apple HIG panels |
| 02 | switch | The rule as a setting, not a question: When / Then in a grouped list and one real switch "The agent does this alone"; a Settings-style footnote says who taught it and how to take it back. | Apple Shortcuts automation ("Ask Before Running"), Linear triage rules (When / Then), Vercel Deployment Protection toggle |
| 03 | thirty | One picture with a takeaway title: the 30 answers as 30 marks in time order, the one that differs hollow; hover or arrow keys read each answer in a line under it; turning it on adds the agent's first mark at the end. | Stripe Radar rule testing, GitHub rule insights |
| 04 | first-case | What changes next time, shown on the case waiting now: Mikko's Mercedes-Benz EQE at Arvelano Hamburg, "Today" against "With the rule"; after the switch, it has left his list. | GitHub rulesets in Evaluate mode, Stripe rule testing ("estimate its future impact") |
| 05 | limits | The contract first: what the agent will do, what still comes to a person, when it stops by itself, how to take it back; Turn it on under it. | Apple Screen Time (ask first, loosened area by area, Always Allowed), GitHub rulesets (bypass, status changed without deleting) |
| 06 | gate | A checklist like GitHub's rule checks: the gate's three conditions, each met with a quiet tick (enough answers, more than one person, they agree), the people's faces on the second; Turn it on under them. | GitHub rule insights (Pass / Fail rows), Stripe "Review new rule" (evidence on top, the button at the foot) |

Spread: where the evidence lives (panel 01, footnote 02, the hero 03, a before/after 04, a
contract 05, a checklist 06); the control (button 01 03 04 05 06, a switch 02); after "on" (the
waiting case leaves Mikko's list in every variant, said in one sentence; Turn it off stays one tap).
Motion per research/premium/product/rules.md: hover 100 ms, popover 150 ms, the switch 200 ms with
`cubic-bezier(0.2, 0, 0, 1)`, all inside `prefers-reduced-motion: no-preference`. Words: Bahn's
(gig, pickup place, person), never "ticket", "human", "escalate". No chips, no pills for state, no
"·", no numbered circles, no caps.

References checked against `research/premium/rule/board.md` (helper agent, 00:15 to 00:55): Apple's Shortcuts guide no longer says "Run Immediately" (it is "Ask Before Running" / "Don't Ask"), the Screen Time page is the iOS 27 one, and GitHub's merge box is not on the captured pages, so the rationales cite what the shots show.
