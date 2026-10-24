# Running notes

Everything here happens in `starter/`, after the quick start in the [README](../README.md).

## When a port is already in use

The app uses 3000, Postgres 5438, and the attachment store 9009 and 9010. If another Postgres or Bahn's own starter already holds one of them, give this copy other ports without editing tracked files. Create `starter/compose.override.yaml` (Docker Compose reads it next to `compose.yaml` on its own; `!override` needs Compose 2.24 or newer):

```yaml
services:
  db:
    ports: !override
      - "127.0.0.1:5448:5432"
  attachments:
    ports: !override
      - "127.0.0.1:9019:9000"
      - "127.0.0.1:9020:9001"
```

Change the same two ports in `starter/.env`:

```sh
DATABASE_URL=postgres://controlroom:controlroom@localhost:5448/controlroom
S3_ENDPOINT=http://127.0.0.1:9019
```

Then go on from `docker compose up -d --wait`. For the app itself, `npm run dev -- -p 3001` and open http://localhost:3001.

`.env` also sets `COMPOSE_PROJECT_NAME=bahn-control-room`, so these containers and their data stay apart from any other Compose project started from a folder called `starter`.

## Starting over

- `npm run demo:reset` puts the demo back where it starts: the ops team, the past decisions and case records, the proposals, the recorded agent runs, empty conversations. It takes about 2 seconds and can run as often as you like. Reload the page afterwards.
- `npm run db:seed` reloads Bahn's dataset and leaves the control room's own tables alone; `npm run db:seed:cr` reloads the made-up team and history. Run `npm run demo:reset` after either.
- When you are done: stop `npm run dev` with Ctrl+C, then `docker compose stop`. Because `.env` names the project, this stops only these two containers, and the data stays for next time.

## Faster pages

`npm run dev` compiles each page the first time it opens. For a run without that wait, build once and start the built app (the build takes about 15 seconds):

```sh
npm run build && npm start
```

## Every setting

The npm database scripts read `.env`. The app reads `.env` and then `.env.local`, where `.env.local` wins. Keys belong in `.env.local`.

| Setting | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgres://controlroom:controlroom@localhost:5438/controlroom` | The Postgres database |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | as in `.env.example` | The local attachment store; these values are only for this made-up local setup |
| `COMPOSE_PROJECT_NAME` | `bahn-control-room` | Docker Compose project name |
| `CR_CHAT_PROVIDER` | `CR_AGENT_PROVIDER`, else `mock` | Who answers in Talk it through: `mock`, `api` or `claude-code` |
| `CR_AGENT_PROVIDER` | `claude-code` when unset, so `.env.example` sets `replay` | Who does the agent's legwork: `replay` (recorded runs), `api`, `claude-code` or `mock` (no model, same tools) |
| `ANTHROPIC_API_KEY` | none | Needed for `api`; without it `api` falls back to `replay` for the agent and `mock` for the chat |
| `CR_CHAT_MODEL`, `CR_AGENT_MODEL`, `CR_CALL_MODEL` | `claude-sonnet-5-5` | The Claude model for the chat, the agent, and both sides of the agent's simulated phone call |
| `ELEVENLABS_API_KEY` | none | Switches voice on: speech to text and text to speech |
| `CR_VOICE_PROVIDER` | `elevenlabs` when the key is set, else `mock` | `mock` forces the keyless stand-in |
| `CR_VOICE_ID`, `CR_VOICE_NAME` | the voice "Sapphire" | Any ElevenLabs voice id; when your account lacks the default voice, the app uses the premade voice "Lily" |
| `CR_VOICE_LANGUAGE` | `en` | Language of the transcript; `auto` detects it |
| `CR_VOICE_MAX_CHARS` | `12000` | Most characters one server process may send to text to speech |
| `CR_SCALE` | `0` (`.env.example` sets `300`) | Adds made-up quiet orders to the Overview map |
| `CR_CLOCK` | the dataset's moment, Wed 21 Oct 2026 12:00 Helsinki time | `real` uses the wall clock; the demo's times assume the default |
| `CR_AGENT_MAX_USD`, `CR_AGENT_MAX_TURNS`, `CR_AGENT_MAX_SECONDS` | `1.5`, `16`, `300` | Limits on one live agent run |
| `DATASET_DIR`, `ATTACHMENTS_DIR` | `../dataset/data`, `../attachments` | Seed from a changed copy of the dataset (see `starter/README.md`) |

## The agent and the chat from the terminal

```sh
npm run agent -- CD-420516 --provider mock   # the agent on one order, no model
npm run agent -- CD-420516 --provider api    # the same, live (ANTHROPIC_API_KEY in .env.local)
npm run agent -- --list                      # cases, lessons, trust rules and runs
npx tsx scripts/chat.ts CD-420458 --person p-aino "Has this happened before?"
```

The agent prints what it found, with the source of each fact, its suggestion and the draft message, and writes a trace to `traces/`. Its run lands in the database like any other, so run `npm run demo:reset` before showing the demo again. `npm run agent` reads `.env.local` but not `.env`; if you moved Postgres to another port, `export DATABASE_URL=...` first.

## Checks

```sh
npm run typecheck
npm run test:chat
npm run test:voice
npm run test:agent
CR_TEST_RESET=1 npm run test:cr   # resets the database it runs on
npm run demo:reset                # so put the demo back afterwards
```

All of them pass on a fresh clone without keys. The database tests in `test:cr` skip on the default `controlroom` database unless `CR_TEST_RESET=1` is set, because they reset it.
