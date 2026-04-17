#!/usr/bin/env node
"use strict";

/**
 * Manual smoke: real parse → prompt token estimate → getMentorInsights (cache or agent).
 * Usage: node scripts/mentor-smoke.js [--timeRange=7d]
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { parse } = require("../src/parser");
const { analyze } = require("../src/analyzer");
const {
  buildMentorPromptBundle,
  estimateTokens,
} = require("../src/lib/mentorPrompt");
const { getMentorInsights } = require("../src/lib/mentorInsights");

function parseArgs(argv) {
  const options = { timeRange: "7d" };
  for (const a of argv) {
    const m = a.match(/^--timeRange=(.+)$/);
    if (m) options.timeRange = m[1];
  }
  return options;
}

async function main() {
  const { timeRange } = parseArgs(process.argv.slice(2));
  const tmpCache = fs.mkdtempSync(
    path.join(os.tmpdir(), "bumps-mentor-smoke-")
  );
  process.env.BUMPS_MENTOR_CACHE_DIR = tmpCache;

  try {
    console.log("Parsing…");
    const parsedData = parse();
    const mirror = analyze(parsedData, { project: null, timeRange });
    const bundle = buildMentorPromptBundle(parsedData, mirror, {
      project: null,
      timeRange,
    });
    const tok = estimateTokens(bundle.prompt);
    console.log("Prompt token estimate:", tok);
    if (tok > 20_000) {
      console.error("FAIL: prompt estimate exceeds 20k");
      process.exit(1);
    }
    console.log("Prompt head:\n", bundle.prompt.slice(0, 500));
    console.log("\n…\n");
    console.log("Prompt tail:\n", bundle.prompt.slice(-500));

    console.log("\nRunning Mentor pipeline…");
    const envelope = await getMentorInsights({
      parsedData,
      mirror,
      filter: { project: null, timeRange },
    });
    console.log(JSON.stringify(envelope, null, 2));
    if (!envelope.fallback.used) {
      if (!envelope.mentor || !envelope.mentor.patterns?.length) {
        console.error("FAIL: expected mentor.patterns when fallback unused");
        process.exit(1);
      }
    } else {
      console.log("(fallback:", envelope.fallback.reason + ")");
    }
  } finally {
    delete process.env.BUMPS_MENTOR_CACHE_DIR;
    fs.rmSync(tmpCache, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
