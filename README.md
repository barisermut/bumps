# getbumps

**Your Cursor history. Your patterns. Fully local.**

Bumps is a small dashboard that reads **Cursor** conversation data from your machine and turns it into **plain, deterministic insights** — where you stall, how you prompt, what seemed to work. **No cloud, no API keys, no LLM in the loop:** the same history always produces the same numbers and labels.

---

## The problem

Cursor chats pile up across projects. It’s hard to see **patterns** — what keeps pulling you back, whether short or long prompts correlate with fewer follow-ups, which areas you move through cleanly. Nothing in the editor gives you that bird’s-eye view, and you shouldn’t have to ship your chat history to someone else’s server to get it.

## The solution

**One command. One page. All on your computer.**

```bash
npx getbumps
```

Your browser opens to **[http://127.0.0.1:3456](http://127.0.0.1:3456)** (default port **3456**). The CLI prints what it’s doing—including **Parsed in X ms** after reading your local Cursor history (no PII)—reminds you that **nothing is sent anywhere**, and you stop the server with **Ctrl+C** when you’re done. The dashboard keeps the first paint light by loading the **Your bumps** Recharts widget in a separate JavaScript chunk after the shell.

**URL tip:** the server listens on **IPv4 loopback (`127.0.0.1`)** only, not `::1`. On some systems, `http://localhost:…` resolves to IPv6 first and may not reach the app — if that happens, use **`http://127.0.0.1:<port>`** explicitly (or map `localhost` to `127.0.0.1` in your hosts file).

**Why `npx`?** It runs the published CLI from npm’s cache and **does not** add `getbumps` to your current project’s `package.json` — you can run it from any directory.

**Optional — global install** (same flags, shorter command):

```bash
npm install -g getbumps
getbumps
getbumps --port=3457
```

---

## Privacy & trust


|                         |                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Local only**          | Data is read from Cursor’s on-disk storage on your machine. Nothing is uploaded or sent to a third party.                              |
| **No LLM “insights”**   | There is no model call to “interpret” your chats. The app **parses** history and runs **fixed rules** (counts, buckets, simple stats). |
| **Read-only**           | SQLite databases are opened read-only.                                                                                                 |
| **You control the run** | The server binds to **127.0.0.1** (loopback only, not all interfaces); you choose when to start and stop it.                           |


---

## What you get

- **Your Biggest Bump** — the dominant stuck pattern in the selected scope  
- **Your Bumps** — recurring topics where sessions clustered  
- **Scope Drift** — when new concepts show up over time (per project)  
- **Prompt Habits** — short vs long prompts vs rough “resolution” signals  
- **What Worked** — fast prompt shapes, cleaner file-type areas, **Helpful Support** (rules, tools, skills, transcript context), MCP usage, model follow-up stats (where the data exists); stat cards use exact session counts for the current filters and may show a short trust line about merged sources

Filters: **project** and **time range** (e.g. today, last 7 days, all time).

---

## Dependencies & `npx`

The **published npm tarball** does not ship a root lockfile (`package-lock.json` or `npm-shrinkwrap.json`). Install resolution uses the **semver ranges** in `package.json`, so transitive versions can shift between publishes or over time.

- **`npx getbumps`** — npm installs (or reuses) the package in its cache; dependency versions follow those ranges at install time.
- **Contributors** — clone the repo and run **`npm install`** at the root: development uses **`package-lock.json`** (committed) for reproducible local installs and CI.

If you need fully pinned installs for the published package, track or request **`npm-shrinkwrap.json`** as a maintainer decision; v1 ships without it for simplicity.

**Links:** [github.com/barisermut/bumps](https://github.com/barisermut/bumps) · [npmjs.com/package/getbumps](https://www.npmjs.com/package/getbumps)

---

## Requirements

- **Node.js** (LTS recommended — e.g. 20.x or 22.x)  
- **macOS** for v1 — paths follow Cursor’s default layout under your user Library (and related Cursor paths). Other OS support is not the focus yet.  
- **Cursor** — this release targets Cursor only (not Claude Code, Windsurf, etc.).

---

## Usage


|             |                                                                 |
| ----------- | --------------------------------------------------------------- |
| Default     | `npx getbumps` → [http://127.0.0.1:3456](http://127.0.0.1:3456) |
| Custom port | `npx getbumps --port=3457`                                      |
| Port in use | The CLI exits with a short message; pick another `--port`.      |


---

## How it works (high level)

```
Cursor local files (global DB, workspace DBs, agent store, JSONL transcripts)
        → parser (read-only) — one canonical session per composerId, merged sources
        → in-memory structured sessions
        → analyzer (deterministic rules) — insights include a small meta block (counts, trust copy)
        → Express API + static React dashboard
```

There is **no** separate “AI insight” service — only parsing and rule-based analysis.

---

## Development (from this repository)

```bash
git clone https://github.com/barisermut/bumps.git
cd bumps
npm install
cd dashboard && npm install && npm run build && cd ..
node bin/getbumps.js
```

- **Dashboard dev server** (hot reload): `cd dashboard && npm run dev`  
- **Parser / analyzer only:** `node src/parser.js` · `node src/analyzer.js`  
- **Tests:** `npm test`  
- **Product direction:** [docs/bumps-north-star.md](docs/bumps-north-star.md) · **Architecture & conventions:** [CLAUDE.md](CLAUDE.md) and [docs/bumps-v1-spec.md](docs/bumps-v1-spec.md).

If `dashboard/dist` is missing, the CLI tells you to build the dashboard first. **`npm pack`** and **`npm publish`** both run **`prepack`**, which copies `dashboard/dist` into `publish-dist/` for the tarball — the step fails until the dashboard is built. For a dry run without publishing: `npm pack --dry-run`.

---

## Publishing (maintainers)

Full instructions (npm account, login, first publish, 2FA): **[docs/npm-publish.md](docs/npm-publish.md)**.

```bash
cd dashboard && npm install && npm run build && cd ..
npm test
npm pack --dry-run   # optional
npm publish          # after: npm login (use --otp=… if 2FA)
```

`prepack` runs `scripts/check-dashboard-dist.js` then `scripts/prepare-publish-dist.js`; `postpack` removes temporary `publish-dist/` after packing. Locally, `src/paths.js` prefers `dashboard/dist` when present.

---

## License

ISC — see [package.json](package.json).

---

**Bumps** · [GitHub](https://github.com/barisermut/bumps) · [npm](https://www.npmjs.com/package/getbumps) · **`npx getbumps`**