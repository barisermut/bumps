# CLAUDE.md

Guidance for AI assistants working in this repository. Keep sessions focused — one feature per prompt, commit before starting new work.

## What this is

Bumps is a **local-only** CLI dashboard that reads Cursor conversation history and surfaces behavioral patterns. Data never leaves the machine. Standing product direction: `docs/bumps-north-star.md`.

## Commands

```bash
# Root (CommonJS)
npm install
node src/parser.js
node src/analyzer.js --project=foo --timeRange=7d
node src/server.js          # dev server → http://127.0.0.1:3456
npm test                    # Vitest: 42 tests across test/*.test.js
npx getbumps                # end-user entry point

# Dashboard (ESM)
cd dashboard && npm install
npm run dev                 # → http://localhost:5173
npm run build               # → dashboard/dist/
```

## Stack

Node + Express + `better-sqlite3` (read-only) · React 19 + Vite + Tailwind v4 + Recharts + Lucide

Root package is `"type": "commonjs"`. Dashboard is ESM. Do not mix module systems.

## Code map

| Area | Role |
|------|------|
| `src/parser.js` | `parse()` — reads global `state.vscdb`, workspace DBs, agent `store.db`, JSONL transcripts. One canonical conversation per `composerId`. |
| `src/analyzer.js` | `analyze(parsed, { project, timeRange })` → widget payloads + `meta` (session counts, coverage, `trustNote`) |
| `src/server.js` | Express: `/api/projects`, `/api/insights`, serves `dashboard/dist/` |
| `src/lib/` | Helpers: path resolution, merge logic, transcript signals, timestamps |
| `dashboard/` | Five widgets, filter bar, modals. Copy helpers in `src/lib/formatWhatWorked.js` |

## Rules

- Data never leaves the machine. Open all DBs read-only.
- V1 targets Cursor only — do not add Claude Code or Windsurf support yet.
- No LLM calls, no external APIs, no telemetry.
- Simple, boring, working code over clever solutions.
- Never change copy or labels without explicit instruction.
- Commit before starting any new feature or refactor.

## Key docs

| Doc | Purpose |
|-----|---------|
| `docs/bumps-north-star.md` | Product philosophy — read before any UI or copy change |
| `docs/bumps-v1-spec.md` | What shipped in V1 |
| `docs/bumps-v1.5-implementation-plan.md` | Active — five phases, execute one at a time |
| `docs/bumps-v2-vision.md` | Mirror vs Mentor vision + V2.5 and V3 backlog |
| `docs/bumps-cli-flow.md` | Current V1 CLI UX spec — `npx getbumps` behavior |
| `docs/npm-publish.md` | npm publish steps |
