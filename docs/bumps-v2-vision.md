# Bumps — V2 Vision

## The Core Shift

V1 is a **Mirror**. It reflects your behavior back at you through keyword-driven pattern matching — where you spent time, what topics came up most, what your prompt habits look like. Useful. Passive.

V2 introduces a **Mentor** layer. It reads your actual conversations, identifies real behavioral patterns using your own Cursor Agent running on your machine, diagnoses what's slowing you down, and suggests the mindset shifts that would help. Not code review. Not generic advice. Specific guidance rooted in your own sessions.

**The data promise never changes between Mirror and Mentor: your data stays on your machine. Always. No exceptions. Bumps has no sight of it, no storage of it, no access beyond the local files that already exist on your system.**

The north star question V2 answers for every user:

> "Here's exactly why your projects stall, with real evidence from your own sessions, and here's what to change."

---

## Two Modes

### Mirror (existing, improved)
Fast, fully local, no dependencies beyond what V1 already has. Keyword-driven analysis, deterministic, instant. The dashboard you know — improved with better category detection and richer signals from V1.5.

Your data never leaves your machine. Analysis runs entirely locally with no external calls.

Best for: quick check-ins, tracking patterns over time, users who want zero friction.

### Mentor (new in V2)
Uses your own Cursor Agent CLI, running on your own machine, to analyze your conversation data. No external API calls beyond what your existing Cursor subscription already makes. Bumps passes your parsed data as context to your local Cursor Agent, which identifies real behavioral patterns and generates diagnosis and guidance. Results are structured and displayed in a richer dashboard.

Your data never leaves your machine. Bumps has no sight of it, no storage of it. You bring your own AI — Bumps just orchestrates it locally.

Best for: deeper self-reflection, users who feel stuck, builders who want to understand the *why* behind their patterns.

---

## CLI Mode Selection

First thing after `npx getbumps`, before any analysis runs:

```
Welcome to Bumps.

How would you like to analyze your building patterns?

  ◉ Mirror    Fast, local, no setup needed.
              Keyword-driven insights about where you spend time.
              Runs entirely on your machine. Your data never leaves.

  ○ Mentor    Deeper analysis using your own Cursor Agent.
              Real pattern diagnosis + guidance on what to change.
              Runs entirely on your machine. Your data never leaves.
              Requires Cursor Agent CLI (free one-time setup).

Use ↑↓ to select, Enter to confirm.
```

---

## Mentor Setup Flow

Bumps checks state before each step and skips silently if already completed. On subsequent runs, setup is fully skipped — Bumps goes straight to analysis.

### Step 1 — Check for Cursor Agent CLI

```
Mentor selected.

  Mentor requires Cursor Agent CLI to analyze your sessions on your device.
  Your data never leaves your machine — analysis runs using your own Cursor account.

  Step 1: Install Cursor Agent CLI
  Would you like to install it now? [Y/n]
```

If Y:
```
  Installing...
  ✓ Cursor Agent CLI installed.
```

If N:
```
  Switching to Mirror mode instead.
  Run getbumps anytime — select Mentor again once you're ready.
```

### Step 2 — Check authentication

```
  Step 2: Log in with your Cursor account.
  This opens your browser — same account you already use in Cursor.
  Would you like to continue? [Y/n]
```

If Y:
```
  [browser opens, user authenticates]

  ✓ Logged in as user@example.com
```

If N:
```
  Switching to Mirror mode instead.
  Run getbumps anytime — select Mentor again once you're ready.
```

### Step 3 — Analysis runs

```
  Analyzing your sessions...
  ✓ Done. Opening Mentor dashboard.
```

### Subsequent runs (setup already complete)

```
Mentor selected.

  ✓ Cursor Agent CLI found.
  ✓ Logged in as user@example.com

  Analyzing your sessions...
  ✓ Done. Opening Mentor dashboard.
```

---

## Technical Implementation

### How Bumps calls Cursor Agent

```bash
agent --print --output-format json --mode ask --trust --model auto "prompt"
```

