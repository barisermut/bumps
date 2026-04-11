# CLI flow (target behavior)

**Status:** Implemented in `bin/getbumps.js`; end users run **`npx getbumps`** ([npm package](https://www.npmjs.com/package/getbumps)). Source: [github.com/barisermut/bumps](https://github.com/barisermut/bumps). The transcript below matches the current CLI output order.

## Command (primary)

```
npx getbumps
```

**Recommended for everyone:** `npx` runs the CLI from the cache and does **not** add `getbumps` to your current folder’s `package.json`. No project-local install required.

Optional global install for faster repeat runs (same behavior, run `getbumps` instead of `npx getbumps`):

```
npm install -g getbumps
```

Then run from anywhere with just:

```
getbumps
```

---

## Terminal Output

```
$ npx getbumps

  ██████╗ ██╗   ██╗███╗   ███╗██████╗ ███████╗
  ██╔══██╗██║   ██║████╗ ████║██╔══██╗██╔════╝
  ██████╔╝██║   ██║██╔████╔██║██████╔╝███████╗
  ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║
  ██████╔╝╚██████╔╝██║ ╚═╝ ██║██║     ███████║
  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝

  Your Cursor history. Your patterns. Fully local.

  📚  Reading Cursor history…
  ⚡  Parsed in 1234 ms
  🗂️   Found 8 projects, 175 conversations
  🧠  Analyzing patterns…
  ✨  Insights ready

  🔒  All data stays on your machine. Nothing is sent anywhere.

  🖥️   Dashboard running at http://127.0.0.1:3456

  🚀  Opening your browser…

  Press Ctrl+C to stop.

  Run again anytime with: npx getbumps · global uninstall: npm uninstall -g getbumps
```

---

## Behavior Notes

- The **ASCII banner** (FIGlet “ANSI Shadow”) is always printed **without ANSI color** so it matches the transcript above. When stdout is a TTY and `NO_COLOR` is unset, the rest of the CLI uses a **three-tone** palette: **white** for the main narrative, **bold yellow** only for “Insights ready,” and **dim** for the tagline, “Press Ctrl+C,” and the footer. **Red** is reserved for errors on stderr.
- **Parsed in X ms** reflects real parse time on your machine (rounded to the nearest millisecond).
- Project and conversation counts are dynamic — pulled from the parse result.
- Browser opens automatically if possible, falls back to showing the URL only
- Port defaults to 3456, overridable with `--port` flag (e.g. `--port=3457`)
- If that port is already in use, the CLI exits with an error and suggests trying another `--port` (no automatic port scanning)
- All steps logged sequentially so the user always knows what the tool is doing
- Nothing is sent to any external server at any point

---

**Implementation:** `bin/getbumps.js`; release checklist §4–§5 complete — see `docs/bumps-pre-ship-checklist.md`.
