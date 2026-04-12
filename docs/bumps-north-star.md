---

## title: "Bumps — product north star"
updated: "2026-04-11"
status: "active"
related:
  - "prfaq-bumps.md"
  - "prfaq-bumps-distillate.md"

# North star

**See also:** [v1 product spec](./bumps-v1-spec.md) · [post-ship roadmap](./bumps-post-ship-roadmap.md) · [docs index](./bumps-v1.5-backlog.md).

**Bumps is a humane dashboard:** emotionally approachable copy and layout — not an analytics console, not a wall of text. **Two live panels** foreground *what went well* and *what was rough* when the data supports that story, using existing signals (**What Worked** / **model performance** vs **bumps** / **biggest bump**). **Static or minimal motion** — no Framer-style spectacle.

**The pattern layer stays.** The dashboard **always** exposes **patterns** through the **other widgets** (e.g. scope drift, prompt habits, and any future pattern surfaces). Those are not secondary to a single “right/wrong” narrative; they are **first-class**. We do **not** rely on the well/rough framing alone — it **coexists** with pattern exploration.

## Layers (how to think about the UI)

1. **Human poles (when honest)** — Separate widgets, dashboard density (tiles, structured rows — not merged prose). Headline + short subline + visual structure; cap paragraph-style copy.
2. **Pattern widgets** — Unchanged in role: show *how* work unfolded (drift, habits, etc.). Copy and hierarchy should still feel warm where it touches labels and empty states, but the job here is **pattern visibility**, not emotional recap.

## Anti-patterns

- Replacing pattern widgets with a single recap.
- Treating “humane” as **more text** instead of **clearer framing** and **better hierarchy**.
- Collapsing well + rough into one block; they stay **sibling panels** when both are shown.

## Roadmap lens

Every initiative should answer: **Does this make the humane layer truer, the pattern layer clearer, or trust/local-only expectations clearer?** Features that only add analytics chrome without serving those layers drop in priority.

## Analyzer note (no new ingestion required for the core split)

- **Well / supportive side:** `whatWorked`, `modelPerformance` (as surfaced today).
- **Rough side:** `bumps`, `biggestBump`.
- **Pattern / neutral:** e.g. `scopeDrift`, `promptHabits` — remain distinct widgets; framing may group them visually as “patterns” without implying they are “good” or “bad” by default.