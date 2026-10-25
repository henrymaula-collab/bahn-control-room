# Bahn Control Room

Agents do the legwork on every order and bring a person only what needs a decision, with an agent next to that decision that already holds the order, the messages, the calls, the pickup place's history and what people decided before. The person can talk the case through with that agent, by text or by voice, and then decide. Each decision, with its reason and the conversation, becomes the case record, and when enough people have answered one kind of case the same way, the agent proposes to handle that kind alone and a shift lead turns it on.

Built by team Bali for Bahn's Car Delivery Control Room challenge at the Prompt Operations Hackathon, 24 to 25 October 2026. Every order, person, place and message in here is made up: the orders come from Bahn's challenge dataset, the ops team and its past decisions are ours.

## Quick start, no API keys

You need git, Node.js 24 or newer, and Docker with Compose. Ports 3000, 5438, 9009 and 9010 should be free (if not, see [docs/running.md](docs/running.md)).

```sh
git clone https://github.com/henrymaula-collab/bahn-control-room.git
cd bahn-control-room/starter
cp .env.example .env
npm ci
docker compose up -d --wait   # Postgres on 5438, attachment store on 9009 and 9010
npm run db:push               # create the tables
npm run db:seed               # Bahn's 100 made-up orders
npm run attachments:seed      # their documents and photos
npm run db:seed:cr            # the made-up ops team, its past decisions and case records
npm run demo:reset            # the demo's starting point
npm run dev
```

Open http://localhost:3000. You start as Aino, an operations associate. The first time each page opens, the dev server compiles it, which can take up to half a minute.

The first run takes a few minutes while Docker and npm download; after that each step above takes seconds. `.env.example` runs everything without keys: the chat answers from a script (`CR_CHAT_PROVIDER=mock`), the agent plays back recorded runs (`CR_AGENT_PROVIDER=replay`), and the voice button turns any recording into one fixed question. The rest is the real app on a real database.

## The demo path

Two rounds of the same new kind of case, then a shift lead lets the agent take over a kind that people already agree on. Run `npm run demo:reset` any time to start over (about 2 seconds, then reload the page).

1. **Overview.** Aino's welcome says how many cars need her and by when ("Three cars need you by 13:00.") and has one button to her first task. The bar floating on the map, "On the road today", splits every car into On plan, Agent working and Needs a person. A red dot opens its car in a small card.
2. **Your tasks.** Open the Ferrari Roma (CD-420458, Calverona Hamburg): pick it from "Up next" in the dock at the bottom, or go to `/tasks/case-ord-00458-agent`. The time line at the top reads left to right: when the agent sent it to Aino, Now, Decide by 13:00, and what the agent does Then. Under the headline, "Called Calverona Hamburg in German, and 6 more steps" opens everything the agent has already done. The question has one answer, "Send the email", and Other options. The panel on the right shows both places on a map and where the order stands.
3. **Talk it through.** The row under the card opens the conversation. Its grey line says "New kind of case", because nobody has decided a seller hold before. Ask "Has this happened before?" or "What did the pickup place say on the call?"; a line above each answer shows what the agent read. Ask "Can you show me the email?" and the email comes into the chat. "See the email" opens it whole: To, Subject, Language, the German text, "In English" for a translation, and Edit. The microphone asks by voice.
4. **Decide by saying it.** Type or say "send the email". It shows "Sending" for 5 seconds with Undo, then the receipt: Email sent, what the agent does next, In History and Next case. The card now says "Decided by Aino" and what the agent carries out. The card's own "Send the email" button does the same through the email sheet.
5. **The dock and Send to a colleague.** Next case opens the next task in the dock's order; ‹ and › walk Your tasks and "Up next" lists the rest. On the next case, "Send to a colleague" shows who the agent suggests and the fact that put that person first, takes an optional line from Aino, and moves the case to that person's tasks. Undo stays in the dock for 10 seconds.
6. **History.** The Ferrari is under Today: the car, the kind of case ("Seller hold on the car"), what was decided and when. Click the row for the record. Talk it through still works there: ask about the finished case, or "show me the email" to see the email that went.
7. **Round 2.** Switch person at the bottom of the side menu to Sofie. A second seller hold has come to her: the Bentley at Orvendin Cars Stockholm (CD-420442). Its Talk it through row says "Decided once, by Aino". Open it: the agent starts with what Aino chose and says that, with one case behind it, the call is still Sofie's.
8. **Kaisa's rule.** Switch to Kaisa, the shift lead, and open Know-how. The agent asks to handle "Details disagree while the gig is posted" alone: 29 of 30 answers agree, from 4 people. It shows the case of that kind waiting now, the Mercedes-Benz EQE at Arvelano Hamburg (CD-420347) in Mikko's tasks, as Today against With the rule. "Turn it on": the agent pauses that gig and the case leaves Mikko's tasks. In History, set "Decided by" to Agent to see it with the rule and who turned it on. The rule can be turned off on the same page.

