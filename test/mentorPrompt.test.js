const {
  buildMentorPrompt,
  buildMentorPromptBundle,
  estimateTokens,
} = require("../src/lib/mentorPrompt");
const { analyze } = require("../src/analyzer");

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
      { role: "user", text: "hello auth login please" },
      { role: "assistant", text: "ok", modelId: "gpt-4o" },
      { role: "user", text: lastUserText },
    ],
    filesReferenced: ["a.ts"],
    toolsUsed: ["read_file"],
    cursorRules: [],
    skillsReferenced: [],
    subagentsReferenced: [],
    sessionContextSignals: [],
  };
}

describe("buildMentorPrompt", () => {
  it("includes headers, session fields, and no lastUserPrompt in JSON", () => {
    const conversations = [
      baseConversation(1, "heavy", "wrong please fix"),
      baseConversation(2, "heavy", "still not working"),
      baseConversation(3, "heavy", "thanks done"),
      baseConversation(4, "light", "hello"),
      baseConversation(5, "light", "bye"),
    ];
    const parsed = {
      conversations,
      projects: ["heavy", "light"],
      totalConversations: 5,
      parserMeta: {},
    };
    const mirror = analyze(parsed, { project: null, timeRange: "all" });
    const prompt = buildMentorPrompt(parsed, mirror, {
      project: null,
      timeRange: "all",
    });

    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("Mirror pre-analysis");
    expect(prompt).toContain("Project arcs");
    expect(prompt).toContain("Sessions:");

    const sessionsPart = prompt.split("Sessions:")[1].split("Return only")[0].trim();
    const rows = JSON.parse(sessionsPart);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toHaveProperty("correctionCycles");
      expect(row).toHaveProperty("endedOnCorrection");
      expect(row.firstPrompt.length).toBeLessThanOrEqual(250);
      expect(row).not.toHaveProperty("lastUserPrompt");
    }

    const bundle = buildMentorPromptBundle(parsed, mirror, {
      project: null,
      timeRange: "all",
    });
    const heavyArc = bundle.projectArcs.find((a) => a.project === "heavy");
    expect(heavyArc).toBeTruthy();
    expect(heavyArc.sessionCount).toBe(3);
    expect(heavyArc.abandonmentRate).toBeCloseTo(2 / 3, 5);
  });

  it("truncates a long first prompt to 250 chars", () => {
    const long = "x".repeat(5000);
    const parsed = {
      conversations: [
        {
          composerId: "id000001",
          project: "p",
          createdAt: "2024-01-01T00:00:00.000Z",
          lastUpdatedAt: "2024-01-01T01:00:00.000Z",
          userMessageCount: 1,
          messageCount: 1,
          messages: [{ role: "user", text: long }],
          filesReferenced: [],
          toolsUsed: [],
          cursorRules: [],
          skillsReferenced: [],
          subagentsReferenced: [],
          sessionContextSignals: [],
        },
      ],
      projects: ["p"],
      totalConversations: 1,
      parserMeta: {},
    };
    const mirror = analyze(parsed, { timeRange: "all" });
    const prompt = buildMentorPrompt(parsed, mirror, { timeRange: "all" });
    const sessionsPart = prompt.split("Sessions:")[1].split("Return only")[0].trim();
    const rows = JSON.parse(sessionsPart);
    expect(rows[0].firstPrompt.length).toBe(250);
  });

  it("estimateTokens under 20k for small fixture and under 40k for 200-session fixture", () => {
    const conversations = [];
    for (let i = 0; i < 200; i++) {
      conversations.push(
        baseConversation(i, i % 2 === 0 ? "pa" : "pb", "fix this bug")
      );
    }
    const parsed = {
      conversations,
      projects: ["pa", "pb"],
      totalConversations: 200,
      parserMeta: {},
    };
    const mirror = analyze(parsed, { timeRange: "all" });
    const bundleSmall = buildMentorPromptBundle(
      {
        conversations: conversations.slice(0, 5),
        projects: ["pa"],
        totalConversations: 5,
        parserMeta: {},
      },
      analyze(
        {
          conversations: conversations.slice(0, 5),
          projects: ["pa"],
          totalConversations: 5,
          parserMeta: {},
        },
        { timeRange: "all" }
      ),
      { timeRange: "all" }
    );
    expect(estimateTokens(bundleSmall.prompt)).toBeLessThan(20_000);

    const bundleBig = buildMentorPromptBundle(parsed, mirror, {
      timeRange: "all",
    });
    expect(estimateTokens(bundleBig.prompt)).toBeLessThan(40_000);
    const sessionsPart = bundleBig.prompt
      .split("Sessions:")[1]
      .split("Return only")[0]
      .trim();
    const rows = JSON.parse(sessionsPart);
    expect(rows.length).toBeLessThanOrEqual(120);
  });
});
