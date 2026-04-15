# Bumps — V1.5 Implementation Plan

## Rules of Engagement

- One phase per session. Never combine phases.
- One prompt per step within each phase.
- Run verification after every phase before moving on.
- If tests fail or visual check looks wrong — stop, fix, don't proceed.

---

## Phase 1: Category Warmth + Effort Scoring

**Why first:** The biggest product problem. Everything else compounds on honest, human framing of the data.

### 1A — Rewrite CATEGORY_MAP labels

**File:** `src/analyzer.js`

Rewrite all 20 labels. Keyword arrays stay identical — only the human-readable label strings change.

| Current | New |
|---|---|
| Auth Struggles | Stuck on auth again |
| Database Headaches | Down the database rabbit hole |
| Chasing Design Issues | Chasing design details |
| Building APIs | Wiring up APIs |
| Deployment Pain | Wrestling with deploys |
| Testing Gaps | Filling in tests |
| State Management Chaos | Tangled in state management |
| Fighting Errors | Chasing down errors |
| Performance Tuning | Tuning for performance |
| Refactoring Loops | Caught in a refactor loop |
| Wrestling with Config | Tangled in config |
| Routing Tangles | Getting lost in routing |
| Form and Validation Fixes | Fixing forms and validation |
| File Wrangling | Wrangling files |
| TypeScript Type Battles | Battling TypeScript types |
| Animation Tinkering | Tinkering with animations |
| Search and Filter Work | Building search and filters |
| Notification Plumbing | Plumbing notifications |
| Data Viz Work | Building data visualizations |
| Writing Docs | Writing documentation |

### 1B — Add effort scoring to `computeBumps`

**File:** `src/analyzer.js`

Currently sorts by session count. Change to effort-weighted scoring:

1. For each matching conversation, accumulate `userMessageCount`, `messageCount`, session span (`lastUpdatedAt - createdAt`, capped at 480 min), and `linesAdded + linesRemoved`
2. Compute per-bump averages: `avgUserMessages`, `avgMessages`, `avgSessionSpanMinutes`, `avgLinesChanged`
3. Compute `effortScore` = weighted blend: `0.4 * normPrevalence + 0.3 * normAvgUserMessages + 0.2 * normAvgSessionSpan + 0.1 * normAvgLinesChanged` (min-max normalized; fallback to prevalence-only when variance is zero)
4. Sort by `effortScore` desc
5. Return enriched shape: `{ topic, count, percentage, avgUserMessages, avgMessages, avgSessionSpanMinutes, avgLinesChanged, effortScore }`

New helper to add:
```javascript
function computeSessionSpanMinutes(c) {
  if (!c.createdAt || !c.lastUpdatedAt) return null;
  const ms = new Date(c.lastUpdatedAt) - new Date(c.createdAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms / 60000, 480);
}
```

### 1C — Update `computeBiggestBump`

**File:** `src/analyzer.js`

Current: `"You spent ${top.percentage}% of your sessions on ${top.topic}."`
New: `"${top.topic} — came up in ${top.count} sessions, averaging ${top.avgUserMessages} messages each."`

### 1D — Update `emptyInsights` bump shape

**File:** `src/analyzer.js`

Add zero defaults for all new fields so empty states don't break.

### 1E — Dashboard copy updates

| File | Change |
|---|---|
| `StatCards.jsx` | "Biggest time sink" → "Where effort piled up"; sublabel → "avg X messages across Y sessions" |
| `App.jsx` hero subline | Include avg messages: "Found in X sessions — avg Y messages each" |
| `App.jsx` YourBumps subtitle | "Topics ranked by effort — frequency, messages, and session length" |
| `App.jsx` YourBumps verdict | "Red topics took the most back-and-forth to get right." |

### 1F — Tests

**File:** `test/analyzer.contract.test.js`

- Assert new fields on `bumps[0]`: `avgUserMessages`, `avgMessages`, `avgSessionSpanMinutes`, `avgLinesChanged`, `effortScore`
- Add test: two conversations with different effort profiles → verify effort reordering
- Update `biggestBump` string assertion

---

## Phase 2: Trust Promotion

**Why:** Trust signals already exist in the data (`meta.sourceCoverage`, `meta.completeness`, `meta.trustNote`) but do no visible UI work. Making them visible makes "local-only, honest" tangible.

### 2A — New `TrustBadge.jsx` component

**New file:** `dashboard/src/components/TrustBadge.jsx`

A compact row of chips between StatCards and the widget grid:
- Coverage chip: "X sessions had multi-source context" (from `meta.sourceCoverage.multiSource`)
- Completeness chip: "X sessions had full model + tool data" (from `meta.completeness`)
- Trust note rendering with appropriate visual weight

### 2B — Integrate in App.jsx

Add `<TrustBadge meta={insights?.meta} />` between StatCards and the first widget grid row.

No analyzer changes needed — all data already flows via `meta`.

---

## Phase 3: Graduate Underused Signals

**Why:** 15+ parsed fields sit unused. These two add meaningful signal without adding complexity.

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

**File:** `src/analyzer.js` — modify `computeScopeDrift`

- Add `sessionsPerDay: { [date]: number }` per project alongside existing timeline
- Enhance `getPatternLabel` in `ScopeDrift.jsx` to use burst timing vs project age + session density, not only peak-day topic count
- Show "X sessions across Y days" in card summary

---

## Phase 5: Responsiveness

**Files:** All dashboard components — CSS/Tailwind changes only, no logic changes.

| Breakpoint | Layout |
|---|---|
| 1280px+ (desktop) | Current — no change |
| 1024-1279px (laptop) | Tighter padding, smaller charts |
| 768-1023px (tablet) | Single column grid, StatCards 2x2, FilterBar stacks, PromptHabits stacks |

Key changes:
- `App.jsx`: `grid-cols-2` → `grid-cols-1 lg:grid-cols-2`
- `StatCards.jsx`: `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`
- `FilterBar.jsx`: `flex-wrap` below 768px
- `ScopeDrift.jsx`: responsive grid template

Priority order: laptop first, tablet second.

---

## Verification Plan

Run after every phase before starting the next:

1. `npm test` — all tests pass
2. `cd dashboard && npm run build` — no build errors
3. `node src/server.js` → open `http://127.0.0.1:3456` — visual check
4. Phase 1 specifically: verify effort-scored bumps reorder differently than prevalence-only with real data

---

## Files Modified Summary

| Phase | Files |
|---|---|
| 1 | `src/analyzer.js`, `dashboard/src/App.jsx`, `dashboard/src/components/StatCards.jsx`, `test/analyzer.contract.test.js` |
| 2 | `dashboard/src/components/TrustBadge.jsx` (new), `dashboard/src/App.jsx` |
| 3 | `src/analyzer.js`, `dashboard/src/components/StatCards.jsx`, `dashboard/src/components/WhatWorked.jsx`, `test/analyzer.contract.test.js` |
| 4 | `src/analyzer.js`, `dashboard/src/components/ScopeDrift.jsx` |
| 5 | All dashboard components (CSS only) |
