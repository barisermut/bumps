"use strict";

const crypto = require("crypto");
const {
  buildMentorPromptBundle,
  estimateTokens,
  filterConversations,
} = require("./mentorPrompt");
const mentorAgent = require("./mentorAgent");
const { readCache, writeCache, existsCached } = require("./mentorCache");

const DEBUG_TOKENS = process.env.BUMPS_DEBUG === "1";

function normalizeFilter(f) {
  return {
    project: f.project ?? null,
    timeRange: f.timeRange ?? "all",
  };
}

function getSessionFingerprint(parsedData, filter) {
  const nf = normalizeFilter(filter);
  const conv = filterConversations(parsedData.conversations || [], {
    project: nf.project,
    timeRange: nf.timeRange,
  });
  const lines = conv
    .map((c) =>
      `${String(c.composerId || "")}:${String(c.lastUpdatedAt || c.createdAt || "")}`
    )
    .sort();
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

function getMentorCacheKey(filter, sessionFingerprint) {
  const nf = normalizeFilter(filter);
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        project: nf.project,
        timeRange: nf.timeRange,
        sessionFingerprint,
      })
    )
    .digest("hex");
}

function previewCacheStatus(parsedData, filter) {
  const nf = normalizeFilter(filter);
  const fp = getSessionFingerprint(parsedData, nf);
  const key = getMentorCacheKey(nf, fp);
  return { cold: !existsCached(key), key };
}

function buildFallbackEnvelope({ filter, mirror, reason, cacheKey }) {
  const nf = normalizeFilter(filter);
  return {
    mode: "mentor",
    generatedAt: new Date().toISOString(),
    cacheKey: cacheKey || "none",
    fromCache: false,
    durationMs: 0,
    filter: { project: nf.project, timeRange: nf.timeRange },
    mirror,
    mentor: null,
    fallback: { used: true, reason },
  };
}

async function getMentorInsights({ parsedData, mirror, filter }) {
  const started = Date.now();
  const nf = normalizeFilter(filter);
  const sessionFingerprint = getSessionFingerprint(parsedData, nf);
  const cacheKey = getMentorCacheKey(nf, sessionFingerprint);

  const cached = readCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      fromCache: true,
      durationMs: Date.now() - started,
    };
  }

  const conv = filterConversations(parsedData.conversations || [], {
    project: nf.project,
    timeRange: nf.timeRange,
  });
  if (conv.length === 0) {
    return buildFallbackEnvelope({
      filter: nf,
      mirror,
      reason: "validation_empty",
      cacheKey,
    });
  }

  const bundle = buildMentorPromptBundle(parsedData, mirror, nf);
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
    return buildFallbackEnvelope({
      filter: nf,
      mirror,
      reason: agentResult.reason,
      cacheKey,
    });
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
    return buildFallbackEnvelope({
      filter: nf,
      mirror,
      reason: valid.reason || "validation_empty",
      cacheKey,
    });
  }

  let fallbackReason = null;
  if (valid.warnings.length) {
    fallbackReason = `validation_warnings:${[...new Set(valid.warnings)].join(",")}`;
  }

  const envelope = {
    mode: "mentor",
    generatedAt: new Date().toISOString(),
    cacheKey,
    fromCache: false,
    durationMs: Date.now() - started,
    filter: { project: nf.project, timeRange: nf.timeRange },
    mirror,
    mentor: valid.value,
    fallback: { used: false, reason: fallbackReason },
  };

  const toCache = {
    mode: envelope.mode,
    generatedAt: envelope.generatedAt,
    cacheKey: envelope.cacheKey,
    filter: envelope.filter,
    mirror: envelope.mirror,
    mentor: envelope.mentor,
    fallback: envelope.fallback,
  };
  writeCache(cacheKey, toCache);

  if (DEBUG_TOKENS) {
    console.log("[bumps] mentor tokens", {
      promptEstimate,
      responseEstimate: agentResult.tokens?.responseEstimate,
      agentUsage: agentResult.tokens?.agentUsage,
      durationMs: agentResult.durationMs,
      cacheKey,
    });
  }

  return envelope;
}

module.exports = {
  getMentorInsights,
  previewCacheStatus,
  getSessionFingerprint,
  getMentorCacheKey,
  buildFallbackEnvelope,
};
