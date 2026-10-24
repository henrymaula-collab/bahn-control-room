# menu 05: Your tasks fly out on hover

References: Cushion's "Switch to" row with a fly-out (https://nicelydone.club/examples/screens/e8afcdc4-25ca-4965-9968-1e79c82c6868, `research/premium/visual/shots/menu-04-cushion-switch-to.png`); Apple HIG Sidebars, no more than two levels (https://developer.apple.com/design/human-interface-guidelines/sidebars, raw `research/premium/product/raw/pp/hig-sidebars.md`).

Borrowed: a fly-out panel from one menu row, opened by hover (with a 120 ms intent delay) or keyboard focus, closed by Escape or leaving; the rows in the welcome panel's style (car, place, decide-by time, red within the hour); the first seven, then "All N tasks".

Why it helps: Henry's problem with the nested list was that it fails with many tasks. Here the menu keeps only the count, and the list is one hover away from any page, the same at 3, 12 or 40 tasks (try `&many=40`). Arrow keys walk the list.

Trade-off: hover menus are invisible until found, and on a touch screen the fly-out only opens by focus; the Other tasks row under the card remains the reliable way.
