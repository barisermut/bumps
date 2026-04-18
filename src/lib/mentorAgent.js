"use strict";

const readline = require("node:readline");
const { spawn } = require("child_process");
const { estimateTokens } = require("./mentorPrompt");

const STREAM_INACTIVITY_TIMEOUT_MS = 30_000;
const DEBUG_TOKENS = process.env.BUMPS_DEBUG === "1";

/**
 * @param {string} text
 * @returns {object|null}
 */
function extractMentorJson(text) {
  if (!text || typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

/**
 * @param {string} prompt
 * @param {object} [_opts]
 */
function runMentorAgent(prompt, _opts = {}) {
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(
      "agent",
      [
        "--print",
        "--output-format",
        "stream-json",
        "--mode",
        "ask",
        "--trust",
        "--model",
        "composer-2-fast",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stderr = "";
    let envelopeUsage = {};
    let lastAssistantText = "";
    let settled = false;
    let timedOut = false;
    let inactivityTimer = null;
    let hardKillTimer = null;

    const finish = (out) => {
      if (settled) return;
      settled = true;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = null;
      if (hardKillTimer) clearTimeout(hardKillTimer);
      hardKillTimer = null;
      resolve(out);
    };

    const armInactivity = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
        hardKillTimer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        }, 5000);
      }, STREAM_INACTIVITY_TIMEOUT_MS);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => {
      stderr += d;
    });

    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      armInactivity();
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        return;
      }
      if (!evt || typeof evt !== "object") return;

      if (evt.type === "assistant") {
        const text = evt.message?.content?.[0]?.text;
        if (typeof text === "string") {
          lastAssistantText = text;
          const parsed = extractMentorJson(text);
          if (parsed && typeof parsed === "object") {
            const promptEstimate = estimateTokens(prompt);
            const responseEstimate = Math.ceil(text.length / 4);
            if (DEBUG_TOKENS) {
              console.log(
                `[bumps] mentor tokens: prompt=${promptEstimate} response~${responseEstimate} agentUsage=${JSON.stringify(envelopeUsage)} durationMs=${Date.now() - started}`
              );
            }
            finish({
              ok: true,
              json: parsed,
              tokens: {
                promptEstimate,
                responseEstimate,
                agentUsage: envelopeUsage,
              },
              durationMs: Date.now() - started,
            });
            try {
              child.kill("SIGTERM");
            } catch {
              /* ignore */
            }
          }
        }
      } else if (evt.type === "result") {
        envelopeUsage =
          evt.usage ||
          evt.tokens ||
          evt.tokenUsage ||
          evt.meta?.usage ||
          {};
      }
    });

    child.on("error", (err) => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = null;
      if (hardKillTimer) clearTimeout(hardKillTimer);
      hardKillTimer = null;
      const durationMs = Date.now() - started;
      const promptEstimate = estimateTokens(prompt);
      const reason =
        err && err.code === "ENOENT" ? "agent_missing" : `agent_spawn_error`;
      if (DEBUG_TOKENS) {
        console.log(
          `[bumps] mentor tokens: prompt=${promptEstimate} response~0 agentUsage={} durationMs=${durationMs} reason=${reason}`
        );
      }
      finish({
        ok: false,
        reason: err && err.code === "ENOENT" ? "agent_missing" : reason,
        stderr: String(err && err.message ? err.message : err),
        durationMs,
      });
    });

    child.stdin.write(prompt, "utf8");
    child.stdin.end();
    armInactivity();

    child.on("close", (code) => {
      const durationMs = Date.now() - started;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = null;
      if (hardKillTimer) clearTimeout(hardKillTimer);
      hardKillTimer = null;

      const promptEstimate = estimateTokens(prompt);

      if (settled) return;

      if (timedOut) {
        if (DEBUG_TOKENS) {
          console.log(
            `[bumps] mentor tokens: prompt=${promptEstimate} response~0 agentUsage=${JSON.stringify(envelopeUsage)} durationMs=${durationMs} reason=stream_timeout_30s`
          );
        }
        finish({
          ok: false,
          reason: "stream_timeout_30s",
          stderr: stderr || "",
          durationMs,
        });
        return;
      }

      if (code !== 0) {
        const responseEstimate = Math.ceil(lastAssistantText.length / 4);
        if (DEBUG_TOKENS) {
          console.log(
            `[bumps] mentor tokens: prompt=${promptEstimate} response~${responseEstimate} agentUsage=${JSON.stringify(envelopeUsage)} durationMs=${durationMs} exit=${code}`
          );
        }
        finish({
          ok: false,
          reason: `agent_exit_${code}`,
          stderr: stderr || "",
          durationMs,
        });
        return;
      }

      const responseEstimate = Math.ceil(lastAssistantText.length / 4);

      if (DEBUG_TOKENS) {
        console.log(
          `[bumps] mentor tokens: prompt=${promptEstimate} response~${responseEstimate} agentUsage=${JSON.stringify(envelopeUsage)} durationMs=${durationMs}`
        );
      }

      finish({
        ok: false,
        reason: "invalid_json",
        stderr: stderr || "",
        durationMs,
        raw: lastAssistantText,
      });
    });
  });
}

const MAX_TITLE = 200;
const MAX_DIAGNOSIS = 800;
const MAX_GUIDANCE = 800;
const MAX_PER_PROJECT_INSIGHT = 400;

