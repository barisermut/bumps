"use strict";

/**
 * Mentor prompt builder. Duplicates minimal keyword/category logic from
 * src/analyzer.js (not exported there) so analyzer stays unchanged.
 */

const CATEGORY_MAP = [
  { label: "Stuck on auth again", keywords: ["auth", "login", "signup", "register", "session", "token", "jwt", "oauth", "password", "credential", "logout"] },
  { label: "Down the database rabbit hole", keywords: ["database", "db", "sql", "query", "schema", "migration", "postgres", "sqlite", "mongo", "prisma", "drizzle", "supabase", "table", "row", "column"] },
  { label: "Chasing design details", keywords: ["css", "style", "styling", "layout", "responsive", "flexbox", "grid", "padding", "margin", "color", "font", "tailwind", "ui", "theme", "dark mode"] },
  { label: "Wiring up APIs", keywords: ["api", "endpoint", "rest", "graphql", "fetch", "cors", "middleware", "webhook", "payload", "request", "response"] },
  { label: "Wrestling with deploys", keywords: ["deploy", "deployment", "docker", "ci", "cd", "pipeline", "vercel", "netlify", "aws", "hosting", "dockerfile", "kubernetes"] },
  { label: "Filling in tests", keywords: ["test", "testing", "jest", "vitest", "spec", "assert", "mock", "coverage", "cypress", "playwright"] },
  { label: "Tangled in state management", keywords: ["state", "redux", "zustand", "context", "store", "reducer", "atom", "signal", "reactive", "useState", "useReducer"] },
  { label: "Chasing down errors", keywords: ["error", "exception", "catch", "throw", "debug", "stack", "trace", "crash", "bug", "broken"] },
  { label: "Tuning for performance", keywords: ["performance", "slow", "optimize", "cache", "lazy", "bundle", "chunk", "speed", "memory", "leak", "profiling"] },
  { label: "Caught in a refactor loop", keywords: ["refactor", "cleanup", "rename", "extract", "reorganize", "restructure", "simplify", "deduplicate"] },
  { label: "Tangled in config", keywords: ["config", "env", "environment", "setup", "install", "dependency", "package", "version", "compatibility", "dotenv"] },
  { label: "Getting lost in routing", keywords: ["route", "routing", "navigation", "redirect", "link", "page", "path", "url", "param", "router"] },
  { label: "Fixing forms and validation", keywords: ["form", "input", "validation", "submit", "field", "checkbox", "select", "textarea", "validator"] },
  { label: "Wrangling files", keywords: ["file", "upload", "download", "stream", "directory", "fs", "readfile", "writefile", "glob"] },
  { label: "Battling TypeScript types", keywords: ["type", "interface", "generic", "typescript", "typed", "enum", "union", "zod", "typeerror"] },
  { label: "Tinkering with animations", keywords: ["animation", "animate", "transition", "motion", "framer", "keyframe", "opacity", "transform"] },
  { label: "Building search and filters", keywords: ["search", "filter", "sort", "pagination", "query", "index", "autocomplete", "fuzzy"] },
  { label: "Plumbing notifications", keywords: ["notification", "toast", "alert", "email", "push", "webhook", "subscribe"] },
  { label: "Building data visualizations", keywords: ["chart", "graph", "visualization", "d3", "plot", "dashboard", "metric", "recharts"] },
  { label: "Writing documentation", keywords: ["doc", "documentation", "readme", "comment", "jsdoc", "typing", "swagger", "openapi"] },
];

const KEYWORD_TO_LABELS = new Map();
for (const cat of CATEGORY_MAP) {
  for (const kw of cat.keywords) {
    if (!KEYWORD_TO_LABELS.has(kw)) KEYWORD_TO_LABELS.set(kw, []);
    KEYWORD_TO_LABELS.get(kw).push(cat.label);
  }
}

const CORRECTION_SIGNALS = [
  "fix", "wrong", "not working", "broken", "error", "bug",
  "try again", "revert", "undo", "actually", "instead",
  "doesn't work", "does not work", "failed", "failing",
];

const MAX_SESSIONS_TOTAL = 120;
const MAX_SESSIONS_PER_PROJECT = 15;
const FIRST_PROMPT_MAX = 250;
const TOKEN_SOFT = 20_000;
const TOKEN_HARD = 40_000;
const MIN_SESSIONS_AFTER_TRIM = 20;

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

