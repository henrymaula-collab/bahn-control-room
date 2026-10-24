# Night lab: the variant contract

The lab is branch `lab` in `app-lab/`, served at http://127.0.0.1:3160 (database `cr_lab`).
`?v=card:07,needs:03` swaps those slots on the real pages (Overview, Your tasks, the side menu).
No `?v=` (or `:00`) = today's components, pixel-identical to v4 (checked against a pristine v4
build on the same database: identical except the breathing agent dots' animation phase).

## 1. A variant

```
_lab/<slot>/<nn>-<slug>/        nn = two digits (01..15), slug = lowercase ascii and dashes
  <name>.tsx                    "use client"; the part(s) below, with the SAME props as today's
  <name>.css                    imported by the .tsx; EVERY rule under the variant's root class
  RATIONALE.md                  5 to 8 lines (below)
```
Register it with one line in `_lab/<slot>/index.ts` (yours; never edit `registry.ts`):
```ts
import { TriageQueue } from "./07-triage-queue/queue"
"07": { slug: "triage-queue", title: "Triage queue", parts: { Row: TriageQueue } },
```
A part you do not define keeps today's. The slug in index.ts must equal the folder's.

**CSS trap**: the registry bundles every variant into every page, so every variant's CSS is loaded
on every page, also with no `?v=`. An unscoped selector (`.btn`, `.question h1`) changes today's
page and breaks the pixel identity. Root class per variant: `.lab-<slot>-<nn>`, every selector
starts with it. Use the tokens (`--type-*`, `--lh-*`, `--cr-u`, `--ink`, `--ink-2`, `--now`,
bx-tokens.css); never vw/vh/cq in `font-size` (Safari page zoom, app-notes/v4-chatui.md "Loop 3, S").
No new npm dependencies.

**RATIONALE.md** (rendered on /lab): `# <slot> <nn>: <title>`, then the reference it borrows from
(name, URL, local screenshot path in `research/premium/...`), exactly what it borrows, why that
serves an ops person deciding under time pressure, the trade-off. No invented references.

## 2. Slots, parts and props (adopting = one import change at the mount point)

| Slot | Part | Props (type) | Today | Mounted in |
|---|---|---|---|---|
| `card` | `Question` | `QuestionProps` (_ui/question.tsx) | `Question` | tasks/[caseId]/page.tsx via `LabQuestion` |
| `decide` | `SendPreview` | `ComponentProps<typeof SendPreview>` | `SendPreview` | inside the card |
| `decide` | `Done` | `DoneProps` (_ui/question.tsx) | `DecisionDone` | the card once decided |
| `rows` | `Rows` | `CaseRowsListProps` (_ui/work-case.tsx) | `CaseRowsList` | `CaseRows` under the card |
| `rows` | `OptionsSheet` | `OptionsSheetProps` (_ui/question.tsx) | `OptionsSheet` | inside the card |
| `needs` | `Row` | none: read `useOtherTasks()` / `useNeedsYou()` | `OtherTasks` | inside `Rows` (`<NeedsRow />`) |
| `needs` | `Top` | none | (empty) | inside `.detail`, above the card |
| `needs` | `Around` | `{ children }` = the `.detail` element | (empty) | inside `.work`: render siblings of `.detail` (grid, tasks.css l.15 to 36) |
| `needs` | `Menu` | none: read `useMenuNeeds()` | (empty) | side menu, under the sections (`<NeedsMenu />`) |
| `needs` | `Done` | `DoneProps` | (none) | wins over decide's `Done`: what comes after a decision |
| `situation` | `SituationPanel` | `{ situation, open, now }` | `SituationPanel` | side panel (portal) |
| `chat` | `ChatPanel` | `{ thread, personId, open, now, onClose }` | `ChatPanel` (+ `CaseChat`) | side panel (portal) |
| `welcome` | `WelcomePanel` | `WelcomePanelProps` (_ui/overview-view.tsx) | `WelcomePanel` | Overview; put `panelRef` on the outer box |
| `map` | `CarMap` | `ComponentProps<typeof CarMap>` | `CarMap` | Overview |
| `map` | `PinCard` | `{ info, close }` | `PinCard` | a red pin's card |
| `menu` | `Shell` | `ShellProps` (_ui/shell.tsx) | `Shell` | (control-room)/layout.tsx via `LabShell`; render `<NeedsMenu />` |
| `rule` | `RuleCard` | `RuleCardProps` (_lab/rule/00-today/rule-card.tsx) | `RuleCard` (the lab's minimal default) | tasks/[caseId]/page.tsx via `LabRuleCard` |

Combine slots: a card variant renders the sub-parts through `_lab/parts.tsx` (`SlotSendPreview`,
`SlotDone`, `SlotOptionsSheet`), a rows variant renders `<NeedsRow />` (or `SlotNeedsRow`), a
menu variant renders `<NeedsMenu />`, so `?v=card:07,decide:03,needs:05` shows all three.
On adoption replace each `Slot*` with today's component named in parts.tsx.

Logic you reuse instead of copying:
- `useQuestion(props)` (_ui/question.tsx): `save`, `pending`, `error`, `done`, `chosen`, `sheetOpen`,
  `setSheetOpen`, `preview` (the email draft), `onPrimary` (opens the email or saves), `primary` ref.
- `usePanel()` (work-frame): `open`, `setOpen("chat" | "email" | "situation" | null)`, `slot`.
- `useNeedsYou()` (work-frame, inside Your tasks): `rows` (all Needs you), `current`, `index`,
  `prev`, `next`, `times` (decide-by words, `now` = within the hour), `href(caseId)` (keeps the lab's
  params), `look`. `useOtherTasks()`: the others only. `useMenuNeeds()`: rows and times anywhere.
- `useLab()` (_lab/context.tsx): the state params below; read them to show your variant's state.
- J/K already walk Needs you (work-frame); Escape closes the chat/email panel.

Adopting a variant into v4: cherry-pick the lab's foundation commit (behaviour-neutral refactors in
`_ui/`: useQuestion, DecisionDone, CaseRowsList, WelcomePanel, NeedsRow/NeedsMenu and the Top/Around
mounts), copy the variant folder, change the one import at its mount point.

