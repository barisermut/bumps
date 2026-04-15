# Bumps — Unified Implementation Plan (v1.5 + v2)

## Context

Bumps v1 shipped on npm as `getbumps`. The dashboard works, the parser/analyzer pipeline is solid, but **first-glance value is weaker than intended**. The core issue: the rough-side story uses session prevalence but the copy reads as "time cost." Meanwhile, 15+ parsed signals sit unused, trust infrastructure is buried, and the UI is desktop-only. This plan addresses all of it as one ordered sequence — no re-invention, just graduating what already exists.

Standing direction: `docs/bumps-north-star.md`. Evidence base: `docs/bumps-parser-analyzer-signal-inventory.md`.

---

## Phase 1: Fix the Rough-Side Truth + Category Warmth + Effort Detail

**Why first:** This is the #1 product problem. Every other improvement compounds on honest effort framing.

### 1A — Rewrite CATEGORY_MAP labels (coach tone)

**File:** `src/analyzer.js:1-22`

Rewrite all 20 labels. Keywords arrays stay identical. Direction:


| Current                   | New                           |
| ------------------------- | ----------------------------- |
| Auth Struggles            | Stuck on auth again           |
| Database Headaches        | Down the database rabbit hole |
| Chasing Design Issues     | Chasing design details        |
| Building APIs             | Wiring up APIs                |
| Deployment Pain           | Wrestling with deploys        |
| Testing Gaps              | Filling in tests              |
| State Management Chaos    | Tangled in state management   |
| Fighting Errors           | Chasing down errors           |
| Performance Tuning        | Tuning for performance        |
| Refactoring Loops         | Caught in a refactor loop     |
| Wrestling with Config     | Tangled in config             |
| Routing Tangles           | Getting lost in routing       |
| Form and Validation Fixes | Fixing forms and validation   |
| File Wrangling            | Wrangling files               |
| TypeScript Type Battles   | Battling TypeScript types     |
| Animation Tinkering       | Tinkering with animations     |
| Search and Filter Work    | Building search and filters   |
| Notification Plumbing     | Plumbing notifications        |
| Data Viz Work             | Building data visualizations  |
| Writing Docs              | Writing documentation         |


### 1B — Add effort scoring to `computeBumps`

**File:** `src/analyzer.js:133-153`

Currently counts category matches and sorts by count. Change to:

1. For each matching conversation, accumulate `userMessageCount`, `messageCount`, session span (`lastUpdatedAt - createdAt`, capped at 480 min), and `linesAdded + linesRemoved`.
2. Compute per-bump averages: `avgUserMessages`, `avgMessages`, `avgSessionSpanMinutes`, `avgLinesChanged`.
3. Compute `effortScore` = weighted blend: `0.4 * normPrevalence + 0.3 * normAvgUserMessages + 0.2 * normAvgSessionSpan + 0.1 * normAvgLinesChanged` (min-max normalized across the bump set; fallback to prevalence-only when variance is zero).
4. Sort by `effortScore` desc.
5. Return enriched shape: `{ topic, count, percentage, avgUserMessages, avgMessages, avgSessionSpanMinutes, avgLinesChanged, effortScore }`.

New helper:

```javascript
function computeSessionSpanMinutes(c) {
  if (!c.createdAt || !c.lastUpdatedAt) return null;
  const ms = new Date(c.lastUpdatedAt) - new Date(c.createdAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms / 60000, 480);
}
```

### 1C — Update `computeBiggestBump`

**File:** `src/analyzer.js:155-159`

Current: `"You spent ${top.percentage}% of your sessions on ${top.topic}."`
New: `"${top.topic} — came up in ${top.count} sessions, averaging ${top.avgUserMessages} messages each."`

### 1D — Update `emptyInsights` bump shape

**File:** `src/analyzer.js:574-609` — add zero defaults for new fields.

### 1E — Dashboard copy updates


