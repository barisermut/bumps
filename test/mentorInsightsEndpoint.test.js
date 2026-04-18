const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mentorAgent = require("../src/lib/mentorAgent");
const { createApp } = require("../src/server");
const { __resetStateForTests } = require("../src/lib/mentorInsights");

const STATIC_FIXTURE = path.join(__dirname, "fixtures", "server-static");

function session(id, project) {
  return {
    composerId: id,
    project,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    userMessageCount: 2,
    messageCount: 3,
    messages: [
      { role: "user", text: "hello" },
      { role: "assistant", text: "ok", modelId: "gpt-4o" },
      { role: "user", text: "wrong fix" },
    ],
    filesReferenced: [],
    toolsUsed: [],
    cursorRules: [],
    skillsReferenced: [],
    subagentsReferenced: [],
    sessionContextSignals: [],
    linesAdded: 0,
    linesRemoved: 0,
  };
}

const PARSED = {
  projects: ["p1", "p2", "p3"],
  conversations: [
    ...[1, 2, 3].map((i) => session(`p1-${i}`, "p1")),
    ...[1, 2, 3].map((i) => session(`p2-${i}`, "p2")),
    ...[1, 2, 3].map((i) => session(`p3-${i}`, "p3")),
  ],
  totalConversations: 9,
  parserMeta: {},
};

const VALID_MENTOR_JSON = {
  insights: [
    {
      id: "p1",
      title: "Test insight",
      severity: "medium",
      diagnosis: "You tend to iterate across several codebases.",
      guidance: "Try batching similar fixes into one focused session.",
      projects: ["p1", "p2", "p3"],
      sessionCount: 3,
    },
  ],
  themes: [{ name: "Auth work", share: 0.4 }],
  topPatterns: [{ name: "Scope drift", percentage: 35 }],
  toolsAndMcps: [{ name: "read file", sessionCount: 2 }],
  perProject: [
    {
      project: "p1",
      sessions: 3,
      messages: 9,
      avgTimeMinutes: 12,
      frustrationPercent: 15,
    },
  ],
};

describe("/api/mentor-insights", () => {
  let tmpCache;

  beforeEach(() => {
    tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-mentor-api-"));
    process.env.BUMPS_MENTOR_CACHE_DIR = tmpCache;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetStateForTests();
    delete process.env.BUMPS_MENTOR_CACHE_DIR;
    fs.rmSync(tmpCache, { recursive: true, force: true });
  });

  it("returns mentor_disabled when mentorEnabled is false", async () => {
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: false,
    });
    const res = await request(app).get("/api/mentor-insights").expect(200);
    expect(res.body.status).toBe("error");
    expect(res.body.reason).toBe("mentor_disabled");
    expect(res.body.stats).toBeTruthy();
  });

  it("first response is computing then ready when agent succeeds", async () => {
    vi.spyOn(mentorAgent, "runMentorAgent").mockResolvedValue({
      ok: true,
      json: VALID_MENTOR_JSON,
      tokens: {
        promptEstimate: 100,
        responseEstimate: 50,
        agentUsage: {},
      },
      durationMs: 10,
    });
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: true,
    });
    const res1 = await request(app).get("/api/mentor-insights").expect(200);
    expect(res1.body.status).toBe("computing");
    expect(res1.body.stats.totalSessions).toBe(9);
    expect(res1.body.mentor).toBeUndefined();

    await vi.waitFor(
      async () => {
        const r = await request(app).get("/api/mentor-insights");
        expect(r.body.status).toBe("ready");
      },
      { timeout: 5000, interval: 50 }
    );

    const res2 = await request(app).get("/api/mentor-insights").expect(200);
    expect(res2.body.status).toBe("ready");
    expect(res2.body.mentor.insights[0].title).toBe("Test insight");
    expect(mentorAgent.runMentorAgent).toHaveBeenCalledTimes(1);
  });

  it("returns error when agent returns stream_timeout_30s", async () => {
    vi.spyOn(mentorAgent, "runMentorAgent").mockResolvedValue({
      ok: false,
      reason: "stream_timeout_30s",
      durationMs: 30_000,
    });
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: true,
    });
    await request(app).get("/api/mentor-insights").expect(200);
    await new Promise((r) => setTimeout(r, 150));
    const res2 = await request(app).get("/api/mentor-insights").expect(200);
    expect(res2.body.status).toBe("error");
    expect(res2.body.reason).toBe("stream_timeout_30s");
  });

  it("second cold request does not spawn second agent (cache hit)", async () => {
    vi.spyOn(mentorAgent, "runMentorAgent").mockResolvedValue({
      ok: true,
      json: VALID_MENTOR_JSON,
      tokens: { promptEstimate: 1, responseEstimate: 1, agentUsage: {} },
      durationMs: 1,
    });
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: true,
    });
    await request(app).get("/api/mentor-insights");
    await vi.waitFor(
      async () => {
        const r = await request(app).get("/api/mentor-insights");
        expect(r.body.status).toBe("ready");
      },
      { timeout: 5000 }
    );
    await request(app).get("/api/mentor-insights");
    expect(mentorAgent.runMentorAgent).toHaveBeenCalledTimes(1);
  });
});
