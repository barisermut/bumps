# Bumps — pre-ship checklist

**Status:** v1.0.0 shipped — npm **[getbumps](https://www.npmjs.com/package/getbumps)**, repo public. This list is the historical release gate; use it for future major releases.

| § | Item | Status |
|---|------|--------|
| 1 | Time-range filters — verify in the UI | **Done** |
| 2 | Empty states (dashboard) | **Done** |
| 3 | What Worked — human copy | **Done** |
| 4 | CLI entry point | **Done** |
| 5 | npm publish | **Done** — [getbumps on npm](https://www.npmjs.com/package/getbumps); how-to for later publishes: [npm-publish.md](./npm-publish.md) |
| 6 | GitHub (public remote) | **Done** — [github.com/barisermut/bumps](https://github.com/barisermut/bumps) |

---

## 1. Time-range filters — verify in the UI

**Status: done.** Synthetic per-message timestamps support **Today** / **Last 7 days** / **30 days** / **All time**. Criteria that were met:

- **Today** and **7 days** (and related ranges) show visibly filtered data, not only “no errors.”
- All widgets respect the same `timeRange` + project selection, consistent with `/api/insights`.

---

## 2. Empty states (dashboard)

**Status: done.** When a filter yields **no conversations**, every widget shows a deliberate empty state (copy + stable layout), not a blank card, broken chart, or runtime error.

---

## 3. What Worked — human copy

**Status: done.** `dashboard/src/lib/formatWhatWorked.js` rewrites API strings for display (row + **See details** modal):

- **Fastest Prompts** (`fastPromptPatterns`) — second-person lead from `classifyPrompt` traits; same avg follow-ups and session counts.
- **Most Used MCP** (`mcpServers`) — coach-style “You used … in N session(s) this range.”

**Cleanest Domain** and **Best Model** pass through unchanged. If `src/analyzer.js` changes the string templates, keep the regexes in `formatWhatWorked.js` in sync.

## 4. CLI entry point

**Status: done.** Package name is `getbumps` with `bin/getbumps.js`; run `node bin/getbumps.js` after building `dashboard/dist`. Flow matches `docs/bumps-cli-flow.md`. End users run **`npx getbumps`**.

## 5. npm publish

**Status: done.** v1.0.0 published; smoke test with **`npx getbumps`** from a clean directory.

- Future publishes: **[docs/npm-publish.md](./npm-publish.md)** (build, test, `npm pack --dry-run`, publish, post-publish checks).

## 6. GitHub (public remote)

**Status: done.** Repository: **https://github.com/barisermut/bumps** (`package.json` `repository`, `homepage`, `bugs` point here).

---

**Related:** CLI UX — `docs/bumps-cli-flow.md`. Post-ship ideas — `docs/bumps-post-ship-roadmap.md`.
