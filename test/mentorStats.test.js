const {
  computeMentorStats,
  getQualifyingConversations,
} = require("../src/lib/mentorStats");

function conv(project, id, userMsg, corrHelper) {
  const messages = [
    { role: "user", text: "start" },
    { role: "assistant", text: "ok", modelId: "m" },
    { role: "user", text: corrHelper || "thanks" },
  ];
  return {
    composerId: id,
    project,
    createdAt: "2024-01-01T12:00:00.000Z",
    lastUpdatedAt: "2024-01-01T13:00:00.000Z",
    userMessageCount: userMsg,
    messageCount: messages.length,
    messages,
    linesAdded: 0,
    linesRemoved: 0,
    filesReferenced: [],
    toolsUsed: [],
    cursorRules: [],
    skillsReferenced: [],
    subagentsReferenced: [],
    sessionContextSignals: [],
  };
}

describe("mentorStats", () => {
  it("returns zeros when no qualifying projects", () => {
    const parsed = {
      conversations: [
        conv("solo", "id1", 4, "wrong fix this"),
        conv("solo", "id2", 4, "broken"),
      ],
      projects: ["solo"],
      totalConversations: 2,
      parserMeta: {},
    };
    expect(getQualifyingConversations(parsed)).toHaveLength(0);
    expect(computeMentorStats(parsed)).toEqual({
      totalSessions: 0,
      totalMessages: 0,
      avgSessionMinutes: 0,
      frustrationPercent: 0,
    });
  });

  it("frustration at exactly 0.25 ratio counts", () => {
    const rows = [];
    for (let i = 0; i < 3; i++) {
      rows.push(conv("big", `b${i}`, 4, "wrong"));
    }
    const parsed = {
      conversations: rows,
      projects: ["big"],
      totalConversations: 3,
      parserMeta: {},
    };
    const stats = computeMentorStats(parsed);
    expect(stats.totalSessions).toBe(3);
    expect(stats.frustrationPercent).toBeGreaterThan(0);
  });

  it("includes only projects with 3+ sessions", () => {
    const parsed = {
      conversations: [
        ...[0, 1, 2].map((i) => conv("keep", `k${i}`, 2, "ok")),
        conv("drop", "d0", 2, "ok"),
        conv("drop", "d1", 2, "ok"),
      ],
      projects: ["keep", "drop"],
      totalConversations: 5,
      parserMeta: {},
    };
    const q = getQualifyingConversations(parsed);
    expect(q).toHaveLength(3);
    expect(q.every((c) => c.project === "keep")).toBe(true);
  });
});
