#!/usr/bin/env node
"use strict";

/**
 * Manual smoke: real parse → prompt token estimate → Mentor pipeline (cache or agent).
 * Usage: node scripts/mentor-smoke.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse } = require("../src/parser");
const {
  buildMentorPromptBundle,
  estimateTokens,
} = require("../src/lib/mentorPrompt");
const {
  getMentorStatusSync,
  ensureMentorRunning,
} = require("../src/lib/mentorInsights");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tmpCache = fs.mkdtempSync(
    path.join(os.tmpdir(), "bumps-mentor-smoke-")
  );
  process.env.BUMPS_MENTOR_CACHE_DIR = tmpCache;

  try {
    console.log("Parsing…");
    const parsedData = parse();
    const bundle = buildMentorPromptBundle(parsedData);
    const tok = estimateTokens(bundle.prompt);
    console.log("Prompt token estimate:", tok);
    if (tok > 15_000) {
      console.warn("WARN: prompt estimate exceeds 15k soft target");
    }
    console.log("Prompt head:\n", bundle.prompt.slice(0, 500));
    console.log("\n…\n");
    console.log("Prompt tail:\n", bundle.prompt.slice(-500));

    console.log("\nRunning Mentor pipeline…");
    ensureMentorRunning(parsedData);
    for (let i = 0; i < 120; i++) {
      const snap = getMentorStatusSync(parsedData);
      console.log("status:", snap.status, snap.reason || "");
      if (snap.status === "ready") {
        console.log(JSON.stringify(snap, null, 2));
        if (!snap.mentor?.insights?.length) {
          console.error("FAIL: expected mentor.insights when ready");
          process.exit(1);
        }
        return;
      }
      if (snap.status === "error") {
        console.log(JSON.stringify(snap, null, 2));
        console.log("(error — exiting)");
        process.exit(snap.reason === "no_qualifying_sessions" ? 0 : 1);
      }
      await sleep(1000);
    }
    console.error("FAIL: timeout waiting for mentor");
    process.exit(1);
  } finally {
    delete process.env.BUMPS_MENTOR_CACHE_DIR;
    fs.rmSync(tmpCache, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
