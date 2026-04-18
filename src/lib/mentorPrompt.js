"use strict";

const DEBUG_TOKENS = process.env.BUMPS_DEBUG === "1";
const {
  getQualifyingConversations,
  computeMentorStats,
  computeSessionSpanMinutes,
  countFixCycles,
  conversationTimeMs,
} = require("./mentorStats");

const CORRECTION_SIGNALS = [
  "fix",
  "wrong",
  "not working",
  "broken",
  "error",
  "bug",
  "try again",
  "revert",
  "undo",
  "actually",
  "instead",
  "doesn't work",
  "does not work",
  "failed",
  "failing",
];

const MAX_SESSIONS_TOTAL = 100;
const MAX_SESSIONS_PER_PROJECT = 10;
const MIN_SESSIONS_AFTER_TRIM = 20;
const TOKEN_SOFT = 22_000;
const TOKEN_HARD = 25_000;
const TOKEN_TARGET = 20_000;

function lastUserMessageText(c) {
  const msgs = (c.messages || []).filter((m) => m.role === "user");
  if (!msgs.length) return "";
  return msgs[msgs.length - 1].text || "";
}

function truncate(s, max) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) : t;
}

function getFirstUserMessage(c, max = 300) {
  const m = (c.messages || []).find((x) => x.role === "user");
  return truncate(m?.text, max);
}

function getLastUserMessage(c, max = 150) {
  const msgs = (c.messages || []).filter((x) => x.role === "user");
  return truncate(msgs[msgs.length - 1]?.text, max);
}

function getCorrectionMessages(c, max = 150, limit = 3) {
  const out = [];
  for (const m of c.messages || []) {
    if (m.role !== "user") continue;
    const raw = m.text || "";
    const low = raw.toLowerCase();
    if (CORRECTION_SIGNALS.some((sig) => low.includes(sig))) {
      out.push(truncate(raw, max));
      if (out.length >= limit) break;
    }
  }
  return out;
}

function lastUserMsgHasCorrectionSignal(c) {
  const t = lastUserMessageText(c).toLowerCase();
  return CORRECTION_SIGNALS.some((sig) => t.includes(sig));
}

function firstAssistantModelId(c) {
  const m = (c.messages || []).find(
    (m2) => m2.role === "assistant" && m2.modelId
  );
  return m ? m.modelId : null;
}

function dedupeTools(tools) {
  return [...new Set(tools || [])];
}

function sessionIdShort(c) {
  const id = c.composerId || "";
  if (id.length >= 8) return id.slice(0, 8);
  return id || "unknown";
}

/**
 * User messages whose index in the full conversation lies in the middle 50%
 * of message positions, containing correction signals.
 */
function countMiddleSignals(c) {
  const messages = c.messages || [];
  const n = messages.length;
  if (n === 0) return 0;
  const low = Math.floor(n * 0.25);
  const high = Math.ceil(n * 0.75);
  let count = 0;
  for (let i = low; i < high && i < n; i++) {
    if (messages[i].role !== "user") continue;
    const text = (messages[i].text || "").toLowerCase();
    if (CORRECTION_SIGNALS.some((sig) => text.includes(sig))) count++;
  }
  return count;
}

/**
 * @param {object[]} capped
 */