function filterConversations(conversations, { project, timeRange }) {
  let filtered = conversations;

  if (project) {
    filtered = filtered.filter((c) => c.project === project);
  }

  if (timeRange && timeRange !== "all") {
    const now = Date.now();
    let cutoff;
    if (timeRange === "today" || timeRange === "1d") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (timeRange === "7d") {
      cutoff = now - 7 * 86400000;
    } else if (timeRange === "30d") {
      cutoff = now - 30 * 86400000;
    }

    if (cutoff) {
      filtered = filtered.filter((c) => {
        const t = conversationTimeMs(c);
        if (t == null) return false;
        return t >= cutoff;
      });
    }
  }

  return filtered;
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
}

function matchCategories(text) {
  const tokens = new Set(tokenize(text));
  const matched = new Set();
  for (const token of tokens) {
    const labels = KEYWORD_TO_LABELS.get(token);
    if (labels) {
      for (const label of labels) matched.add(label);
    }
  }
  return matched;
}

function getUserText(conversation) {
  const msgs = conversation.messages || [];
  return msgs
    .filter((m) => m.role === "user")
    .map((m) => m.text || "")
    .join(" ");
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

function lastUserMessageText(c) {
  const msgs = (c.messages || []).filter((m) => m.role === "user");
  if (!msgs.length) return "";
  return msgs[msgs.length - 1].text || "";
}

function lastUserMsgHasCorrectionSignal(c) {
  const t = lastUserMessageText(c).toLowerCase();
  return CORRECTION_SIGNALS.some((sig) => t.includes(sig));
}

function firstUserMessage(c) {
  const m = (c.messages || []).find((m2) => m2.role === "user");
  return m ? m.text || "" : "";
}

function firstAssistantModelId(c) {
  const m = (c.messages || []).find(
    (m2) => m2.role === "assistant" && m2.modelId
  );
  return m ? m.modelId : null;
}

function truncate(s, max) {
  if (!s || s.length <= max) return s;
  return s.slice(0, max);
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
 * @param {{ conversations?: object[] }} parsedData
 * @param {object} mirrorInsights — output of analyze()
 * @param {{ project?: string|null, timeRange?: string }} filter
 */
function buildMentorPromptBundle(parsedData, mirrorInsights, filter = {}) {
  const project = filter.project ?? null;
  const timeRange = filter.timeRange ?? "all";

  const all = parsedData.conversations || [];
  const filtered = filterConversations(all, { project, timeRange });
  const totalFiltered = filtered.length;

  const sorted = [...filtered].sort((a, b) => {
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
  const droppedAfterCap = Math.max(0, picked.length - capped.length);

  function mapRow(c) {
    return {
    id: sessionIdShort(c),
    project: c.project || "Unknown",
    createdAt: c.createdAt || null,
    durationMin: computeSessionSpanMinutes(c),
    userMessages: Number(c.userMessageCount) || 0,
    totalMessages: Number(c.messageCount) || (c.messages?.length ?? 0),
    linesChanged: (Number(c.linesAdded) || 0) + (Number(c.linesRemoved) || 0),
    modelId: firstAssistantModelId(c),
    firstPrompt: truncate(firstUserMessage(c), FIRST_PROMPT_MAX),
    correctionCycles: countFixCycles(c),
    endedOnCorrection: lastUserMsgHasCorrectionSignal(c),
    topFiles: (c.filesReferenced || []).slice(0, 5),
    topTools: dedupeTools(c.toolsUsed).slice(0, 5),
    skills: c.skillsReferenced || [],
    subagents: c.subagentsReferenced || [],
    rules: c.cursorRules || [],
    contextSignals: c.sessionContextSignals || [],
    mirrorCategories: [...matchCategories(getUserText(c))],
    };
  }

  let sessionRows = capped.map(mapRow);

  function buildProjectArcs(sessions) {
    const pmap = new Map();
    for (const c of sessions) {
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
          firstSession: null,
          lastSession: null,
        });
      }
      const a = pmap.get(p);
      a.sessionCount += 1;
      a.sumCorrections += countFixCycles(c);
      a.sumUserMsgs += Number(c.userMessageCount) || 0;
      const span = computeSessionSpanMinutes(c);
      if (span != null) {
        a.sumSpan += span;
        a.spanN += 1;
      }
      if (lastUserMsgHasCorrectionSignal(c)) a.endedCorr += 1;
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
      firstSession: a.firstSession,
      lastSession: a.lastSession,
    }));
  }

  let projectArcs = buildProjectArcs(capped);

  const mirrorBlock = {
    totalSessions: all.length,
    filteredSessions: totalFiltered,
    droppedSessions: droppedAfterCap + Math.max(0, totalFiltered - picked.length),
    projects: [...new Set(filtered.map((c) => c.project || "Unknown"))].sort(),
    mirrorBumps: mirrorInsights.bumps,
    mirrorScopeDrift: mirrorInsights.scopeDrift,
    mirrorWhatWorked: mirrorInsights.whatWorked,
    mirrorPromptHabits: mirrorInsights.promptHabits,
  };

  function assemblePrompt(rows, arcs) {
    return [
      "You are Bumps Mentor, analyzing a single developer's conversation history with Cursor. Your job: identify 3-6 behavioral patterns that are slowing this builder down, diagnose each with session evidence, and suggest mindset-level guidance.",
      "",
      "Constraints:",
      "- Evidence must cite session ids from the data. Never invent sessions.",
      "- Guidance is mindset/process, not code. Never say \"change your code\".",
      "- Tone: direct, specific, grounded. No generic productivity advice.",
      "- Output MUST be valid JSON matching the schema below. No prose outside JSON. No markdown.",
      "- This developer uses an agentic coding tool (Cursor) where planning and execution often happen in the same session. Do not treat linesChanged as evidence of constraint violation or broken intent. A session that discusses approach, architecture, or planning AND has linesChanged is normal agentic workflow — the model plans then immediately executes. Only flag a pattern if the behavioral signal comes from correction cycles, abandonment, or repeated return to the same topic — not from the presence of code changes alongside planning language.",
      "",
      "A pattern requires evidence from at least 3 distinct sessions. A pattern with only 1-2 sessions of evidence is an incident, not a behavioral pattern — either find more evidence or drop the pattern entirely. Prefer patterns that have evidence across multiple projects when possible.",
      "If correctionRate or abandonmentRate is high on a project, that is strong evidence for a friction pattern — cite it explicitly.",
      "Avoid generic advice. A guidance line like 'write more tests' is a fail. A guidance line like 'timebox the auth library decision to one 30-minute session before writing any code' is a pass.",
      "",
      "Schema:",
      "{",
      '  "overallDiagnosis": string,',
      '  "patterns": [{',
      '    "id": string,',
      '    "title": string,',
      '    "severity": "low"|"medium"|"high",',
      '    "diagnosis": string,',
      '    "evidence": [{',
      '      "project": string,',
      '      "sessionIds": [string],',
      '      "summary": string',
      "    }],",
      '    "guidance": string',
      "  }],",
      '  "themes": [{',
      '    "name": string,',
      '    "share": number,',
      '    "sampleSessionIds": [string]',
      "  }],",
      '  "perProject": [{',
      '    "project": string,',
      '    "diagnosis": string,',
      '    "primaryPatternIds": [string]',
      "  }]",
      "}",
      "",
      "Mirror pre-analysis (keyword-driven, use as seed not ground truth):",
      JSON.stringify(mirrorBlock),
      "",
      "Project arcs (cross-session aggregates — use for project-level patterns):",
      JSON.stringify(arcs),
      "",
      "Sessions:",
      JSON.stringify(rows),
      "",
      "Return only the JSON object.",
    ].join("\n");
  }

  let prompt = assemblePrompt(sessionRows, projectArcs);
  let tok = estimateTokens(prompt);

  if (tok > TOKEN_SOFT) {
    console.warn(`[bumps] mentor prompt estimate ${tok} tokens exceeds soft target ${TOKEN_SOFT}`);
  }

  while (tok > TOKEN_HARD && capped.length > MIN_SESSIONS_AFTER_TRIM) {
    capped = capped.slice(0, Math.max(MIN_SESSIONS_AFTER_TRIM, capped.length - 10));
    sessionRows = capped.map(mapRow);
    projectArcs = buildProjectArcs(capped);
    prompt = assemblePrompt(sessionRows, projectArcs);
    tok = estimateTokens(prompt);
  }

  const knownSessionIds = new Set(capped.map(sessionIdShort));
  const knownProjects = new Set(capped.map((c) => c.project || "Unknown"));

  return { prompt, knownSessionIds, knownProjects, projectArcs };
}

function buildMentorPrompt(parsedData, mirrorInsights, filter) {
  return buildMentorPromptBundle(parsedData, mirrorInsights, filter).prompt;
}

function estimateTokens(s) {
  return Math.ceil(String(s).length / 4);
}

module.exports = {
  buildMentorPrompt,
  buildMentorPromptBundle,
  estimateTokens,
  filterConversations,
  sessionIdShort,
};