function humanizeName(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProjectKey(s) {
  return humanizeName(s).toLowerCase();
}

const GENERIC_PROJECT_KEYS = new Set([
  "",
  "window",
  "empty window",
  "global",
  "untitled",
  "unknown",
]);

/** @param {string} key — normalized lowercase key from normalizeProjectKey */
function isGenericProjectKey(key) {
  return GENERIC_PROJECT_KEYS.has(key);
}

/**
 * @param {Set<string>} knownProjects
 * @returns {Map<string, string>} normalizedKey -> display name (humanized from known)
 */
function knownProjectIndex(knownProjects) {
  const m = new Map();
  for (const p of knownProjects) {
    const display = humanizeName(p);
    m.set(normalizeProjectKey(p), display);
  }
  return m;
}

/**
 * @param {object} json
 * @param {{ knownSessionIds: Set<string>, knownProjects: Set<string> }} ctx
 * @returns {{ ok: boolean, value?: object, warnings: string[], reason?: string }}
 */
function validateMentorResponse(json, ctx) {
  const warnings = [];
  if (!json || typeof json !== "object") {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  const { knownProjects } = ctx;
  const projIndex = knownProjectIndex(knownProjects);

  if (!Array.isArray(json.insights)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }
  if (!Array.isArray(json.themes)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }
  if (!Array.isArray(json.topPatterns)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }
  if (!Array.isArray(json.toolsAndMcps)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }
  if (!Array.isArray(json.perProject)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  const insightsIn = json.insights.slice(0, 10);
  const insightsOut = [];

  for (const ins of insightsIn) {
    if (!ins || typeof ins !== "object") continue;
    if (typeof ins.id !== "string" || typeof ins.title !== "string") continue;
    if (!["low", "medium", "high"].includes(ins.severity)) continue;
    if (
      typeof ins.diagnosis !== "string" ||
      typeof ins.guidance !== "string"
    ) {
      continue;
    }
    const projectsRaw = Array.isArray(ins.projects) ? ins.projects : [];
    const projectsOut = [];
    for (const pr of projectsRaw) {
      if (typeof pr !== "string") continue;
      const key = normalizeProjectKey(pr);
      if (isGenericProjectKey(key)) {
        warnings.push("dropped_generic_project_in_insight");
        continue;
      }
      const canonical = projIndex.get(key);
      if (canonical) projectsOut.push(canonical);
      else warnings.push("dropped_unknown_project_in_insight");
    }
    const distinctProjects = [...new Set(projectsOut)];
    const sessionCount = Math.floor(Number(ins.sessionCount));
    if (distinctProjects.length < 3 || sessionCount < 3) continue;

    insightsOut.push({
      id: ins.id,
      title: truncateStr(humanizeName(ins.title), MAX_TITLE),
      severity: ins.severity,
      diagnosis: truncateStr(ins.diagnosis, MAX_DIAGNOSIS),
      guidance: truncateStr(ins.guidance, MAX_GUIDANCE),
      projects: distinctProjects,
      sessionCount,
    });
    if (insightsOut.length >= 6) break;
  }

  if (insightsOut.length === 0) {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  const themesOut = [];
  for (const t of json.themes) {
    if (!t || typeof t !== "object") continue;
    if (typeof t.name !== "string") continue;
    let share = typeof t.share === "number" ? t.share : 0;
    if (share < 0) share = 0;
    if (share > 1) share = 1;
    themesOut.push({
      name: humanizeName(t.name),
      share,
    });
    if (themesOut.length >= 6) break;
  }

  const topPatternsOut = [];
  for (const tp of json.topPatterns) {
    if (!tp || typeof tp !== "object") continue;
    if (typeof tp.name !== "string") continue;
    let pct = typeof tp.percentage === "number" ? tp.percentage : 0;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    topPatternsOut.push({
      name: humanizeName(tp.name),
      percentage: pct,
    });
    if (topPatternsOut.length >= 5) break;
  }

  const toolsOut = [];
  for (const tool of json.toolsAndMcps) {
    if (!tool || typeof tool !== "object") continue;
    if (typeof tool.name !== "string") continue;
    const sc = Math.max(0, Math.floor(Number(tool.sessionCount) || 0));
    toolsOut.push({
      name: humanizeName(tool.name),
      sessionCount: sc,
    });
    if (toolsOut.length >= 8) break;
  }

  const perProjectOut = [];
  for (const pp of json.perProject) {
    if (!pp || typeof pp !== "object") continue;
    if (typeof pp.project !== "string") continue;
    const key = normalizeProjectKey(pp.project);
    if (isGenericProjectKey(key)) {
      warnings.push("dropped_generic_per_project");
      continue;
    }
    const display = projIndex.get(key);
    if (!display) {
      warnings.push("dropped_unknown_per_project");
      continue;
    }
    const insightText =
      typeof pp.insight === "string"
        ? truncateStr(pp.insight.trim(), MAX_PER_PROJECT_INSIGHT)
        : "";
    perProjectOut.push({
      project: display,
      sessions: Math.max(0, Math.floor(Number(pp.sessions) || 0)),
      messages: Math.max(0, Math.floor(Number(pp.messages) || 0)),
      avgTimeMinutes: Math.max(
        0,
        Math.round((Number(pp.avgTimeMinutes) || 0) * 10) / 10
      ),
      frustrationPercent: Math.max(
        0,
        Math.min(100, Math.round((Number(pp.frustrationPercent) || 0) * 10) / 10)
      ),
      insight: insightText,
    });
  }

  return {
    ok: true,
    value: {
      insights: insightsOut,
      themes: themesOut,
      topPatterns: topPatternsOut,
      toolsAndMcps: toolsOut,
      perProject: perProjectOut,
    },
    warnings,
  };
}

function truncateStr(s, max) {
  if (!s || s.length <= max) return s;
  return s.slice(0, max);
}

module.exports = {
  runMentorAgent,
  validateMentorResponse,
  extractMentorJson,
};
