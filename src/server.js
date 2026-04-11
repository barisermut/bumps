const express = require("express");
const path = require("path");
const { performance } = require("node:perf_hooks");
const { parse } = require("./parser");
const { analyze } = require("./analyzer");
const { defaultDashboardPath } = require("./paths");

/** Matches dashboard FilterBar + analyzer `filterConversations` (CLI may pass 1d). */
const ALLOWED_TIME_RANGES = new Set(["all", "today", "1d", "7d", "30d"]);
const MAX_PROJECT_QUERY_LEN = 500;

const GENERIC_SERVER_ERROR = { error: "Something went wrong. Try again." };
const GENERIC_BAD_REQUEST = { error: "Invalid query parameters." };

function parseInsightsQuery(query) {
  const projectRaw = query.project;
  const timeRangeRaw = query.timeRange;

  let project;
  if (projectRaw != null && String(projectRaw).length > 0) {
    const p = String(projectRaw);
    if (p.length > MAX_PROJECT_QUERY_LEN) return { ok: false };
    project = p;
  }

  let timeRange = "all";
  if (timeRangeRaw != null && String(timeRangeRaw).length > 0) {
    const t = String(timeRangeRaw);
    if (!ALLOWED_TIME_RANGES.has(t)) return { ok: false };
    timeRange = t;
  }

  return { ok: true, project, timeRange };
}

/**
 * @param {object} parsedData result of parse()
 * @param {{ dashboardPath?: string }} [options]
 */
function createApp(parsedData, options = {}) {
  const dashboardPath = options.dashboardPath ?? defaultDashboardPath();
  const app = express();

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "connect-src 'self'",
      ].join("; ")
    );
    next();
  });

  app.get("/api/projects", (req, res) => {
    try {
      res.json({ projects: parsedData.projects });
    } catch (err) {
      console.error("[bumps] /api/projects", err);
      res.status(500).json(GENERIC_SERVER_ERROR);
    }
  });

  app.get("/api/insights", (req, res) => {
    const parsed = parseInsightsQuery(req.query);
    if (!parsed.ok) {
      return res.status(400).json(GENERIC_BAD_REQUEST);
    }
    try {
      const insights = analyze(parsedData, {
        project: parsed.project,
        timeRange: parsed.timeRange,
      });
      res.json(insights);
    } catch (err) {
      console.error("[bumps] /api/insights", err);
      res.status(500).json(GENERIC_SERVER_ERROR);
    }
  });

  app.use(express.static(dashboardPath));
  return app;
}

/**
 * @param {{
 *   parsedData: object;
 *   port?: number;
 *   dashboardPath?: string;
 *   onListening?: () => void;
 *   logListenMessage?: boolean;
 *   onListenError?: (err: NodeJS.ErrnoException) => void;
 * }} options
 */
function startServer(options) {
  const {
    parsedData,
    port = 3456,
    dashboardPath = defaultDashboardPath(),
    onListening,
    logListenMessage = true,
    onListenError,
  } = options;

  const app = createApp(parsedData, { dashboardPath });
  // Loopback IPv4 only; we do not bind ::1, so use http://127.0.0.1 if `localhost` resolves to IPv6 first.
  const LISTEN_HOST = "127.0.0.1";
  const server = app.listen(port, LISTEN_HOST, () => {
    if (logListenMessage) {
      console.log(`Bumps server running at http://127.0.0.1:${port}`);
    }
    onListening?.();
  });

  server.on("error", (err) => {
    if (onListenError) {
      onListenError(err);
      return;
    }
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Try a different port, e.g. --port=${port + 1}`
      );
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });

  return server;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const portFlag = args.find((a) => a.startsWith("--port="));
  const PORT = portFlag ? Number(portFlag.split("=")[1]) : 3456;

  console.log("Parsing Cursor conversation data...");
  const parseStarted = performance.now();
  const parsedData = parse();
  const parseMs = Math.round(performance.now() - parseStarted);
  console.log(
    `Parsed in ${parseMs} ms — ${parsedData.totalConversations} conversations across ${parsedData.projects.length} projects.`
  );
  startServer({ parsedData, port: PORT });
}

module.exports = {
  createApp,
  startServer,
  defaultDashboardPath,
};
