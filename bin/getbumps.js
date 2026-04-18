#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { performance } = require("node:perf_hooks");
const { spawn } = require("child_process");
const { defaultDashboardPath } = require("../src/paths");
const { parse } = require("../src/parser");
const { startServer } = require("../src/server");
const { getMentorState } = require("../src/lib/mentorState");
const { installAgent, loginAgent } = require("../src/lib/mentorSetup");

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

/**
 * @param {string[]} argv
 * @returns {"mirror" | "mentor" | null}
 */
function parseModeFlag(argv) {
  const flag = argv.find((a) => a.startsWith("--mode="));
  if (!flag) return null;
  const raw = String(flag.split("=")[1] ?? "")
    .trim()
    .toLowerCase();
  if (raw === "mirror" || raw === "mentor") return raw;
  console.error(
    style.err(
      "getbumps: invalid --mode (use mirror or mentor, e.g. --mode=mirror)"
    )
  );
  process.exit(1);
}

function fallbackToMirror() {
  console.log("  Switching to Mirror mode instead.");
  console.log(
    "  Run getbumps anytime — select Mentor again once you're ready."
  );
  return "mirror";
}

/** @param {{ ready: boolean }} mentorStateHint */
async function promptModeInteractive(mentorStateHint) {
  const { select, isCancel } = await import("@clack/prompts");

  console.log("Welcome to Bumps.");
  console.log("");
  console.log("How would you like to analyze your building patterns?");
  console.log("");

  const choice = await select({
    message: "",
    options: [
      {
        value: "mirror",
        label: "Mirror",
        hint: "Fast, local, no setup needed. Your data never leaves.",
      },
      {
        value: "mentor",
        label: mentorStateHint.ready ? "Mentor" : "Mentor (setup required)",
        hint: "Deeper analysis using your own Cursor Agent. Your data never leaves.",
      },
    ],
    initialValue: "mirror",
  });

  if (isCancel(choice)) process.exit(0);
  return choice;
}

async function runMentorSetupFlow() {
  const { confirm, isCancel } = await import("@clack/prompts");

  console.log("Mentor selected.");
  console.log("");
  console.log(
    "  Mentor requires Cursor Agent CLI to analyze your sessions on your device."
  );
  console.log(
    "  Your data never leaves your machine — analysis runs using your own Cursor account."
  );

  let state = getMentorState();

  if (!state.installed) {
    console.log("");
    console.log("  Step 1: Install Cursor Agent CLI");
    const ok = await confirm({
      message: "  Would you like to install it now?",
      initialValue: true,
    });
    if (isCancel(ok)) process.exit(0);
    if (!ok) return fallbackToMirror();
    console.log("  Installing...");
    const installOk = await installAgent();
    if (!installOk) return fallbackToMirror();
    console.log("  \u2713 Cursor Agent CLI installed.");
    state = getMentorState();
    if (!state.installed) return fallbackToMirror();
  }

  if (!state.loggedIn) {
    console.log("");
    console.log("  Step 2: Log in with your Cursor account.");
    console.log(
      "  This opens your browser — same account you already use in Cursor."
    );
    const ok2 = await confirm({
      message: "  Would you like to continue?",
      initialValue: true,
    });
    if (isCancel(ok2)) process.exit(0);
    if (!ok2) return fallbackToMirror();
    const loginOk = await loginAgent();
    if (!loginOk) return fallbackToMirror();
    state = getMentorState();
    if (!state.loggedIn) return fallbackToMirror();
    console.log(`  \u2713 Logged in as ${state.email}`);
  }

  return "mentor";
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

async function main() {
  const argv = process.argv.slice(2);
  const port = parsePort(argv);
  const modeFlag = parseModeFlag(argv);

  console.log("");
  printBanner();
  console.log("");
  console.log(style.muted(TAGLINE));
  console.log("");

  const mentorStateHint = getMentorState();

  /** @type {"mirror" | "mentor"} */
  let mode;
  if (modeFlag === "mirror") {
    mode = "mirror";
  } else if (modeFlag === "mentor") {
    mode = "mentor";
  } else if (!process.stdout.isTTY) {
    console.log(
      style.muted(
        "  (non-interactive terminal — defaulting to Mirror. Use --mode=mentor to opt in.)"
      )
    );
    mode = "mirror";
  } else {
    mode = await promptModeInteractive(mentorStateHint);
  }

  if (mode === "mentor") {
    const stateNow = getMentorState();
    if (stateNow.ready) {
      console.log("Mentor selected.");
      console.log("");
      console.log("  \u2713 Cursor Agent CLI found.");
      console.log(`  \u2713 Logged in as ${stateNow.email}`);
      console.log("");
    } else {
      mode = await runMentorSetupFlow();
    }
  }

  process.env.BUMPS_MODE = mode;

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

  /** @type {ReturnType<typeof parse>} */
  let parsedData;
  let mentorSpinner = null;
  if (mode === "mentor") {
    console.log(style.out("  🧠  Preparing your Mentor view…"));
    console.log(style.out("  📚  Reading Cursor history…"));
    const parseStarted = performance.now();
    parsedData = parse();
    const parseMs = Math.round(performance.now() - parseStarted);
    console.log(style.out(`  ⚡  Parsed in ${parseMs} ms`));
    const nProjects = parsedData.projects.length;
    const nConversations = parsedData.totalConversations;
    console.log(
      style.out(
        `  🗂️   Found ${nProjects} project${nProjects === 1 ? "" : "s"}, ${nConversations} conversation${nConversations === 1 ? "" : "s"}`
      )
    );

    const { spinner } = await import("@clack/prompts");
    mentorSpinner = spinner();
    mentorSpinner.start("Mentor is analyzing your sessions...");
  } else {
    console.log(style.out("  📚  Reading Cursor history…"));
    const parseStarted = performance.now();
    parsedData = parse();
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
  }

  const dashboardPath = defaultDashboardPath();

  if (mentorSpinner) {
    mentorSpinner.stop();
  }

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
      if (mode !== "mentor") {
        console.log(style.accent("  ✨  Insights ready"));
      }
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