Flag breakdown:
- `--print` — non-interactive, captures output programmatically
- `--output-format json` — structured output Bumps can parse reliably
- `--mode ask` — read-only analysis mode, no file edits, no shell commands. Bumps never modifies anything.
- `--trust` — skips workspace trust prompt in headless mode
- `--model auto` — Cursor picks the most cost-efficient model automatically. No extra cost beyond existing subscription.

### What gets passed to Cursor Agent

The parsed conversation data — message text, timestamps, tool usage, file references, follow-up counts. Not raw file contents. Not code. Just the conversation history that already exists on the user's machine in Cursor's local database.

The prompt will be carefully structured to request:
- Identified behavioral patterns across projects
- Specific diagnosis per pattern with session evidence
- Mindset-level guidance for each pattern (not code suggestions)
- Structured JSON output Bumps can render into the Mentor dashboard

### State checks before each step

```javascript
// Check if agent CLI is installed
const agentInstalled = which('agent') !== null

// Check if authenticated
const { stdout } = await exec('agent whoami')
const isLoggedIn = !stdout.includes('Not logged in')
```

Both checks happen silently on every Mentor run. Only prompt the user for steps not yet completed.

### Fallback behavior
If Cursor Agent isn't available, auth fails, or analysis errors — Bumps falls back to Mirror mode automatically with a clear message. Mirror always works. Mentor is additive.

---

## Mentor Dashboard — What Changes

The Mentor dashboard is a different experience from Mirror. Not the same widgets with more data — a different structure and visual language entirely.

### Overall diagnosis
A narrative at the top grounded in real evidence from the user's own sessions, identified by their own Cursor Agent.

> *"Across your last 6 projects, you consistently hit a wall around day 2-3 where a small UI fix expands into a full design pass. This happened in noisebrief, stealth-log, and dont-fall-behind. The pattern suggests you're resolving design uncertainty reactively rather than upfront."*

### Per-project view
Each project gets its own diagnosis card — what happened, when it happened, which sessions are the evidence.

### Theme analysis
Instead of keyword-matched bar charts, proper theme clustering based on what Cursor Agent actually identified in the conversations. Pie or treemap showing how time distributed across real themes, with drill-down into specific sessions.

### Guidance layer
Below every diagnosis, a "what to try instead" section. Mindset shifts, not code suggestions. Grounded in real approaches that address the identified pattern.

Examples of the right tone:
- *"You rewrote auth from scratch 3 times across 2 projects. Builders who hit this pattern often find it helps to timebox the auth decision to one session before writing any code — pick a library, commit to it, move on."*
- *"Your longest sessions consistently start with a small visual fix. Try keeping a 'design debt' list and batching those fixes into dedicated sessions rather than context-switching mid-feature."*
- *"You hit terminal errors most in deployment sessions. Builders who struggle here often find that red/green TDD reduces the surprise rate significantly — catching issues locally before they hit deploy."*

The guidance never says "your code is wrong." It says "here's a mindset or process shift that tends to help builders with this pattern."

### "How does this work?" modal
Every section has a `?` button that opens a plain-language explanation of:
- Which sessions were analyzed
- What signals Cursor Agent looked at
- Why it drew that conclusion
- An explicit statement that all analysis ran locally using the user's own Cursor Agent and that Bumps has no access to or storage of their data

---

## README Updates (required after implementation)

When Mentor ships, the README must be updated with full transparency. This is not optional — trust is the product.

Add a dedicated **"How Mentor Works"** section that covers:

1. **What Mentor does** — uses your own Cursor Agent CLI to analyze your local conversation data and generate behavioral pattern diagnosis and guidance
2. **What gets analyzed** — parsed conversation data: message text, timestamps, tool usage, file references. Not raw code, not file contents.
3. **Where analysis runs** — entirely on your machine, using your own Cursor account and subscription. Bumps calls `agent --print --mode ask` as a local subprocess.
4. **What Bumps sees** — nothing. Bumps reads local files that already exist on your machine and orchestrates the local CLI call. No data is transmitted to Bumps or any third party.
5. **What Cursor Agent sees** — the same data it would see if you asked it a question in your editor. Cursor's own privacy policy applies.
6. **Authentication** — one-time browser login via `agent login`. Credentials stored locally by Cursor Agent, not by Bumps.
7. **Cost** — no additional cost. Analysis uses your existing Cursor subscription with `--model auto` for efficiency.
8. **Opting out** — select Mirror mode at any time. No data is stored between runs.

