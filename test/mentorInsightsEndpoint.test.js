const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mentorAgent = require("../src/lib/mentorAgent");
const { createApp } = require("../src/server");

const STATIC_FIXTURE = path.join(__dirname, "fixtures", "server-static");

const PARSED = {
  projects: ["p1"],
  conversations: [
    {
      composerId: "abc12345-extra",
      project: "p1",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      userMessageCount: 1,
      messageCount: 2,
      messages: [
        { role: "user", text: "hello auth login" },
        { role: "assistant", text: "ok", modelId: "gpt-4o" },
      ],
      filesReferenced: [],
      toolsUsed: [],
      cursorRules: [],
      skillsReferenced: [],
      subagentsReferenced: [],
      sessionContextSignals: [],
    },
  ],
  totalConversations: 1,
  parserMeta: {},
};

const VALID_MENTOR_JSON = {
  overallDiagnosis: "You iterate a lot.",
  patterns: [
    {
      id: "p1",
      title: "Test pattern",
      severity: "medium",
      diagnosis: "diag",
      evidence: [
        {
          project: "p1",
          sessionIds: ["abc12345"],
          summary: "evidence here",
        },
      ],
      guidance: "try batching",
    },
  ],
  themes: [],
  perProject: [],
};

describe("/api/mentor-insights", () => {
  let tmpCache;

  beforeEach(() => {
    tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-mentor-api-"));
    process.env.BUMPS_MENTOR_CACHE_DIR = tmpCache;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BUMPS_MENTOR_CACHE_DIR;
    fs.rmSync(tmpCache, { recursive: true, force: true });
  });

  it("returns mentor_disabled when mentorEnabled is false", async () => {
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: false,
    });
    const res = await request(app).get("/api/mentor-insights").expect(200);
    expect(res.body.fallback.reason).toBe("mentor_disabled");
    expect(res.body.mentor).toBeNull();
    expect(res.body.mirror).toBeTruthy();
  });

  it("returns mentor payload when agent succeeds", async () => {
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
    const res = await request(app)
      .get("/api/mentor-insights")
      .query({ timeRange: "7d" })
      .expect(200);
    expect(res.body.mentor).toBeTruthy();
    expect(res.body.mentor.patterns[0].title).toBe("Test pattern");
    expect(res.body.fallback.used).toBe(false);
  });

  it("falls back when agent returns timeout_90s", async () => {
    vi.spyOn(mentorAgent, "runMentorAgent").mockResolvedValue({
      ok: false,
      reason: "timeout_90s",
      durationMs: 90_000,
    });
    const app = createApp(PARSED, {
      dashboardPath: STATIC_FIXTURE,
      mentorEnabled: true,
    });
    const res = await request(app).get("/api/mentor-insights").expect(200);
    expect(res.body.mentor).toBeNull();
    expect(res.body.fallback.used).toBe(true);
    expect(res.body.fallback.reason).toBe("timeout_90s");
  });

  it("second request is cache hit (same filter)", async () => {
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
    await request(app).get("/api/mentor-insights").query({ timeRange: "all" });
    await request(app).get("/api/mentor-insights").query({ timeRange: "all" });
    expect(mentorAgent.runMentorAgent).toHaveBeenCalledTimes(1);
  });
});
