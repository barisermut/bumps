# Bumps — post-ship roadmap (v1.5 and v2)

Planned improvements now that v1 is shipped (**[getbumps](https://www.npmjs.com/package/getbumps)**). The v1 release checklist is complete — see `bumps-pre-ship-checklist.md` (archive). **Later npm releases:** `docs/npm-publish.md`.

**Product direction:** use [bumps-north-star.md](./bumps-north-star.md) as the standing lens for humane vs pattern layers, trust, and what to prioritize.

---

## v1.5

### Category label tone and warmth

Category labels should feel like a coach talking *to* the builder, not system output *at* them.

- Audit hardcoded analyzer categories (~20): capitalization, warmth, less jargon.
- Describe the *experience* of being stuck, not only the technical bucket.
- Examples of direction (not a fixed list): routing tangles → “getting lost in routing”; design churn → “down the design rabbit hole”; auth friction → “stuck on auth again.”
- Revisit the hero sentence so it matches that tone.

### Scope Drift — richer signal

Scope Drift is limited when projects have few date clusters in the source data.

- Parser **canonicalizes** by `composerId` and **merges** overlapping workspace, agent-store, and JSONL transcript data into one conversation per thread; when `~/.cursor/chats/` is populated on more installs, re-check timeline density.
- Consider “sessions per day” alongside “new topics per day” so busy days weigh more than sparse days.
- Refine Early burst / Moderate / Gradual logic using burst timing vs project age, not only peak-day topic count.

### Responsiveness

Dashboard is desktop-first today.

- Breakpoints: e.g. desktop 1280+, laptop 1024, tablet 768.
- Collapse stat cards (4 → 2×2), widget grid (2×2 → single column), Prompt Habits columns → stack; truncate or wrap long bar labels; filter bar stacks on small widths.
- Priority: laptop, then tablet.

---

## v2

### Windows support (Cursor)

v1 assumes **macOS** paths (`~/Library/Application Support/Cursor/...`, workspace storage under Library, `~/.cursor/...`). v2 should add **first-class Windows** support:

- Map Cursor’s **Windows** locations: global DB, per-workspace DBs, agent chats / project transcripts (typically under `%APPDATA%` / user profile; exact layout must be verified against current Cursor installs).
- Centralize **OS-specific roots** in `src/lib/` (extend existing path helpers); keep SQLite **read-only** and preserve the same merge/dedupe behavior as macOS.
- Exercise the full flow on a real Windows machine: `npx getbumps`, parser counts, dashboard load. Document Node.js expectations in the README.

### Thinking time as difficulty signal

`thinkingDurationMs` on assistant messages is already parsed. Use it in the analyzer to rank topic difficulty, surface “hardest sessions,” or trends per project.

### Tool success and error rates

`toolFormerData.status` (`completed` / `error`) is available in parsed bubbles but not analyzed. Could drive per-session chaos, per-tool failure rates, and correlation with bump categories.

### Terminal command patterns

`run_terminal_command_v2` payloads include output and exit behavior. Could surface failing commands, terminal-health per project, and links to bump topics.

### Real session duration

With reliable timestamps, add wall-clock session length (and optional time-of-day patterns). May complement or replace message-count-based “resolution” in Prompt Habits.

### Claude Code support

Map `~/.claude/` JSONL (or current storage), add a second parser module behind the same merge interface, optional CLI log line when detected.

### Multi-editor comparison

After multiple sources exist, cross-editor insights (e.g. relative resolution speed) become possible.

### Project health score

Single 0–100-style score per project from combined signals (scope drift, bumps, prompts, duration, tool errors, etc.).

### Export as image

Built-in PNG (or similar) export for sharing; aligns with “screenshot as marketing” in the v1 spec.

---

## Future widgets & UI surfaces (from ingestion / trust work)

Ideas that fit Bumps’ pattern-first positioning — **not** a second analytics product:

| Direction | Notes |
|-----------|--------|
| **“Why this number?” sheet** | One-off modal or footnote linking **canonical session count** vs raw storage rows, in plain language (helps when users compare Bumps to other local tools). |
| **Source coverage chip** | Optional filter or badge: e.g. “includes merged transcript context” — uses `sourceCoverage` / `completenessFlags` already on conversations. |
| **Session detail slide-over** | Per-session provenance (which sources contributed, not a full debugger). Reuses merged metadata without a new top-level widget. |
| **CLI parse summary** | `getbumps --stats` or similar: print `parserMeta` / `parseStats` for support and power users; no new dashboard widget. |
| **“How you work” narrative** | v2-style widget: aggregate `sessionContextSignals` (skills, delegation, file/image context) into a short coach paragraph — only if copy stays warm and non-jargony. |
| **Completeness gentle prompt** | If many sessions lack models or tools, one empathetic line in empty or sparse states (not a KPI dashboard). |

---

## Session count semantics (other local tools)

Bumps intentionally reports **one conversation per `composerId`**, merging bubbles, agent store, and JSONL transcripts when they refer to the same thread.

Some other tools **sum sessions per storage source** (e.g. workspace index plus agent transcripts) without collapsing IDs that point at the same conversation. That often yields a **higher headline number** than Bumps — not necessarily “more history,” often **double-counting** the same thread across buckets.

Bumps also **skips workspace headers with zero messages** (no bubble payload yet); other products may still list those as sessions.

**Product stance:** stay pattern-quality and trust-oriented; use `parserMeta` / UI trust copy to reduce confusion without becoming a metrics competitor.

---

## Already in the codebase (reference)

These are implemented today; they are **not** open v1.5 backlog unless we expand them further.

- **Canonical merge:** `src/lib/mergeConversationSources.js` — overlapping Cursor sources union into one conversation; `sourceCoverage`, `completenessFlags` on each row.
- **Transcript signals:** `src/lib/transcriptSignals.js` — skills, subagent hints, linked transcript refs, attachment/image flags from agent JSONL.
- **Parser diagnostics:** `parse()` returns **`parserMeta`** (`sourceSummary`, `mergeSummary`) alongside **`parseStats`** (includes overlap merge counts, skipped header-only rows).
- **Insights `meta`:** `analyze()` returns **`meta`** — `filteredConversationCount`, `totalConversationCount`, coverage/completeness aggregates, **`trustNote`** for subtle dashboard copy.
- **Dashboard:** Stat cards use exact filtered session counts; trust subline under cards; What Worked **Helpful Support** row for enriched `activeTools`; hero subline uses `meta` when present.
- Parser still ingests **agent store** (`~/.cursor/chats/.../store.db`) and **agent JSONL** with global `state.vscdb`.
- **Model performance** (`modelPerformance`) in What Worked area.
- **Synthetic message timestamps** where Cursor omits them — time-range filtering (pre-ship checklist §1).