function buildProjectArcs(capped) {
  const pmap = new Map();
  for (const c of capped) {
    const p = c.project || "Unknown";
    if (!pmap.has(p)) {
      pmap.set(p, {
        project: p,
        sessionCount: 0,
        sumCorrections: 0,
        sumUserMsgs: 0,
        sumSpan: 0,
        spanN: 0,
        endedCorr: 0,
        frustrated: 0,
        firstSession: null,
        lastSession: null,
      });
    }
    const a = pmap.get(p);
    a.sessionCount += 1;
    a.sumCorrections += countFixCycles(c);
    const um = Number(c.userMessageCount) || 0;
    a.sumUserMsgs += um;
    const span = computeSessionSpanMinutes(c);
    if (span != null) {
      a.sumSpan += span;
      a.spanN += 1;
    }
    if (lastUserMsgHasCorrectionSignal(c)) a.endedCorr += 1;
    if (um > 0 && countFixCycles(c) / um >= 0.25) a.frustrated += 1;
    const ca = c.createdAt || c.lastUpdatedAt;
    if (ca) {
      if (!a.firstSession || ca < a.firstSession) a.firstSession = ca;
      if (!a.lastSession || ca > a.lastSession) a.lastSession = ca;
    }
  }
  return [...pmap.values()].map((a) => ({
    project: a.project,
    sessionCount: a.sessionCount,
    correctionRate: a.sumUserMsgs > 0 ? a.sumCorrections / a.sumUserMsgs : 0,
    avgSpanMin: a.spanN > 0 ? Math.round((a.sumSpan / a.spanN) * 10) / 10 : 0,
    abandonmentRate: a.sessionCount > 0 ? a.endedCorr / a.sessionCount : 0,
    frustrationPercent:
      a.sessionCount > 0
        ? Math.round((a.frustrated / a.sessionCount) * 1000) / 10
        : 0,
    firstSession: a.firstSession,
    lastSession: a.lastSession,
  }));
}

function mapRow(c) {
  return {
    id: sessionIdShort(c),
    project: c.project || "Unknown",
    messageCount: Number(c.messageCount) || (c.messages?.length ?? 0),
    userMessageCount: Number(c.userMessageCount) || 0,
    correctionCycles: countFixCycles(c),
    endedOnCorrection: lastUserMsgHasCorrectionSignal(c),
    middleSignals: countMiddleSignals(c),
    linesChanged: (Number(c.linesAdded) || 0) + (Number(c.linesRemoved) || 0),
    toolsUsed: dedupeTools(c.toolsUsed).slice(0, 8),
    skillsUsed: (c.skillsReferenced || []).slice(0, 8),
    durationMinutes: computeSessionSpanMinutes(c),
    modelUsed: firstAssistantModelId(c),
    firstUserMessage: getFirstUserMessage(c),
    correctionMessages: getCorrectionMessages(c),
    lastUserMessage: getLastUserMessage(c),
  };
}

function assemblePrompt(sessionRows, projectArcs, stats) {
  return [
    "You are Bumps Mentor, analyzing a single developer's conversation history with Cursor. Identify behavioral patterns that slow this builder down; output structured JSON only.",
    "",
    "Constraints:",
    "- Output MUST be valid JSON matching the schema below. No prose outside JSON. No markdown.",
    "- Never print raw numbers, decimals, rates, or percentages in any string field (title, diagnosis, guidance, names). Translate every metric into plain English.",
    "- The firstUserMessage, correctionMessages, and lastUserMessage fields are evidence for your analysis. Do not quote them verbatim in any output string; paraphrase and aggregate across sessions.",
    "- Plain English only. Human readable names: use spaces, never underscores or hyphens in project or tool names inside string fields.",
    "- Write for a non-technical builder reading a dashboard.",
    "- Every insights[] entry MUST cite evidence from at least three distinct sessions: sessionCount must be at least 3, and projects must list at least three distinct project names from the data. Drop weaker insights.",
    "- insights max 6. themes max 6. topPatterns max 5. toolsAndMcps max 8.",
    "- This developer uses an agentic coding tool. Do not treat linesChanged alone as a problem; focus on correction cycles, mid-session drift (middleSignals), abandonment, and repeated friction.",
    "",
    "Schema (top-level object):",
    "{",
    '  "insights": [{',
    '    "id": string,',
    '    "severity": "high"|"medium"|"low",',
    '    "title": string,',
    '    "diagnosis": string,',
    '    "guidance": string,',
    '    "projects": [string],',
    '    "sessionCount": number',
    "  }],",
    '  "themes": [{ "name": string, "share": number }],',
    '  "topPatterns": [{ "name": string, "percentage": number }],',
    '  "toolsAndMcps": [{ "name": string, "sessionCount": number }],',
    '  "perProject": [{',
    '    "project": string,',
    '    "sessions": number,',
    '    "messages": number,',
    '    "avgTimeMinutes": number,',
    '    "frustrationPercent": number',
    "  }]",
    "}",
    "",
    "Aggregate stats (from Bumps — you may reference qualitatively in strings only, never paste these numbers into diagnosis/guidance/title):",
    JSON.stringify(stats),
    "",
    "Project arcs (cross-session aggregates — use for project-level patterns; cite qualitatively in prose fields only):",
    JSON.stringify(projectArcs),
    "",
    "Sessions (structural signals plus short excerpts of the user's own messages — firstUserMessage shows what the session was about, correctionMessages show the actual words used when things went wrong, lastUserMessage shows how the session ended):",
    JSON.stringify(sessionRows),
    "",
    "Return only the JSON object.",
  ].join("\n");
}