The README section should be written in plain language, not technical jargon. The target reader is a non-technical solo builder who wants to understand exactly what they're agreeing to before selecting Mentor.

---

## What Stays the Same

- Fully local. Your data, your environment, your AI. Bumps has no sight of it.
- Open source
- One command to run — `npx getbumps`
- No ongoing cost to the Bumps maintainer
- No external APIs called by Bumps, no telemetry, no accounts
- Mirror mode unchanged from V1.5

---

## What's New in V2

- CLI mode selection — Mirror or Mentor, your choice every time
- Guided one-time setup flow for Cursor Agent CLI with Y/N prompts
- Mentor analysis pipeline using `agent --print --mode ask --model auto`
- Narrative diagnosis format grounded in real session evidence
- Per-project diagnosis cards
- AI-identified theme clustering replacing hardcoded category map in Mentor mode
- Guidance layer with mindset suggestions, not code review
- "How does this work?" modal on every insight
- Mentor-specific dashboard layout and visual language
- README "How Mentor Works" section with full transparency

---

## Backlog

### V2.5

Infrastructure expansion after V2 is stable. Two independent tracks that can ship in either order.

**Claude Code Support**
Claude Code stores conversation history as JSONL transcript files in `~/.claude/`. Adding it as a second editor source would expand Bumps' audience significantly — Claude Code users are exactly the vibe coder audience Bumps targets.

What needs to happen:
- Map Claude Code's local storage format
- Build `src/lib/claudeCodeParser.js` following the same interface as the Cursor parser
- Merge results with Cursor data in the main parser — unified view across both tools
- Add Claude Code detection to the CLI startup log
- Tests: `test/claudeCodeParser.test.js` with fixture data

**Windows Support**
Current parser uses macOS-specific paths. Windows support requires:
- New `src/lib/platformPaths.js` centralizing all OS-specific paths with macOS/Windows branches
- Refactor `src/parser.js` to import from `platformPaths.js` instead of hardcoded paths
- Audit `src/lib/cursorPaths.js` for `\` separator handling
- Tests: `test/platformPaths.test.js`

**Multi-Editor Comparison**
Once multiple editors are supported, surface cross-editor insights: "Your Claude Code sessions resolved 30% faster than your Cursor sessions." Helps builders make informed tool choices.

---

### V3

Power features that compound on everything before them.

**Thinking Time as Difficulty Signal**
Every assistant message has a `thinkingDurationMs` field already parsed — the time the model spent reasoning before responding (up to 41 seconds observed in the data). Adds a difficulty dimension to Your Bumps: not just how often a topic came up, but how hard it was when it did.

**Tool Success & Error Rates**
`toolFormerData.status` on every tool call is either `"completed"` or `"error"` — already parsed, not yet analyzed. Surface a "Chaos Score" per project based on tool error frequency. Cross-reference with topic clusters.

**Terminal Command Patterns**
`run_terminal_command_v2` results are fully logged including terminal output and exit codes. Which commands failed most? Which projects had the most terminal errors? Unique data no other tool surfaces.

**Real Session Duration**
With proper timestamps now in place, calculate actual wall-clock time per session — not just follow-up count. "This session took 47 minutes" is more human than "6.2 follow-ups."

**Project Health Score**
Composite 0-100 rating per project based on effort bumps, scope drift risk, prompt habits, session resolution speed, and tool error rate. Shows at a glance which projects are in good shape vs spiraling.

**Export as Image**
One-click dashboard export as a shareable PNG — for build-in-public posts, accountability threads, or personal records. The screenshot is already the primary marketing asset for Bumps; make it a first-class built-in feature.
