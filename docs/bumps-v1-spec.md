# Bumps — v1 Product Spec

Standing direction for humane vs pattern layers and what to prioritize: [bumps-north-star.md](./bumps-north-star.md).

## What It Is

A local dashboard that analyzes your Cursor conversation history and surfaces the patterns behind why your projects stall — and what's actually working when you're in flow.

## Who It's For

A solo builder who uses Cursor and keeps starting projects they don't finish.

## The Single Promise

One command — **`npx getbumps`**. One page. See yourself clearly.

---

## How It Runs

- User runs **`npx getbumps`** in the terminal (see `docs/bumps-cli-flow.md`). That flow does **not** install the package into the user’s current project directory; `npx` runs the published CLI from the npm cache.
- The CLI opens the dashboard at **`http://127.0.0.1:3456`** by default (configurable with `--port=`). Prefer that URL over `localhost` if your OS resolves `localhost` to IPv6 first.
- All data stays on the user's machine.
- Nothing is sent anywhere, ever.

---

## Navigation Controls

Two persistent controls at the top of the dashboard. No other navigation exists.

- **Project selector** — Global view by default. Dropdown to filter by a specific detected project.
- **Time range** — Today / Last 7 days / Last 30 days / All time. All time is the default.

All five widgets respond to both filters simultaneously.

When the current filter combination matches **no** sessions, each widget must show a deliberate **empty state** (message + stable layout), not a blank or broken chart.

**Stat cards** show the exact number of sessions in the current filter scope (not inferred from chart percentages). A **short trust line** below the cards may summarize how merged Cursor sources contributed to that view (e.g. transcript context merged into existing sessions), when the API provides it — warm copy, not a technical log.

---

## The Five Widgets

### 1. Your Biggest Bump *(hero callout)*
One bold, single-sentence callout at the very top of the dashboard. The most dominant pattern in the selected time range and project scope, surfaced immediately.

> *Example: "You spent 38% of your sessions on design fixes."*

---

### 2. Your Bumps
Top recurring topics where the user got stuck, ranked by frequency. Topics are extracted from conversation content — design, auth, database schema, deployment, etc.

- Displayed as a ranked list or bar visualization
- Labels should be human-readable, not technical jargon
- Scoped to selected project and time range

---

### 3. Scope Drift
A simple timeline showing when new concepts, entities, or pages entered the conversation mid-project. Visualizes the moment a project started over-building.

- Chronological view across the project lifetime
- Highlights inflection points where scope expanded
- Helps the user see the exact moment things got complicated

---

### 4. Prompt Habits
A comparison of short/direct prompts vs long/detailed ones, correlated with how quickly they reached resolution.

- Not a judgment — purely a pattern
- Shows which prompt style moved faster for this specific user
- Resolution speed measured by follow-up count or session length

---

### 5. What Worked
The conditions when the user was in flow. The widget is **one surface** with **four labeled rows** (each may empty gracefully):

| Row | Intent |
|-----|--------|
| **Fastest Prompts** | Prompt shapes that correlated with fewer follow-ups |
| **Cleanest Domain** | File/type areas moved through with less churn |
| **Helpful Support** | Rules, tools, **skills**, **subagent-style context**, and transcript-derived signals that showed up in smoother threads (`whatWorked.activeTools` in the API) |
| **Most Used MCP** | MCP usage where logged |

Conceptually this is still three *dimensions* (prompts, domains, support/MCP), with **Helpful Support** making the “support” lane visible on its own row.

> *Examples (target copy):*
> *"Your shortest prompts closed fastest — avg 2 messages to resolution"*
> *"Sessions referencing your CLAUDE.md had 40% fewer follow-up prompts"*
> *"Your TypeScript sessions had fewer fix cycles than your CSS sessions"*

**Note:** Tool, rules, skills, and transcript signals are **best effort** from what Cursor and agent JSONL expose. **Fastest Prompts**, **Helpful Support**, and **Most Used MCP** use `dashboard/src/lib/formatWhatWorked.js` for human-facing row and modal copy; the API may still emit template-style strings for some fields.

---

## Public release (v1)

**Shipped:** v1.0.0 is on npm as **[getbumps](https://www.npmjs.com/package/getbumps)**; source at **[github.com/barisermut/bumps](https://github.com/barisermut/bumps)**. `docs/bumps-pre-ship-checklist.md` §1–§6 are satisfied (§5 publish complete). Future version bumps: [docs/npm-publish.md](npm-publish.md).

---

## Visual Direction

- **Aesthetic:** Notion dark — warm, not clinical. Not an analytics tool, not a cold dev dashboard.
- **Layout:** Single page, no navigation, no scrolling required on a standard laptop screen.
- **Hierarchy:** All five widgets visible in one frame. The hero callout dominates. Widgets below are equal weight.
- **Screenshot test:** The dashboard must communicate its full value in a single screenshot. This is the primary marketing asset.
- **Theme:** Dark background, warm neutral tones, subtle typography hierarchy. No neon. No gradients for the sake of gradients.

---

## What v1 Is Not

The following are explicitly out of scope for v1. No exceptions.

- Claude Code or Windsurf support
- Git commit analysis
- Settings or configuration UI
- User accounts or authentication
- Natural language queries
- Cross-project comparisons
- Time-based trend charts
- Export or sharing features
- Notifications or alerts

All of the above are v2.

---

## Data Source

- **Input:** Cursor conversation history (stored locally on the user's machine)
- **Processing:** All analysis runs locally
- **Storage:** Local only, never transmitted
- **Parsing:** Best effort on Cursor's conversation format — v1 targets Cursor only

---

## Success Criteria for v1

1. A user runs **`npx getbumps`** and sees their dashboard in under 30 seconds (typical machine, non-huge history).
2. At least one insight makes them say "yeah, that's exactly my problem."
3. The dashboard is worth screenshotting and posting.
4. Time filters (e.g. Today, Last 7 days) behave correctly in the running app: widgets reflect the selected range and stay consistent with the API, not only “no crash.” (Pre-ship §1 — **complete**.)
5. What Worked prompt and MCP lines read as human sentences in the UI and detail modal, not raw analyzer templates. (Pre-ship §3 — **complete**.)
