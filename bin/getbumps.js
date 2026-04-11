#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { performance } = require("node:perf_hooks");
const { spawn } = require("child_process");
const { defaultDashboardPath } = require("../src/paths");
const { parse } = require("../src/parser");
const { startServer } = require("../src/server");

/** https://no-color.org/ — NO_COLOR disables; FORCE_COLOR=0 disables; FORCE_COLOR=1 forces when not a TTY */
const noColor = process.env.NO_COLOR != null && process.env.NO_COLOR !== "";
const forceColor =
  process.env.FORCE_COLOR &&
  process.env.FORCE_COLOR !== "0";
const useColor =
  !noColor &&
  process.env.FORCE_COLOR !== "0" &&
  (forceColor || process.stdout.isTTY);

const R = "\x1b[0m";

function paint(open, s) {
  return useColor ? `${open}${s}${R}` : s;
}

/** Stdout palette: white (body), bold yellow (one accent), dim (muted). Red kept for stderr only. */
const style = {
  out: (s) => paint("\x1b[37m", s),
  accent: (s) => paint("\x1b[1;33m", s),
  muted: (s) => paint("\x1b[2m", s),
  url: (s) => paint("\x1b[4;37m", s),
  err: (s) => paint("\x1b[1;31m", s),
};

/* FIGlet "ANSI Shadow" — same as docs/bumps-cli-flow.md; printed without color */
const BANNER = `
  ██████╗ ██╗   ██╗███╗   ███╗██████╗ ███████╗
  ██╔══██╗██║   ██║████╗ ████║██╔══██╗██╔════╝
  ██████╔╝██║   ██║██╔████╔██║██████╔╝███████╗
  ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║
  ██████╔╝╚██████╔╝██║ ╚═╝ ██║██║     ███████║
  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝`;

const TAGLINE = "  Your Cursor history. Your patterns. Fully local.";

function printBanner() {
  const lines = BANNER.split(/\r?\n/).filter((line) => line.trim() !== "");
  for (const line of lines) {
    console.log(line);
  }
}

function parsePort(argv) {
  const flag = argv.find((a) => a.startsWith("--port="));
  if (!flag) return 3456;
  const raw = flag.split("=")[1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(
      style.err(
        "getbumps: invalid --port (use an integer 1–65535, e.g. --port=3457)"
      )
    );
    process.exit(1);
  }
  return n;
}

function dashboardDistReady() {
  const indexHtml = path.join(defaultDashboardPath(), "index.html");
  return fs.existsSync(indexHtml);
}

function openBrowser(url) {
  try {
    const plat = process.platform;
    if (plat === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else if (plat === "win32") {
      spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    /* URL is still printed */
  }
}

function main() {
  const argv = process.argv.slice(2);
  const port = parsePort(argv);

  console.log("");
  printBanner();
  console.log("");
  console.log(style.muted(TAGLINE));
  console.log("");

  if (!dashboardDistReady()) {
    console.error(
      style.err("getbumps: dashboard UI is missing.") +
        "\n" +
        style.muted(
          "  cd dashboard && npm install && npm run build\n" +
            "Then run again: npx getbumps (from npm), or node bin/getbumps.js (from this repo)."
        )
    );
    process.exit(1);
  }

  console.log(style.out("  📚  Reading Cursor history…"));
  const parseStarted = performance.now();
  const parsedData = parse();
  const parseMs = Math.round(performance.now() - parseStarted);
  console.log(style.out(`  ⚡  Parsed in ${parseMs} ms`));
  const nProjects = parsedData.projects.length;
  const nConversations = parsedData.totalConversations;
  console.log(
    style.out(
      `  🗂️   Found ${nProjects} project${nProjects === 1 ? "" : "s"}, ${nConversations} conversation${nConversations === 1 ? "" : "s"}`
    )
  );
  console.log(style.out("  🧠  Analyzing patterns…"));

  const dashboardPath = defaultDashboardPath();

  const server = startServer({
    parsedData,
    port,
    dashboardPath,
    logListenMessage: false,
    onListenError(err) {
      if (err.code === "EADDRINUSE") {
        console.error(
          style.err(
            `getbumps: port ${port} is already in use. Try: npx getbumps --port=${port + 1}`
          )
        );
        process.exit(1);
      }
      console.error(err);
      process.exit(1);
    },
    onListening() {
      console.log(style.accent("  ✨  Insights ready"));
      console.log("");
      console.log(
        style.out(
          "  🔒  All data stays on your machine. Nothing is sent anywhere."
        )
      );
      console.log("");
      const url = `http://127.0.0.1:${port}`;
      console.log(style.out("  🖥️   Dashboard running at ") + style.url(url));
      console.log("");
      console.log(style.out("  🚀  Opening your browser…"));
      console.log("");
      console.log(style.muted("  Press Ctrl+C to stop."));
      console.log("");
      console.log(
        style.muted(
          "  Run again anytime with: npx getbumps · global uninstall: npm uninstall -g getbumps"
        )
      );
      console.log("");
      openBrowser(url);
    },
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
