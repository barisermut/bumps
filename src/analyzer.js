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

// Build a reverse lookup: keyword -> array of category labels
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

// --- Helpers ---

/** Epoch ms from createdAt, else lastUpdatedAt — for time-range filters */
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

/**
 * Return the dominant categories for a text — ranked by keyword hit count,
 * filtered to only those with enough signal to be considered a real topic.
 * Returns at most `maxTopics` categories, each with at least `minHits` keyword hits.
 */
function dominantCategories(text, { maxTopics = 3, minHits = 2 } = {}) {
  const tokens = tokenize(text);
  const counts = new Map();
  for (const token of tokens) {
    const labels = KEYWORD_TO_LABELS.get(token);
    if (labels) {
      for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([label]) => label);
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

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Effort score: min–max normalized blend of prevalence, avg user messages,
 * avg session span, avg lines changed. Degenerate signals are dropped and
 * weights renormalized; if all degenerate, fall back to prevalence-only.
 */
function attachEffortScores(rows) {
  const fields = [
    { key: "count", w: 0.4 },
    { key: "avgUserMessages", w: 0.3 },
    { key: "avgSessionSpanMinutes", w: 0.2 },
    { key: "avgLinesChanged", w: 0.1 },
  ];

  const active = [];
  for (const { key, w } of fields) {
    const vals = rows.map((r) => r[key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max !== min) active.push({ key, w, min, max });
  }

  if (active.length === 0) {
    const counts = rows.map((r) => r.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (max !== min) {
      for (const row of rows) {
        row.effortScore = Math.round(((row.count - min) / (max - min)) * 1000) / 1000;
      }
      return rows;
    }
    for (const row of rows) {
      row.effortScore = 0;
    }
    return rows;
  }

  const wSum = active.reduce((s, f) => s + f.w, 0);
  for (const row of rows) {
    let score = 0;
    for (const { key, w, min, max } of active) {
      const norm = (row[key] - min) / (max - min);
      score += (w / wSum) * norm;
    }
    row.effortScore = Math.round(score * 1000) / 1000;
  }
  return rows;
}

// --- Section Computers ---

function computeBumps(conversations) {
  const acc = new Map();
  const total = conversations.length;

  for (const c of conversations) {
    const categories = matchCategories(getUserText(c));
    const userMessages = Number(c.userMessageCount) || 0;
    const messageCount =
      Number(c.messageCount) || (c.messages?.length ?? 0);
    const spanMin = computeSessionSpanMinutes(c);
    const linesChanged =
      (Number(c.linesAdded) || 0) + (Number(c.linesRemoved) || 0);

    for (const label of categories) {
      if (!acc.has(label)) {
        acc.set(label, {
          count: 0,
          sumUser: 0,
          sumMsg: 0,
          sumSpan: 0,
          spanN: 0,
          sumLines: 0,
        });
      }
      const a = acc.get(label);
      a.count += 1;
      a.sumUser += userMessages;
      a.sumMsg += messageCount;
      if (spanMin != null) {
        a.sumSpan += spanMin;
        a.spanN += 1;
      }
      a.sumLines += linesChanged;
    }
  }

  const rows = [...acc.entries()].map(([topic, a]) => {
    const count = a.count;
    const avgUserMessages = count ? round1(a.sumUser / count) : 0;
    const avgMessages = count ? round1(a.sumMsg / count) : 0;
    const avgSessionSpanMinutes = a.spanN ? round1(a.sumSpan / a.spanN) : 0;
    const avgLinesChanged = count ? round1(a.sumLines / count) : 0;
    const percentage =
      total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    return {
      topic,
      count,
      percentage,
      avgUserMessages,
      avgMessages,
      avgSessionSpanMinutes,
      avgLinesChanged,
      effortScore: 0,
    };
  });

  attachEffortScores(rows);
  rows.sort((a, b) => {
    if (b.effortScore !== a.effortScore) return b.effortScore - a.effortScore;
    if (b.count !== a.count) return b.count - a.count;
    return a.topic.localeCompare(b.topic);
  });

  return rows.slice(0, 10);
}

function computeBiggestBump(bumps) {
  if (bumps.length === 0) return "Not enough data to identify patterns yet.";
  const top = bumps[0];
  return `${top.topic} — came up in ${top.count} sessions, averaging ${top.avgUserMessages} messages each.`;
}

function computeChangeVolume(conversations) {
  if (!conversations.length) {
    return {
      totalLinesChanged: 0,
      avgLinesPerSession: 0,
      sessionsWithChanges: 0,
      heaviestSession: null,
    };
  }

  let totalLinesChanged = 0;
  let sessionsWithChanges = 0;
  let heaviestSession = null;

  for (const c of conversations) {
    const linesChanged =
      (Number(c.linesAdded) || 0) + (Number(c.linesRemoved) || 0);
    totalLinesChanged += linesChanged;
    if (linesChanged > 0) {
      sessionsWithChanges += 1;
      if (
        !heaviestSession ||
        linesChanged > heaviestSession.linesChanged
      ) {
        heaviestSession = {
          project: c.project || "Unknown",
          linesChanged,
        };
      }
    }
  }

  const avgLinesPerSession = round1(totalLinesChanged / conversations.length);

  return {
    totalLinesChanged,
    avgLinesPerSession,
    sessionsWithChanges,
    heaviestSession: totalLinesChanged === 0 ? null : heaviestSession,
  };
}

function topTokensBySessionPrevalence(counts, limit = 5) {
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function computeContextRichness(conversations) {
  if (!conversations.length) {
    return {
      sessionsWithSkills: 0,
      sessionsWithSubagents: 0,
      sessionsWithFileContext: 0,
      topSkills: [],
      topContextSignals: [],
    };
  }

  let sessionsWithSkills = 0;
  let sessionsWithSubagents = 0;
  let sessionsWithFileContext = 0;
  const skillCounts = new Map();
  const signalCounts = new Map();

  for (const c of conversations) {
    const skills = c.skillsReferenced || [];
    const subagents = c.subagentsReferenced || [];
    const files = c.filesReferenced || [];
    const signals = c.sessionContextSignals || [];

    if (skills.length) sessionsWithSkills += 1;
    if (subagents.length) sessionsWithSubagents += 1;
    if (files.length) sessionsWithFileContext += 1;

    for (const s of skills) {
      skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
    }
    for (const s of signals) {
      signalCounts.set(s, (signalCounts.get(s) || 0) + 1);
    }
  }

  return {
    sessionsWithSkills,
    sessionsWithSubagents,
    sessionsWithFileContext,
    topSkills: topTokensBySessionPrevalence(skillCounts),
    topContextSignals: topTokensBySessionPrevalence(signalCounts),
  };
}

function computeScopeDrift(conversations) {
  const byProject = new Map();
  for (const c of conversations) {
    const proj = c.project || "Unknown";
    if (!byProject.has(proj)) byProject.set(proj, []);
    byProject.get(proj).push(c);
  }

  const result = [];

  for (const [project, convos] of byProject) {
    // Sort chronologically
    const sorted = [...convos].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return da - db;
    });

    const seen = new Set();
    const timeline = [];

    for (const c of sorted) {
      const dominant = dominantCategories(getUserText(c));
      for (const label of dominant) {
        if (!seen.has(label)) {
          seen.add(label);
          timeline.push({
            date: c.createdAt || null,
            concept: label,
          });
        }
      }
    }

    if (timeline.length > 0) {
      result.push({ project, timeline });
    }
  }

  return result;
}

function computePromptHabits(conversations) {
  const buckets = { short: [], long: [] };

  for (const c of conversations) {
    const firstUser = (c.messages || []).find((m) => m.role === "user");
    if (!firstUser) continue;

    const len = (firstUser.text || "").length;
    const bucket = len < 200 ? "short" : "long";
    buckets[bucket].push(c);
  }

  function stats(convos) {
    if (convos.length === 0) return { avgMessages: 0, avgResolution: 0 };
    const totalMsg = convos.reduce((s, c) => s + c.userMessageCount, 0);
    const totalRes = convos.reduce((s, c) => s + Math.max(0, c.userMessageCount - 1), 0);
    return {
      avgMessages: Math.round((totalMsg / convos.length) * 10) / 10,
      avgResolution: Math.round((totalRes / convos.length) * 10) / 10,
    };
  }

  return {
    short: stats(buckets.short),
    long: stats(buckets.long),
  };
}

/**
 * Extract MCP server name from a tool call name.
 * Tool names follow patterns like:
 *   "mcp-context7-resolve-library-id" → "context7"
 *   "mcp-neon-plugin-neon-postgres-neon-run_sql" → "neon"
 *   "mcp-aidesigner-generate_design" → "aidesigner"
 */
function extractMcpServer(toolName) {
  if (!toolName || !toolName.startsWith("mcp-")) return null;
  const rest = toolName.slice(4); // strip "mcp-"
  if (!rest || rest === "-") return null;
  // The server name is the first segment before the next dash
  // but we need to handle compound names — take until we hit a known action verb or plugin marker
  const match = rest.match(/^([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function findMostUsedMcps(conversations) {
  const mcpCounts = new Map();

  for (const c of conversations) {
    const mcps = new Set();
    // Source 1: mcpDescriptors field on messages
    for (const m of c.messages || []) {
      for (const mcp of m.mcpDescriptors || []) mcps.add(mcp);
    }
    // Source 2: tool calls with mcp- prefix
    for (const m of c.messages || []) {
      if (m.toolName && m.toolName.startsWith("mcp-")) {
        const server = extractMcpServer(m.toolName);
        if (server) mcps.add(server);
      }
      for (const tc of m.toolCallsDetailed || []) {
        if (tc.name && tc.name.startsWith("mcp-")) {
          const server = extractMcpServer(tc.name);
          if (server) mcps.add(server);
        }
      }
    }
    // Also check conversation-level toolsUsed
    for (const t of c.toolsUsed || []) {
      if (t.startsWith("mcp-")) {
        const server = extractMcpServer(t);
        if (server) mcps.add(server);
      }
    }
    for (const mcp of mcps) {
      mcpCounts.set(mcp, (mcpCounts.get(mcp) || 0) + 1);
    }
  }

  return [...mcpCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} — used in ${count} sessions`);
}

function computeWhatWorked(conversations) {
  return {
    fastPromptPatterns: findFastPatterns(conversations),
    cleanDomains: findCleanDomains(conversations),
    activeTools: findActiveTools(conversations),
    mcpServers: findMostUsedMcps(conversations),
  };
}

function classifyPrompt(text) {
  const traits = [];
  const len = text.length;
  if (len < 200) traits.push("Short");
  else if (len < 800) traits.push("Medium");
  else traits.push("Long");

  if (/```/.test(text)) traits.push("with code blocks");
  if (/^(create|fix|add|update|build|implement|refactor|write|make|change|remove|delete|set up|configure)\b/i.test(text.trim())) {
    traits.push("imperative");
  }
  if (/\?/.test(text)) traits.push("question");
  if (/\/[\w.-]+\.\w{1,5}/.test(text) || /\.\w{1,4}\b/.test(text)) {
    traits.push("with file refs");
  }

  return traits.join(" ");
}

function resolution(c) {
  return Math.max(0, c.userMessageCount - 1);
}

function findFastPatterns(conversations) {
  const groups = new Map();

  for (const c of conversations) {
    const firstUser = (c.messages || []).find((m) => m.role === "user");
    if (!firstUser || !firstUser.text) continue;

    const pattern = classifyPrompt(firstUser.text);
    if (!groups.has(pattern)) groups.set(pattern, []);
    groups.get(pattern).push(c);
  }

  // Require at least 2 conversations per pattern for meaningful stats
  const ranked = [...groups.entries()]
    .filter(([, convos]) => convos.length >= 2)
    .map(([pattern, convos]) => {
      const avgRes = convos.reduce((s, c) => s + resolution(c), 0) / convos.length;
      return { pattern, avgRes: Math.round(avgRes * 10) / 10, count: convos.length };
    })
    .sort((a, b) => a.avgRes - b.avgRes)
    .slice(0, 3);

  return ranked.map((r) => `${r.pattern} prompts (avg ${r.avgRes} follow-ups, ${r.count} sessions)`);
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

function findCleanDomains(conversations) {
  const extGroups = new Map();

  for (const c of conversations) {
    const exts = new Set();
    for (const f of c.filesReferenced || []) {
      const match = f.match(/\.(\w{1,6})$/);
      if (match) exts.add(match[1].toLowerCase());
    }
    const fixes = countFixCycles(c);
    for (const ext of exts) {
      if (!extGroups.has(ext)) extGroups.set(ext, []);
      extGroups.get(ext).push(fixes);
    }
  }

  const CODE_EXTS = new Set([
    "ts", "tsx", "js", "jsx", "py", "css", "scss", "vue", "svelte", "go", "rs", "rb", "php",
  ]);

  const EXT_LABELS = {
    js: "JavaScript", ts: "TypeScript", tsx: "TypeScript React", jsx: "React JSX",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", php: "PHP",
    css: "CSS", scss: "SCSS", vue: "Vue", svelte: "Svelte",
  };

  const ranked = [...extGroups.entries()]
    .filter(([ext, fixes]) => CODE_EXTS.has(ext) && fixes.length >= 3)
    .map(([ext, fixes]) => {
      const avg = fixes.reduce((s, v) => s + v, 0) / fixes.length;
      const label = EXT_LABELS[ext] || `.${ext}`;
      return { label, ext, avg: Math.round(avg * 10) / 10, count: fixes.length };
    })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);

  return ranked.map((r) => `${r.label} (.${r.ext}) — avg ${r.avg} fix cycles across ${r.count} sessions`);
}

function findActiveTools(conversations) {
  const toolStats = new Map();

  for (const c of conversations) {
    const res = resolution(c);
    const items = [
      ...(c.toolsUsed || []).map((t) => `tool: ${t}`),
      ...(c.cursorRules || []).map((r) => `rule: ${r}`),
      ...(c.skillsReferenced || []).map((s) => `skill: ${s}`),
      ...(c.subagentsReferenced || []).map((s) => `subagent: ${s}`),
      ...(c.sessionContextSignals || []).map((s) => `context: ${s}`),
    ];
    // Also collect mcpDescriptors from individual messages
    const mcps = new Set();
    for (const m of c.messages || []) {
      for (const mcp of m.mcpDescriptors || []) mcps.add(mcp);
    }
    for (const mcp of mcps) items.push(`mcp: ${mcp}`);

    for (const item of items) {
      if (!toolStats.has(item)) toolStats.set(item, { totalRes: 0, count: 0 });
      const stat = toolStats.get(item);
      stat.totalRes += res;
      stat.count++;
    }
  }

  const ranked = [...toolStats.entries()]
    .filter(([, s]) => s.count >= 2)
    .map(([name, s]) => ({
      name,
      avgRes: Math.round((s.totalRes / s.count) * 10) / 10,
      count: s.count,
    }))
    .sort((a, b) => a.avgRes - b.avgRes)
    .slice(0, 5);

  return ranked.map((r) => {
    const [, kind, rawName] =
      r.name.match(/^(tool|rule|skill|subagent|context):\s*(.+)$/) || [];
    const name = rawName || r.name;
    const label =
      kind === "rule"
        ? `rule ${name}`
        : kind === "skill"
          ? `skill ${name}`
          : kind === "subagent"
            ? `${name} subagents`
            : kind === "context"
              ? name.replace(/-/g, " ")
              : name;
    return `${label} — avg ${r.avgRes} follow-ups across ${r.count} sessions`;
  });
}

function computeInsightsMeta(parsedData, conversations) {
  const meta = {
    totalConversationCount: parsedData.conversations?.length || 0,
    filteredConversationCount: conversations.length,
    parser: parsedData.parserMeta || null,
    sourceCoverage: {
      withWorkspace: 0,
      withAgentStore: 0,
      withAgentTranscript: 0,
      multiSource: 0,
    },
    completeness: {
      withFiles: 0,
      withTools: 0,
      withModels: 0,
      withTranscriptSignals: 0,
    },
    trustNote: null,
  };

  for (const c of conversations) {
    if (c.sourceCoverage?.workspace) meta.sourceCoverage.withWorkspace++;
    if (c.sourceCoverage?.agentStore) meta.sourceCoverage.withAgentStore++;
    if (c.sourceCoverage?.agentTranscript) {
      meta.sourceCoverage.withAgentTranscript++;
    }
    if ((c.sourceCoverage?.sourceCount || 0) > 1) meta.sourceCoverage.multiSource++;

    if (c.completenessFlags?.hasFiles) meta.completeness.withFiles++;
    if (c.completenessFlags?.hasTools) meta.completeness.withTools++;
    if (c.completenessFlags?.hasModels) meta.completeness.withModels++;
    if (c.completenessFlags?.hasTranscriptSignals) {
      meta.completeness.withTranscriptSignals++;
    }
  }

  if (meta.filteredConversationCount === 0) {
    meta.trustNote = null;
  } else if (meta.sourceCoverage.multiSource > 0) {
    meta.trustNote = `Merged transcript or agent context into ${meta.sourceCoverage.multiSource} sessions in this view.`;
  } else if (meta.sourceCoverage.withAgentTranscript > 0) {
    meta.trustNote = `This view includes transcript-only context in ${meta.sourceCoverage.withAgentTranscript} sessions.`;
  } else {
    meta.trustNote = "Built from the session data Cursor kept for this range.";
  }

  return meta;
}

const MODEL_DISPLAY_NAMES = {
  // Claude models
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-opus-4-5": "Claude Opus 4.5",
  "claude-sonnet-4-5-20250514": "Claude Sonnet 4.5",
  "claude-3.5-sonnet": "Claude 3.5 Sonnet",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-4.6-opus-high-thinking": "Claude Opus 4.6",
  // OpenAI models
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4": "GPT-4",
  "gpt-4-turbo": "GPT-4 Turbo",
  "o1": "o1",
  "o1-mini": "o1 Mini",
  "o1-preview": "o1 Preview",
  "o3-mini": "o3 Mini",
  // Google / other
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "deepseek-v3": "DeepSeek V3",
  // Cursor built-in models
  "cursor-small": "Cursor Small",
  "composer-1.5": "Composer 1.5",
  "composer-2": "Composer 2",
  "composer-2-fast": "Composer 2 Fast",
};

function cleanModelName(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  // Skip non-informative values
  if (key === "default" || key === "unknown") return null;
  if (MODEL_DISPLAY_NAMES[key]) return MODEL_DISPLAY_NAMES[key];
  // Strip common provider prefixes
  let name = raw.replace(/^(anthropic|openai|google|deepseek)[\/\-]/i, "");
  // Capitalize segments
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function computeModelPerformance(conversations) {
  // For each conversation, find the model used (from first assistant message with a modelId)
  const modelSessions = new Map(); // model -> [followUpCounts]

  for (const c of conversations) {
    const firstAssistant = (c.messages || []).find(
      (m) => m.role === "assistant" && m.modelId
    );
    if (!firstAssistant || !firstAssistant.modelId) continue;

    const model = cleanModelName(firstAssistant.modelId);
    if (!model) continue;

    const followUps = Math.max(0, c.userMessageCount - 1);
    if (!modelSessions.has(model)) modelSessions.set(model, []);
    modelSessions.get(model).push(followUps);
  }

  return [...modelSessions.entries()]
    .map(([model, sessions]) => ({
      model,
      avgFollowUps: Math.round((sessions.reduce((s, v) => s + v, 0) / sessions.length) * 10) / 10,
      sessionCount: sessions.length,
      lowConfidence: sessions.length < 3,
    }))
    .sort((a, b) => a.avgFollowUps - b.avgFollowUps);
}

// --- Main ---

function emptyInsights() {
  return {
    biggestBump: "Not enough data to identify patterns yet.",
    bumps: [],
    scopeDrift: [],
    promptHabits: {
      short: { avgMessages: 0, avgResolution: 0 },
      long: { avgMessages: 0, avgResolution: 0 },
    },
    whatWorked: {
      fastPromptPatterns: [],
      cleanDomains: [],
      activeTools: [],
      mcpServers: [],
    },
    modelPerformance: [],
    changeVolume: {
      totalLinesChanged: 0,
      avgLinesPerSession: 0,
      sessionsWithChanges: 0,
      heaviestSession: null,
    },
    contextRichness: {
      sessionsWithSkills: 0,
      sessionsWithSubagents: 0,
      sessionsWithFileContext: 0,
      topSkills: [],
      topContextSignals: [],
    },
    meta: {
      totalConversationCount: 0,
      filteredConversationCount: 0,
      parser: null,
      sourceCoverage: {
        withWorkspace: 0,
        withAgentStore: 0,
        withAgentTranscript: 0,
        multiSource: 0,
      },
      completeness: {
        withFiles: 0,
        withTools: 0,
        withModels: 0,
        withTranscriptSignals: 0,
      },
      trustNote: null,
    },
  };
}

function analyze(parsedData, options = {}) {
  try {
    const { project = null, timeRange = "all" } = options;

    const conversations = filterConversations(parsedData.conversations || [], {
      project,
      timeRange,
    });

    if (conversations.length === 0) {
      const out = emptyInsights();
      out.meta.totalConversationCount = parsedData.conversations?.length || 0;
      out.meta.parser = parsedData.parserMeta || null;
      return out;
    }

    const bumps = computeBumps(conversations);
    const biggestBump = computeBiggestBump(bumps);
    const scopeDrift = computeScopeDrift(conversations);
    const promptHabits = computePromptHabits(conversations);
    const whatWorked = computeWhatWorked(conversations);
    const modelPerformance = computeModelPerformance(conversations);
    const changeVolume = computeChangeVolume(conversations);
    const contextRichness = computeContextRichness(conversations);
    const meta = computeInsightsMeta(parsedData, conversations);

    return {
      biggestBump,
      bumps,
      scopeDrift,
      promptHabits,
      whatWorked,
      modelPerformance,
      changeVolume,
      contextRichness,
      meta,
    };
  } catch (err) {
    console.error("[bumps] analyze failed:", err);
    return emptyInsights();
  }
}

module.exports = { analyze };

// When run directly, parse and analyze
if (require.main === module) {
  const parser = require("./parser");

  // Simple CLI arg parsing: --project=X --timeRange=Y
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) options[match[1]] = match[2];
  }

  const data = parser.parse();
  const result = analyze(data, options);
  console.log(JSON.stringify(result, null, 2));
}