## 3. States (all by URL; the list is `_lab/states.json`, read by /lab and the shot pipeline)

| Param | Effect |
|---|---|
| `v=slot:nn,...` | the variants |
| `many=12`, `many=40` | pads the person's Needs you (menu count, Other tasks, Overview rows, J/K) with other people's real cases, the agent's cases, then real red orders without a case (made-up decide-by times, 10 min apart; a click opens the order). The lab database holds 37 in all, so `many=40` gives 37 |
| `panel=chat` / `email` / `situation` / `none` | the side panel open on first paint |
| `chat=thread` / `thinking` / `offer` | CD-420458 only: two real Q&As (app-notes/v4-depth-demo-qa.md) / plus a question mid-answer / plus the carry-out offer. No API call. Fixtures in `_lab/fixtures.ts` |
| `others=open` | Other tasks open (needs variants: show your list open) |
| `why=open` | Why it came to you open (rule: the evidence open) |
| `sheet=open` | the Other options sheet open |
| `decided=1` | the card right after a yes to the suggestion, "Decided by Aino at 12:04" (nothing saved) |
| `rule=1` (or any `v=rule:nn`) | a shift lead (Kaisa) gets the agent's proposal as a Your tasks item: `/tasks/rule-kind-facts_disagree_open_gig-pause_gig` |
| `rulestate=on` | the proposal shown as turned on (nothing saved) |

Cases: Ferrari Roma `case-ord-00458-agent` (email suggestion, new kind), Volvo V60
`case-ord-00516-agent` (156-character headline), BMW M4 `case-ord-00593-car_not_ready` (most
urgent). People: cookie `cr-person` (`aino`, `kaisa`, ...); `/lab/as?person=kaisa&to=<path>` sets it.
Rule: "Turn it on" calls the real API (`setTrustRule` action -> POST /api/cr/trust-rules/:id) in
cr_lab; `POST /api/lab/rule` puts it back to "suggested" (the shot pipeline does this itself).

## 4. Shots

`node research/scratch-lab/shots.mjs <slot> [nn ...] [--states a,b] [--sizes safari,1512x800]`
from the workspace root: every variant x state x size into `~/Desktop/Bahn-lab-bilder/<folder>/`,
then `jamforelse-<slot>-<state>.png` (Safari engine) and `...-1512x800.png`, and the header block
of the folder's `LAS-MIG.md` (write your Swedish lines under it, never inside the markers).
Typical time: about 3 s per shot, two WebKit shots in parallel (`LAB_JOBS`).
