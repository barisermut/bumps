# CLAUDE.md

Guidance for AI assistants (Claude Code, Cursor, etc.) working in this repository.

## What this is

Bumps is a **local-only** dashboard that reads Cursor conversation history and surfaces patterns (stalls vs flow). Product intent and UX live in `docs/bumps-v1-spec.md`.

## Commands

```bash
# Root — parser, analyzer, server (CommonJS)
npm install
node src/parser.js
node src/analyzer.js
node src/analyzer.js --project=foo --timeRange=7d
npx getbumps          # end users: default entry; does not modify cwd project
node bin/getbumps.js  # same CLI from a clone (build dashboard/dist first)
node src/server.js    # dev: minimal logs, same API — http://127.0.0.1:3456
npm test              # Vitest: test/*.test.js (lib, analyzer contract, server)

# Dashboard (ESM) — Vite dev or build for server static
cd dashboard && npm install
npm run dev           # http://localhost:5173
npm run build         # output → dashboard/dist/
```

## Code map

| Area | Role |
|------|------|
| `src/parser.js` | `parse()` — global `state.vscdb`, workspace DBs, agent `store.db`, JSONL transcripts; **one canonical conversation per `composerId`** with merged fields from overlapping sources |
| `src/lib/mergeConversationSources.js` | Normalizes conversations with `sourceCoverage`, `completenessFlags`; merges transcript/store into workspace-backed rows |
| `src/lib/transcriptSignals.js` | Best-effort extraction from agent JSONL (skills, subagent hints, linked transcripts, attachment/image flags) |
| `src/lib/parseStats.js` | Parse counters including overlap merges and skipped header-only rows |
| `src/analyzer.js` | `analyze(parsed, { project, timeRange })` → widget payloads plus top-level **`meta`** (exact session counts, coverage summaries, `trustNote`) |
| `src/server.js` | Express: `/api/projects`, `/api/insights` (JSON includes `meta`), static dashboard |
| `dashboard/` | Filters, five widgets, modals; **What Worked** includes **Helpful Support** (`activeTools`); copy in `src/lib/formatWhatWorked.js`; stat cards use `insights.meta.filteredConversationCount` and optional trust subline |

**Parser output (high level):** `parse()` returns `conversations`, `parseStats`, and **`parserMeta`** (`sourceSummary`, `mergeSummary`). Each conversation may include `sourceCoverage`, `completenessFlags`, `skillsReferenced`, `subagentsReferenced`, `sessionContextSignals`, `linkedTranscriptIds`, `attachmentsSummary`.

**Stack (short):** Node, Express, `better-sqlite3` (read-only), React 19, Vite, Tailwind v4, Recharts, Lucide.

**Session counts vs other tools:** Bumps reports **canonical** conversations (deduped by `composerId`). Tools that sum per-storage “sessions” without collapsing overlaps can show higher totals. See `docs/bumps-post-ship-roadmap.md` → *Session count semantics*.

## Rules

- Data never leaves the machine; open DBs read-only.
- v1 targets **Cursor only** (not Claude Code / Windsurf).
- Root package is `"type": "commonjs"`; dashboard is ESM.

## Where to look next

- **Shipped:** [getbumps on npm](https://www.npmjs.com/package/getbumps) · [GitHub](https://github.com/barisermut/bumps) — future publishes: `docs/npm-publish.md`
- **Release checklist (archive):** `docs/bumps-pre-ship-checklist.md`
- **After v1:** `docs/bumps-post-ship-roadmap.md` (v1.5 + v2 ideas); index `docs/bumps-v1.5-backlog.md`
- **CLI UX:** `docs/bumps-cli-flow.md` (primary command: **`npx getbumps`**)

For response shapes and message fields, read `src/analyzer.js` and `src/parser.js` rather than duplicating them here.

## Tests

`npm test` — Vitest, **10** files / **42** tests (`test/*.test.js`), including merge helpers, transcript signals, analyzer contract (`meta`), server API.
