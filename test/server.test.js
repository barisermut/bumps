const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { createApp, startServer } = require("../src/server");

const STATIC_FIXTURE = path.join(__dirname, "fixtures", "server-static");

const MINIMAL_PARSED = {
  projects: ["p1"],
  conversations: [],
  totalConversations: 0,
  parserMeta: {
    sourceSummary: {},
    mergeSummary: {},
  },
};

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("startServer (production-style)", () => {
  it("listens on 127.0.0.1 only (not all interfaces)", async () => {
    await new Promise((resolve, reject) => {
      const server = startServer({
        parsedData: MINIMAL_PARSED,
        port: 0,
        dashboardPath: STATIC_FIXTURE,
        logListenMessage: false,
        onListening: async () => {
          try {
            const addr = server.address();
            expect(addr).toBeTruthy();
            expect(addr.address).toBe("127.0.0.1");
            expect(addr.family).toBe("IPv4");
            expect(addr.port).toBeGreaterThan(0);
            await closeServer(server);
            resolve();
          } catch (e) {
            await closeServer(server).catch(() => {});
            reject(e);
          }
        },
        onListenError: (err) => {
          reject(err);
        },
      });
    });
  });
});

describe("createApp API", () => {
  it("sets a CSP compatible with a self-hosted app shell", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-static-"));
    fs.writeFileSync(
      path.join(tmpDir, "index.html"),
      "<!doctype html><html><body><div id='root'></div></body></html>",
      "utf8"
    );
    const app = createApp(MINIMAL_PARSED, { dashboardPath: tmpDir });
    const res = await request(app).get("/").expect(200);

    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("style-src 'self' 'unsafe-inline'");
    expect(res.headers["content-security-policy"]).toContain("font-src 'self'");
    expect(res.text).not.toContain("fonts.googleapis.com");
    expect(res.text).not.toContain("fonts.gstatic.com");
  });

  it("/api/projects returns 500 with generic body when handler throws; no leak of err.message", async () => {
    const parsedData = {};
    Object.defineProperty(parsedData, "projects", {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error("INTERNAL_SECRET_DO_NOT_EXPOSE");
      },
    });

    const app = createApp(parsedData, { dashboardPath: STATIC_FIXTURE });
    const res = await request(app).get("/api/projects").expect(500);

    expect(res.body).toEqual({
      error: "Something went wrong. Try again.",
    });
    expect(res.text).not.toContain("INTERNAL_SECRET");
    expect(res.text.toLowerCase()).not.toContain("stack");
  });

  it("/api/insights returns 500 with generic body when analyze throws; no leak of err.message", async () => {
    const analyzerPath = require.resolve("../src/analyzer");
    const serverPath = require.resolve("../src/server");
    const originalAnalyzer = require.cache[analyzerPath];
    const originalServer = require.cache[serverPath];

    delete require.cache[serverPath];
    delete require.cache[analyzerPath];
    require.cache[analyzerPath] = {
      id: analyzerPath,
      path: analyzerPath,
      filename: analyzerPath,
      loaded: true,
      exports: {
        analyze() {
          throw new Error("DB_PASSWORD_leaked_here");
        },
      },
    };

    try {
      const { createApp: createAppWithThrowingAnalyze } = require("../src/server");
      const app = createAppWithThrowingAnalyze(MINIMAL_PARSED, {
        dashboardPath: STATIC_FIXTURE,
      });
      const res = await request(app).get("/api/insights").expect(500);

      expect(res.body).toEqual({
        error: "Something went wrong. Try again.",
      });
      expect(res.text).not.toContain("DB_PASSWORD");
      expect(res.text.toLowerCase()).not.toContain("stack");
    } finally {
      if (originalAnalyzer) require.cache[analyzerPath] = originalAnalyzer;
      else delete require.cache[analyzerPath];
      if (originalServer) require.cache[serverPath] = originalServer;
      else delete require.cache[serverPath];
    }
  });

  it("/api/insights returns 400 for invalid timeRange", async () => {
    const app = createApp(MINIMAL_PARSED, { dashboardPath: STATIC_FIXTURE });
    const res = await request(app)
      .get("/api/insights")
      .query({ timeRange: "not-a-valid-range" })
      .expect(400);

    expect(res.body).toEqual({ error: "Invalid query parameters." });
  });

  it("/api/insights returns 400 when project query exceeds max length", async () => {
    const app = createApp(MINIMAL_PARSED, { dashboardPath: STATIC_FIXTURE });
    const res = await request(app)
      .get("/api/insights")
      .query({ project: "x".repeat(501) })
      .expect(400);

    expect(res.body).toEqual({ error: "Invalid query parameters." });
  });

  it("/api/insights returns 200 and JSON when query is valid and analyze succeeds", async () => {
    const app = createApp(MINIMAL_PARSED, { dashboardPath: STATIC_FIXTURE });
    const res = await request(app)
      .get("/api/insights")
      .query({ timeRange: "7d", project: "p1" })
      .expect(200);

    expect(res.body).toMatchObject({
      biggestBump: expect.any(String),
      bumps: expect.any(Array),
      meta: {
        filteredConversationCount: expect.any(Number),
      },
    });
    expect(res.body.error).toBeUndefined();
  });
});