/**
 * @param {{ conversations?: object[] }} parsedData
 */
function buildMentorPromptBundle(parsedData) {
  const stats = computeMentorStats(parsedData);
  const qualifying = getQualifyingConversations(parsedData);

  const sorted = [...qualifying].sort((a, b) => {
    const ta = conversationTimeMs(a) ?? 0;
    const tb = conversationTimeMs(b) ?? 0;
    if (tb !== ta) return tb - ta;
    return (b.userMessageCount || 0) - (a.userMessageCount || 0);
  });

  const byProject = new Map();
  for (const c of sorted) {
    const p = c.project || "Unknown";
    if (!byProject.has(p)) byProject.set(p, []);
    byProject.get(p).push(c);
  }

  const picked = [];
  for (const [, list] of byProject) {
    for (let i = 0; i < Math.min(MAX_SESSIONS_PER_PROJECT, list.length); i++) {
      picked.push(list[i]);
    }
  }

  picked.sort((a, b) => {
    const ta = conversationTimeMs(a) ?? 0;
    const tb = conversationTimeMs(b) ?? 0;
    if (tb !== ta) return tb - ta;
    return (b.userMessageCount || 0) - (a.userMessageCount || 0);
  });

  let capped = picked.slice(0, MAX_SESSIONS_TOTAL);
  let sessionRows = capped.map(mapRow);
  let projectArcs = buildProjectArcs(capped);
  let prompt = assemblePrompt(sessionRows, projectArcs, stats);
  let tok = estimateTokens(prompt);

  if (tok > TOKEN_SOFT && DEBUG_TOKENS) {
    console.warn(
      `[bumps] mentor prompt estimate ${tok} tokens exceeds soft target ${TOKEN_SOFT}`
    );
  }

  while (tok > TOKEN_HARD && capped.length > MIN_SESSIONS_AFTER_TRIM) {
    capped = capped.slice(0, Math.max(MIN_SESSIONS_AFTER_TRIM, capped.length - 10));
    sessionRows = capped.map(mapRow);
    projectArcs = buildProjectArcs(capped);
    prompt = assemblePrompt(sessionRows, projectArcs, stats);
    tok = estimateTokens(prompt);
  }

  const knownSessionIds = new Set(capped.map(sessionIdShort));
  const knownProjects = new Set(capped.map((c) => c.project || "Unknown"));

  return {
    prompt,
    knownSessionIds,
    knownProjects,
    projectArcs,
    stats,
    sessionRows,
  };
}

function buildMentorPrompt(parsedData) {
  return buildMentorPromptBundle(parsedData).prompt;
}

function estimateTokens(s) {
  return Math.ceil(String(s).length / 4);
}

module.exports = {
  buildMentorPrompt,
  buildMentorPromptBundle,
  estimateTokens,
  sessionIdShort,
};
