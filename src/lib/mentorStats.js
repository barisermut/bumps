"use strict";

const MIN_SESSIONS_PER_PROJECT = 3;

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

function conversationTimeMs(c) {
  if (c.createdAt) {
    const t = new Date(c.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (c.lastUpdatedAt) {
    const t = new Date(c.lastUpdatedAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function computeSessionSpanMinutes(c) {
  if (!c.createdAt || !c.lastUpdatedAt) return null;
  const ms = new Date(c.lastUpdatedAt) - new Date(c.createdAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms / 60000, 480);
}

function countFixCycles(conversation) {
  let count = 0;
  const messages = conversation.messages || [];
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    if (messages[i - 1].role !== "assistant") continue;
    const text = (messages[i].text || "").toLowerCase();
    if (CORRECTION_SIGNALS.some((sig) => text.includes(sig))) {
      count++;
    }
  }
  return count;
}

/**
 * Projects with at least MIN_SESSIONS_PER_PROJECT sessions; return only
 * conversations belonging to those projects.
 * @param {{ conversations?: object[] }} parsedData
 * @returns {object[]}
 */
function getQualifyingConversations(parsedData) {
  const all = parsedData.conversations || [];
  const byProject = new Map();
  for (const c of all) {
    const p = c.project || "Unknown";
    if (!byProject.has(p)) byProject.set(p, []);
    byProject.get(p).push(c);
  }
  const okProjects = new Set();
  for (const [p, list] of byProject) {
    if (list.length >= MIN_SESSIONS_PER_PROJECT) okProjects.add(p);
  }
  return all.filter((c) => okProjects.has(c.project || "Unknown"));
}

/**
 * @param {{ conversations?: object[] }} parsedData
 * @returns {{
 *   totalSessions: number;
 *   totalMessages: number;
 *   avgSessionMinutes: number;
 *   frustrationPercent: number;
 *   perProject: Array<{
 *     project: string;
 *     sessions: number;
 *     messages: number;
 *     avgTimeMinutes: number;
 *     frustrationPercent: number;
 *   }>;
 * }}
 */
function computeMentorStats(parsedData) {
  const conv = getQualifyingConversations(parsedData);
  const totalSessions = conv.length;
  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      totalMessages: 0,
      avgSessionMinutes: 0,
      frustrationPercent: 0,
      perProject: [],
    };
  }

  let totalMessages = 0;
  let spanSum = 0;
  let spanN = 0;
  let frustrated = 0;

  /** @type {Map<string, { sessions: number; messages: number; spanSum: number; spanN: number; frustrated: number }>} */
  const byProject = new Map();

  for (const c of conv) {
    const p = c.project || "Unknown";
    if (!byProject.has(p)) {
      byProject.set(p, {
        sessions: 0,
        messages: 0,
        spanSum: 0,
        spanN: 0,
        frustrated: 0,
      });
    }
    const agg = byProject.get(p);

    const msgCount = Number(c.messageCount) || (c.messages?.length ?? 0);
    totalMessages += msgCount;
    agg.sessions += 1;
    agg.messages += msgCount;

    const span = computeSessionSpanMinutes(c);
    if (span != null) {
      spanSum += span;
      spanN += 1;
      agg.spanSum += span;
      agg.spanN += 1;
    }
    const userMsg = Number(c.userMessageCount) || 0;
    const corr = countFixCycles(c);
    if (userMsg > 0 && corr / userMsg >= 0.25) {
      frustrated += 1;
      agg.frustrated += 1;
    }
  }

  const avgSessionMinutes =
    spanN > 0 ? Math.round((spanSum / spanN) * 10) / 10 : 0;
  const frustrationPercent =
    Math.round((frustrated / totalSessions) * 1000) / 10;

  const perProject = [...byProject.entries()].map(([project, a]) => ({
    project,
    sessions: a.sessions,
    messages: a.messages,
    avgTimeMinutes:
      a.spanN > 0 ? Math.round((a.spanSum / a.spanN) * 10) / 10 : 0,
    frustrationPercent:
      a.sessions > 0
        ? Math.round((a.frustrated / a.sessions) * 1000) / 10
        : 0,
  }));

  perProject.sort((x, y) => {
    if (y.sessions !== x.sessions) return y.sessions - x.sessions;
    return String(x.project).localeCompare(String(y.project));
  });

  return {
    totalSessions,
    totalMessages,
    avgSessionMinutes,
    frustrationPercent,
    perProject,
  };
}

module.exports = {
  computeMentorStats,
  getQualifyingConversations,
  MIN_SESSIONS_PER_PROJECT,
  computeSessionSpanMinutes,
  countFixCycles,
  conversationTimeMs,
};
