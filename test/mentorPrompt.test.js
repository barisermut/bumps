const {
  buildMentorPrompt,
  buildMentorPromptBundle,
  estimateTokens,
} = require("../src/lib/mentorPrompt");

function baseConversation(i, project, lastUserText) {
  const id = `abc${String(i).padStart(5, "0")}zzzz`;
  return {
    composerId: id,
    project,
    createdAt: `2024-06-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    lastUpdatedAt: `2024-06-${String((i % 28) + 1).padStart(2, "0")}T12:30:00.000Z`,
    userMessageCount: 2,
    messageCount: 3,
    messages: [
      { role: "user", text: "hello", mcpDescriptors: ["context7"] },
      { role: "assistant", text: "ok", modelId: "gpt-4o" },
      { role: "user", text: lastUserText },
    ],
    filesReferenced: ["a.ts"],
    toolsUsed: ["read_file"],
    cursorRules: [],
    skillsReferenced: [],
    subagentsReferenced: [],
    sessionContextSignals: [],
    linesAdded: 1,
    linesRemoved: 0,
  };
}

describe("buildMentorPrompt", () => {
  it("includes session rows with middleSignals and no firstPrompt", () => {
    const conversations = [];
    for (let p of ["pa", "pb", "pc"]) {
      for (let j = 0; j < 3; j++) {
        conversations.push(baseConversation(conversations.length, p, "wrong"));
      }
    }
    const parsed = {
      conversations,
      projects: ["pa", "pb", "pc"],
      totalConversations: conversations.length,
      parserMeta: {},
    };
    const bundle = buildMentorPromptBundle(parsed);
    const prompt = bundle.prompt;
    expect(prompt).toContain("Project arcs");
    expect(prompt).toContain("Sessions");
    expect(prompt).not.toContain("Mirror pre-analysis");
    expect(prompt).not.toContain("firstPrompt");
    expect(prompt).toContain("skillsUsed and mcpServers");
    expect(prompt).toContain('"insight": string');

    const rows = bundle.sessionRows;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("middleSignals");
      expect(row).toHaveProperty("correctionCycles");
      expect(row).toHaveProperty("endedOnCorrection");
      expect(row).not.toHaveProperty("firstPrompt");
      expect(row).toHaveProperty("toolsUsed");
      expect(row).toHaveProperty("skillsUsed");
      expect(row).toHaveProperty("mcpServers");
      expect(Array.isArray(row.mcpServers)).toBe(true);
    }
    expect(rows.some((r) => r.mcpServers.includes("context7"))).toBe(true);
    expect(bundle.stats.totalSessions).toBe(9);
    const heavyArc = bundle.projectArcs.find((a) => a.project === "pa");
    expect(heavyArc).toBeTruthy();
    expect(heavyArc.sessionCount).toBe(3);
    expect(heavyArc).toHaveProperty("frustrationPercent");
  });

  it("drops projects with fewer than 3 sessions", () => {
    const conversations = [
      baseConversation(1, "heavy", "fix"),
      baseConversation(2, "heavy", "wrong"),
      baseConversation(3, "heavy", "ok"),
      baseConversation(4, "tiny", "a"),
      baseConversation(5, "tiny", "b"),
    ];
    const parsed = {
      conversations,
      projects: ["heavy", "tiny"],
      totalConversations: 5,
      parserMeta: {},
    };
    const bundle = buildMentorPromptBundle(parsed);
    expect(bundle.sessionRows.every((r) => r.project === "heavy")).toBe(true);
  });

  it("estimateTokens under18k hard cap for 200-session fixture", () => {
    const conversations = [];
    for (let i = 0; i < 200; i++) {
      const proj = ["pa", "pb", "pc"][i % 3];
      conversations.push(baseConversation(i, proj, "fix this bug"));
    }
    const parsed = {
      conversations,
      projects: ["pa", "pb", "pc"],
      totalConversations: 200,
      parserMeta: {},
    };
    const bundle = buildMentorPromptBundle(parsed);
    expect(estimateTokens(bundle.prompt)).toBeLessThan(18_000);
    expect(bundle.sessionRows.length).toBeLessThanOrEqual(100);
  });
});
