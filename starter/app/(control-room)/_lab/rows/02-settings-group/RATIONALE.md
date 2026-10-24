# rows 02: One inset group, one open at a time

- Reference: Apple HIG Lists and tables (https://developer.apple.com/design/human-interface-guidelines/lists-and-tables, `research/premium/rule/shots/rows-hig-lists.png`): inset grouped lists, "Keep item text succinct", "limit the number of rows". Axiom (https://nicelydone.club/examples/screens/464a9633-86bf-4b04-a96b-0b4c85bd2b73, `research/premium/visual/shots/rows-01-axiom-disclosure-rows.png`): one row open, the rest closed, hairlines between.
- Borrowed: the three rows as one rounded group on the raise colour (Settings), hairlines inset from the left, the open row grows inside the group and the others stay one line; opening one closes the other (accordion). Arrow keys, Home and End move between the headers (WAI-ARIA accordion).
- Many tasks: Other tasks opens inside the group as a list that scrolls in place (at most about 17 lines), so 37 tasks never push the page.
- Why for ops: the rows read as one object, "more about this case", clearly apart from the decision above them; one open at a time keeps the screen to one question.
- Trade-off: a filled group is heavier than today's plain rows and draws a little attention from the black button.
