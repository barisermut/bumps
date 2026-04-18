const fs = require("fs");
const os = require("os");
const path = require("path");
const mentorAgent = require("../src/lib/mentorAgent");
const {
  getMentorStatusSync,
  ensureMentorRunning,
  __resetStateForTests,
} = require("../src/lib/mentorInsights");

function session(id, project) {
  return {
    composerId: id,
    project,
    createdAt: "2024-01-01T12:00:00.000Z",
    lastUpdatedAt: "2024-01-01T13:00:00.000Z",
    userMessageCount: 2,
    messageCount: 3,
    messages: [
      { role: "user", text: "hello" },
      { role: "assistant", text: "ok", modelId: "m" },
      { role: "user", text: "wrong" },
    ],
    filesReferenced: [],
    toolsUsed: [],
    cursorRules: [],
    skillsReferenced: [],
    subagentsReferenced: [],
    sessionContextSignals: [],
  };
}

const PARSED = {
  projects: ["p1", "p2", "p3"],
  conversations: [
    ...[1, 2, 3].map((i) => session(`a${i}`, "p1")),
    ...[1, 2, 3].map((i) => session(`b${i}`, "p2")),
    ...[1, 2, 3].map((i) => session(`c${i}`, "p3")),
  ],
  totalConversations: 9,
  parserMeta: {},
};

const VALID = {
  insights: [
    {
      id: "i",
      title: "T",
      severity: "low",
      diagnosis: "d".repeat(40),
      guidance: "g",
      projects: ["p1", "p2", "p3"],
      sessionCount: 3,
    },
  ],
  themes: [],
  topPatterns: [],
  toolsAndMcps: [],
  perProject: [],
};

describe("mentorInsights module", () => {
  let tmpCache;

  beforeEach(() => {
    tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), "bumps-mentor-mod-"));
    process.env.BUMPS_MENTOR_CACHE_DIR = tmpCache;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetStateForTests();
    delete process.env.BUMPS_MENTOR_CACHE_DIR;
    fs.rmSync(tmpCache, { recursive: true, force: true });
  });

  it("ensureMentorRunning does not spawn twice while in flight", async () => {
    let resolveRun;
    const p = new Promise((r) => {
      resolveRun = r;
    });
    vi.spyOn(mentorAgent, "runMentorAgent").mockReturnValue(
      p.then(() => ({
        ok: true,
        json: VALID,
        tokens: {},
        durationMs: 1,
      }))
    );

    ensureMentorRunning(PARSED);
    ensureMentorRunning(PARSED);
    expect(mentorAgent.runMentorAgent).toHaveBeenCalledTimes(1);

    resolveRun();
    await vi.waitFor(
      async () => {
        const s = getMentorStatusSync(PARSED);
        expect(s.status).toBe("ready");
      },
      { timeout: 3000 }
    );
  });
});
