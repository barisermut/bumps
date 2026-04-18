"use strict";

const { spawn } = require("child_process");
const { estimateTokens } = require("./mentorPrompt");

const DEFAULT_TIMEOUT_MS = 90_000;
const DEBUG_TOKENS = process.env.BUMPS_DEBUG === "1";

/**
 * @param {string} stdout
 * @returns {string|null}
 */
function extractAgentText(stdout) {
  const raw = String(stdout || "").trim();
  if (!raw) return null;

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return raw;
  }

  if (envelope && typeof envelope === "object") {
    if (typeof envelope.result === "string") return envelope.result;
    if (typeof envelope.output === "string") return envelope.output;
    if (envelope.message && typeof envelope.message.content === "string") {
      return envelope.message.content;
    }
    if (typeof envelope.text === "string") return envelope.text;
    if (typeof envelope.response === "string") return envelope.response;
  }

  return raw;
}

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
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
 */
function runMentorAgent(prompt, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(
      "agent",
      [
        "--print",
        "--output-format",
        "json",
        "--mode",
        "ask",
        "--trust",
        "--model",
        "auto",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let killTimer = null;
    let hardKillTimer = null;

    const finish = (out) => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
      if (hardKillTimer) clearTimeout(hardKillTimer);
      hardKillTimer = null;
      resolve(out);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });

    child.on("error", (err) => {
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
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

    killTimer = setTimeout(() => {
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
    }, timeoutMs);

    child.stdin.write(prompt, "utf8");
    child.stdin.end();

    child.on("close", (code) => {
      const durationMs = Date.now() - started;
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
      if (hardKillTimer) clearTimeout(hardKillTimer);
      hardKillTimer = null;

      const promptEstimate = estimateTokens(prompt);

      if (settled) return;

      if (timedOut) {
        if (DEBUG_TOKENS) {
          console.log(
            `[bumps] mentor tokens: prompt=${promptEstimate} response~0 agentUsage={} durationMs=${durationMs} reason=timeout_90s`
          );
        }
        finish({
          ok: false,
          reason: "timeout_90s",
          stderr: stderr || "",
          durationMs,
        });
        return;
      }

      if (code !== 0) {
        const responseEstimate = Math.ceil(stdout.length / 4);
        if (DEBUG_TOKENS) {
          console.log(
            `[bumps] mentor tokens: prompt=${promptEstimate} response~${responseEstimate} agentUsage={} durationMs=${durationMs} exit=${code}`
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

      let envelopeUsage = {};
      try {
        const env = JSON.parse(String(stdout || "").trim());
        if (env && typeof env === "object") {
          envelopeUsage =
            env.usage || env.tokens || env.tokenUsage || env.meta?.usage || {};
        }
      } catch {
        /* not full JSON */
      }

      const text = extractAgentText(stdout);
      const parsed = text ? extractMentorJson(text) : null;

      const responseEstimate = Math.ceil((text || "").length / 4);

      if (DEBUG_TOKENS) {
        console.log(
          `[bumps] mentor tokens: prompt=${promptEstimate} response~${responseEstimate} agentUsage=${JSON.stringify(envelopeUsage)} durationMs=${durationMs}`
        );
      }

      if (!parsed || typeof parsed !== "object") {
        finish({
          ok: false,
          reason: "invalid_json",
          stderr: stderr || "",
          durationMs,
          raw: stdout,
        });
        return;
      }

      finish({
        ok: true,
        raw: stdout,
        json: parsed,
        tokens: {
          promptEstimate,
          responseEstimate,
          agentUsage: envelopeUsage,
        },
        durationMs,
      });
    });
  });
}

const MAX_DIAGNOSIS = 800;
const MAX_GUIDANCE = 800;
const MAX_SUMMARY = 400;

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

  const { knownSessionIds, knownProjects } = ctx;

  if (typeof json.overallDiagnosis !== "string") {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  if (!Array.isArray(json.patterns)) {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  const patternsIn = json.patterns.slice(0, 10);
  const patternsOut = [];

  for (const p of patternsIn) {
    if (!p || typeof p !== "object") continue;
    if (typeof p.id !== "string" || typeof p.title !== "string") continue;
    if (!["low", "medium", "high"].includes(p.severity)) continue;
    if (typeof p.diagnosis !== "string" || typeof p.guidance !== "string") {
      continue;
    }
    if (!Array.isArray(p.evidence) || p.evidence.length === 0) continue;

    const evidenceOut = [];
    for (const ev of p.evidence) {
      if (!ev || typeof ev !== "object") continue;
      if (typeof ev.project !== "string" || typeof ev.summary !== "string") {
        continue;
      }
      const ids = Array.isArray(ev.sessionIds) ? ev.sessionIds : [];
      const filtered = ids.filter((id) => knownSessionIds.has(String(id)));
      if (filtered.length < ids.length) {
        warnings.push("dropped_invented_session_ids");
      }
      if (filtered.length === 0) continue;
      evidenceOut.push({
        project: ev.project,
        sessionIds: filtered,
        summary: truncateStr(ev.summary, MAX_SUMMARY),
      });
    }

    if (evidenceOut.length === 0) continue;

    patternsOut.push({
      id: p.id,
      title: p.title,
      severity: p.severity,
      diagnosis: truncateStr(p.diagnosis, MAX_DIAGNOSIS),
      evidence: evidenceOut,
      guidance: truncateStr(p.guidance, MAX_GUIDANCE),
    });
  }

  if (patternsOut.length === 0) {
    return { ok: false, warnings, reason: "validation_empty" };
  }

  const themesOut = [];
  if (Array.isArray(json.themes)) {
    for (const t of json.themes) {
      if (!t || typeof t !== "object") continue;
      if (typeof t.name !== "string") continue;
      let share = typeof t.share === "number" ? t.share : 0;
      if (share < 0) share = 0;
      if (share > 1) share = 1;
      const sample = Array.isArray(t.sampleSessionIds)
        ? t.sampleSessionIds.filter((id) => knownSessionIds.has(String(id)))
        : [];
      themesOut.push({ name: t.name, share, sampleSessionIds: sample });
    }
  }

  const perProjectOut = [];
  if (Array.isArray(json.perProject)) {
    for (const pp of json.perProject) {
      if (!pp || typeof pp !== "object") continue;
      if (typeof pp.project !== "string") continue;
      if (!knownProjects.has(pp.project)) continue;
      if (typeof pp.diagnosis !== "string") continue;
      const primary = Array.isArray(pp.primaryPatternIds)
        ? pp.primaryPatternIds.filter((x) => typeof x === "string")
        : [];
      perProjectOut.push({
        project: pp.project,
        diagnosis: truncateStr(pp.diagnosis, MAX_DIAGNOSIS),
        primaryPatternIds: primary,
      });
    }
  }

  return {
    ok: true,
    value: {
      overallDiagnosis: truncateStr(json.overallDiagnosis, MAX_DIAGNOSIS * 2),
      patterns: patternsOut,
      themes: themesOut,
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
  extractAgentText,
  extractMentorJson,
  DEFAULT_TIMEOUT_MS,
};
