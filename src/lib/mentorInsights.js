"use strict";

const crypto = require("crypto");
const { buildMentorPromptBundle, estimateTokens } = require("./mentorPrompt");
const mentorAgent = require("./mentorAgent");
const { readCache, writeCache, existsCached } = require("./mentorCache");
const {
  computeMentorStats,
  getQualifyingConversations,
} = require("./mentorStats");

const DEBUG_TOKENS = process.env.BUMPS_DEBUG === "1";

/** @type {Map<string, Promise<void>>} */
const inFlight = new Map();
/** @type {Map<string, { reason: string, at: number }>} */
const lastFailure = new Map();

const FAILURE_COOLDOWN_MS = 10_000;

function getSessionFingerprint(parsedData) {
  const conv = getQualifyingConversations(parsedData);
  const lines = conv
    .map((c) =>
      `${String(c.composerId || "")}:${String(c.lastUpdatedAt || c.createdAt || "")}`
    )
    .sort();
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

function getMentorCacheKey(sessionFingerprint) {
  return sessionFingerprint;
}

function previewCacheStatus(parsedData) {
  const fp = getSessionFingerprint(parsedData);
  const key = getMentorCacheKey(fp);
  return { cold: !existsCached(key), key };
}

/**
 * Rough wall-clock estimate for mentor analysis by prompt size.
 * @param {number} tokens
 * @returns {number}
 */
function estimateMentorSeconds(tokens) {
  return Math.max(15, Math.round(tokens * 0.00174));
}

/**
 * Synchronous snapshot for HTTP handler.
 * @param {{ conversations?: object[] }} parsedData
 * @returns {{
 *   status: "ready" | "computing" | "error";
 *   cacheKey: string;
 *   stats: object;
 *   mentor?: object;
 *   reason?: string | null;
 * }}
 */
function getMentorStatusSync(parsedData) {
  const stats = computeMentorStats(parsedData);
  const cacheKey = getMentorCacheKey(getSessionFingerprint(parsedData));

  const qualifying = getQualifyingConversations(parsedData);
  if (qualifying.length === 0) {
    return {
      status: "error",
      cacheKey,
      stats,
      reason: "no_qualifying_sessions",
    };
  }

  const cached = readCache(cacheKey);
  if (
    cached &&
    cached.status === "ready" &&
    cached.mentor &&
    Array.isArray(cached.mentor.insights) &&
    cached.mentor.insights.length > 0
  ) {
    return {
      status: "ready",
      cacheKey,
      stats,
      mentor: cached.mentor,
      reason: null,
    };
  }

  const fail = lastFailure.get(cacheKey);
  if (fail && Date.now() - fail.at < FAILURE_COOLDOWN_MS) {
    return {
      status: "error",
      cacheKey,
      stats,
      reason: fail.reason,
    };
  }

  if (inFlight.has(cacheKey)) {
    return {
      status: "computing",
      cacheKey,
      stats,
      reason: null,
    };
  }

  return {
    status: "computing",
    cacheKey,
    stats,
    reason: null,
  };
}

/**
 * Start agent run when status is computing and not already running.
 * @param {{ conversations?: object[] }} parsedData
 * @returns {Promise<void>}
 */
function ensureMentorRunning(parsedData) {
  const cacheKey = getMentorCacheKey(getSessionFingerprint(parsedData));
  const qualifying = getQualifyingConversations(parsedData);
  if (qualifying.length === 0) return Promise.resolve();

  const cached = readCache(cacheKey);
  if (
    cached &&
    cached.status === "ready" &&
    cached.mentor &&
    Array.isArray(cached.mentor.insights) &&
    cached.mentor.insights.length > 0
  ) {
    return Promise.resolve();
  }
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const prevFail = lastFailure.get(cacheKey);
  if (prevFail && Date.now() - prevFail.at < FAILURE_COOLDOWN_MS) {
    return Promise.resolve();
  }
  lastFailure.delete(cacheKey);

  const job = (async () => {
    const bundle = buildMentorPromptBundle(parsedData);
    const promptEstimate = estimateTokens(bundle.prompt);

    const agentResult = await mentorAgent.runMentorAgent(bundle.prompt);
    if (!agentResult.ok) {
      if (DEBUG_TOKENS) {
        console.log("[bumps] mentor tokens", {
          promptEstimate,
          responseEstimate: 0,
          agentUsage: {},
          durationMs: agentResult.durationMs,
          cacheKey,
        });
      }
      lastFailure.set(cacheKey, {
        reason: agentResult.reason || "agent_failed",
        at: Date.now(),
      });
      return;
    }

    const valid = mentorAgent.validateMentorResponse(agentResult.json, {
      knownSessionIds: bundle.knownSessionIds,
      knownProjects: bundle.knownProjects,
    });

    if (!valid.ok) {
      if (DEBUG_TOKENS) {
        console.log("[bumps] mentor tokens", {
          promptEstimate,
          responseEstimate: agentResult.tokens?.responseEstimate ?? 0,
          agentUsage: agentResult.tokens?.agentUsage ?? {},
          durationMs: agentResult.durationMs,
          cacheKey,
        });
      }
      lastFailure.set(cacheKey, {
        reason: valid.reason || "validation_empty",
        at: Date.now(),
      });
      return;
    }

    const toCache = {
      status: "ready",
      cacheKey,
      mentor: valid.value,
      generatedAt: new Date().toISOString(),
    };
    writeCache(cacheKey, toCache);
    lastFailure.delete(cacheKey);

    if (DEBUG_TOKENS) {
      console.log("[bumps] mentor tokens", {
        promptEstimate,
        responseEstimate: agentResult.tokens?.responseEstimate,
        agentUsage: agentResult.tokens?.agentUsage,
        durationMs: agentResult.durationMs,
        cacheKey,
      });
    }
  })();

  inFlight.set(cacheKey, job);
  job.finally(() => {
    inFlight.delete(cacheKey);
  });
  return job;
}

function __resetStateForTests() {
  inFlight.clear();
  lastFailure.clear();
}

module.exports = {
  getMentorStatusSync,
  ensureMentorRunning,
  previewCacheStatus,
  estimateMentorSeconds,
  getSessionFingerprint,
  getMentorCacheKey,
  __resetStateForTests,
};