## Switching on the real providers

Create `starter/.env.local` (git ignores it) with the keys you have, then stop `npm run dev` and start it again:

```sh
ANTHROPIC_API_KEY=<your Anthropic API key>
ELEVENLABS_API_KEY=<your ElevenLabs API key>
CR_CHAT_PROVIDER=api
```

| Part | Without keys | With keys |
|---|---|---|
| Talk it through, text | `CR_CHAT_PROVIDER=mock`: scripted answers from the same case data and tools | `CR_CHAT_PROVIDER=api`: Claude through the Anthropic API, streamed, with read tools over the order, its messages and calls, the pickup place and earlier decisions. Model `claude-sonnet-5-5`; set `CR_CHAT_MODEL` to change it |
| Talk it through, voice | The microphone gives one fixed question and the answer comes back as text | Automatic when `ELEVENLABS_API_KEY` is set: ElevenLabs speech to text (`scribe_v2`) and text to speech (`eleven_v4_turbo`), the same Claude answers |
| The agent's legwork | `CR_AGENT_PROVIDER=replay`: plays back the recorded runs in `starter/traces/` | `CR_AGENT_PROVIDER=api` runs the agent live on the Anthropic API; `claude-code` runs it through the Claude Agent SDK on your local Claude Code login, no key needed |

Keep `CR_AGENT_PROVIDER=replay` to see exactly what the demo shows: `demo:reset` starts from the recorded runs either way. If a key is missing or empty, the app falls back to the keyless mode on its own. [docs/running.md](docs/running.md) lists every setting and shows how to run the agent on one order from the terminal.

## What is where

| Path | What |
|---|---|
| `starter/` | The app: Next.js 16, TypeScript, Postgres through Drizzle, run from this folder |
| `starter/app/(control-room)/` | The screens: Overview, Your tasks (card, situation panel, Talk it through, email sheet, the dock, Send to a colleague), History, Know-how (the shift lead's rule), and the side menu's Orders, Agents and Team |
| `starter/app/api/cr/` | The control room API: desk, cases, decisions, chat, voice, history, kinds of case, trust rules, agent runs |
| `starter/lib/control-room/` | The engine: order checks, cases, routing to a person, kinds of case (`kinds.ts`), the gate that decides when a kind may run alone (`trust-gate.ts`: 16 agreeing answers from more than one person), case records and History |
| `starter/lib/agent/` | The agent: its tools, the loop, the call it makes to a pickup place, lessons, providers (`api`, `claude-code`, `mock`, `replay`) and traces |
| `starter/lib/chat/` | Talk it through: what the agent knows about a case, its read tools, the prompt and the providers; "send the email" and "show me the email" are read before any model (`intent.ts`) |
| `starter/lib/handoff/` | Send to a colleague: who the agent suggests and why (`pick.ts`), and the one order of Your tasks that the dock and Next case follow (`order.ts`) |
| `starter/lib/voice/` | Speech in and out through ElevenLabs; the key stays on the server |
| `starter/lib/demo/`, `starter/lib/depth/` | Made-up depth: full records for the demo cases, a short thread, a call and documents for every other case |
| `starter/scripts/` | Seeds, `demo-reset.ts`, the agent and chat command lines, smoke checks |
| `starter/traces/` | Recorded agent runs that the `replay` provider plays back |
| `starter/app/(starter)/` | Bahn's original starter pages (the board of lanes at `/board`, inbox, customers, drivers, places), kept as they were |
| `docs/` | Running notes: other ports, starting over, every setting, checks |
| `PARTICIPANT-BRIEF.md`, `OPERATIONS-CONTEXT.md`, `dataset/`, `attachments/`, `mockups/`, `check_packet.py`, `Bahn-hackathon-brief.pdf` | Bahn's challenge packet as it was handed out. `dataset/README.md` and `dataset/SCHEMA.md` explain the data |