| File                                               | Change                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dashboard/src/components/StatCards.jsx`           | "Biggest time sink" → "Where effort piled up"; sublabel → `"avg X messages across Y sessions"` |
| `dashboard/src/App.jsx` (hero subline ~L74-76)     | Include avg messages: `"Found in X sessions — avg Y messages each"`                            |
| `dashboard/src/App.jsx` (YourBumps subtitle ~L132) | `"Topics ranked by effort — frequency, messages, and session length"`                          |
| `dashboard/src/App.jsx` (YourBumps verdict ~L133)  | `"Red topics took the most back-and-forth to get right."`                                      |


### 1F — Tests

**File:** `test/analyzer.contract.test.js`

- Assert new fields on `bumps[0]`: `avgUserMessages`, `avgMessages`, `avgSessionSpanMinutes`, `avgLinesChanged`, `effortScore`
- Add test: two conversations with different effort profiles → verify effort reordering
- Update `biggestBump` string assertion

---

## Phase 2: Trust Promotion

**Why:** Trust signals exist (`meta.sourceCoverage`, `meta.completeness`, `meta.trustNote`) but do no visible UI work. Promoting them makes "local-only, honest" tangible.

### 2A — New `TrustBadge.jsx` component

**New file:** `dashboard/src/components/TrustBadge.jsx`

A compact row of chips between StatCards and the widget grid:

- Coverage chip: `"X sessions had multi-source context"` (from `meta.sourceCoverage.multiSource`)
- Completeness chip: `"X sessions had full model + tool data"` (from `meta.completeness`)
- Enhanced `trustNote` rendering (already a string, just needs better visual weight)

### 2B — Integrate in App.jsx

Add `<TrustBadge meta={insights?.meta} />` between StatCards and the first grid row.

### 2C — No analyzer changes needed. All data already flows via `meta`.

---

## Phase 3: Graduate Underused Signals

**Why:** 15+ parsed fields sit unused. The best candidates strengthen the story without adding analytics chrome.

### 3A — Change-volume analysis

**File:** `src/analyzer.js` — new `computeChangeVolume(conversations)`

```javascript
changeVolume: {
  totalLinesChanged: number,
  avgLinesPerSession: number,
  sessionsWithChanges: number,
  heaviestSession: { project, linesChanged } | null
}
```

### 3B — Context richness

**File:** `src/analyzer.js` — new `computeContextRichness(conversations)`

```javascript
contextRichness: {
  sessionsWithSkills: number,
  sessionsWithSubagents: number,
  sessionsWithFileContext: number,
  topSkills: string[],
  topContextSignals: string[]
}
```

### 3C — Surface in dashboard

- Add change-volume to StatCards (new card or augment existing)
- Add "How You Work" row to WhatWorked using contextRichness
- Update `emptyInsights` and contract tests

---

## Phase 4: Scope Drift Enrichment

**File:** `src/analyzer.js:161+` — modify `computeScopeDrift`

- Add `sessionsPerDay: { [date]: number }` per project alongside existing `timeline`
- **File:** `dashboard/src/components/ScopeDrift.jsx:38` — enhance `getPatternLabel` to use burst timing vs project age + session density, not only peak-day topic count
- Show `"X sessions across Y days"` in card summary

---

## Phase 5: Responsiveness

**Files:** All dashboard components (CSS/Tailwind only, no logic changes)


| Breakpoint         | Layout                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| 1280+ (desktop)    | Current — no change                                                           |
| 1024-1279 (laptop) | Tighter padding, smaller charts                                               |
| 768-1023 (tablet)  | `grid-cols-1`, StatCards `grid-cols-2`, FilterBar stacks, PromptHabits stacks |


Key changes:

- `App.jsx`: `grid-cols-2` → `grid-cols-1 lg:grid-cols-2`
- `StatCards.jsx`: `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`
- `FilterBar.jsx`: `flex-wrap` below 768
- `ScopeDrift.jsx`: responsive grid template

---

## Phase 6: Claude Code Support

### 6A — New parser module

**New file:** `src/lib/claudeCodeParser.js`

- Discover `~/.claude/projects/` directories and JSONL session files
- Parse into canonical conversation shape with `_source: "claude-code"`

### 6B — Extend merge layer

**File:** `src/lib/mergeConversationSources.js` — add `claudeCode` to `sourceCoverage`

### 6C — Integrate into `parse()`

**File:** `src/parser.js` — call new parser, ingest via existing pipeline

### 6D — CLI log line when detected

### 6E — Tests: `test/claudeCodeParser.test.js` with fixture data

---

## Phase 7: Windows Support

### 7A — OS-specific path module

**New file:** `src/lib/platformPaths.js` — centralize `GLOBAL_DB_PATH`, `WORKSPACE_STORAGE_PATH`, `AGENT_CHATS_PATH`, `AGENT_PROJECTS_PATH` with macOS/Windows branches.

### 7B — Refactor parser.js

**File:** `src/parser.js:5-15` — import from `platformPaths.js` instead of hardcoded paths.

### 7C — Audit `src/lib/cursorPaths.js` for `\` separator handling.

### 7D — Tests: `test/platformPaths.test.js`

---

## Phase 8: Advanced Signals (future, after 1-7 ship)

- **Project health score** — composite 0-100 from effort bumps + scope drift risk + prompt habits + change volume
- **Export as image** — `html2canvas` or similar, button in FilterBar
- **Multi-editor comparison** — after Claude Code lands, compare patterns across editors
- **Token efficiency** — aggregate `inputTokens`/`outputTokens` per session (sparse, mark low-confidence)

---

## Verification Plan

After each phase:

1. `npm test` — all 42+ tests pass (contract tests updated per phase)
2. `cd dashboard && npm run build` — no build errors
3. `node src/server.js` then open `http://127.0.0.1:3456` — visual check
4. Preview tools: `preview_start` → `preview_snapshot` → `preview_screenshot` for visual verification
5. Phase 1 specifically: verify effort-scored bumps reorder differently than prevalence-only with real data

---

## Files Modified (summary)


| Phase | Files                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `src/analyzer.js`, `dashboard/src/App.jsx`, `dashboard/src/components/StatCards.jsx`, `test/analyzer.contract.test.js`                   |
| 2     | `dashboard/src/components/TrustBadge.jsx` (new), `dashboard/src/App.jsx`                                                                 |
| 3     | `src/analyzer.js`, `dashboard/src/components/StatCards.jsx`, `dashboard/src/components/WhatWorked.jsx`, `test/analyzer.contract.test.js` |
| 4     | `src/analyzer.js`, `dashboard/src/components/ScopeDrift.jsx`                                                                             |
| 5     | All dashboard components (CSS only)                                                                                                      |
| 6     | `src/lib/claudeCodeParser.js` (new), `src/lib/mergeConversationSources.js`, `src/parser.js`, `test/claudeCodeParser.test.js` (new)       |
| 7     | `src/lib/platformPaths.js` (new), `src/parser.js`, `src/lib/cursorPaths.js`, `test/platformPaths.test.js` (new)                          |


