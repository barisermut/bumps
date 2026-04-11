const { analyze } = require("../src/analyzer");

describe("analyze() contract", () => {
  it("returns stable keys and types for empty input", () => {
    const out = analyze(
      { conversations: [] },
      { project: null, timeRange: "all" }
    );
    expect(typeof out.biggestBump).toBe("string");
    expect(Array.isArray(out.bumps)).toBe(true);
    expect(Array.isArray(out.scopeDrift)).toBe(true);
    expect(out.promptHabits).toMatchObject({
      short: expect.any(Object),
      long: expect.any(Object),
    });
    expect(out.whatWorked).toMatchObject({
      fastPromptPatterns: expect.any(Array),
      cleanDomains: expect.any(Array),
      activeTools: expect.any(Array),
      mcpServers: expect.any(Array),
    });
    expect(Array.isArray(out.modelPerformance)).toBe(true);
    expect(out.meta).toMatchObject({
      totalConversationCount: expect.any(Number),
      filteredConversationCount: expect.any(Number),
      sourceCoverage: expect.any(Object),
      completeness: expect.any(Object),
    });
  });

  it("returns stable keys for minimal conversation fixture", () => {
    const out = analyze(
      {
        conversations: [
          {
            composerId: "1",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "hello world auth login" },
              { role: "assistant", text: "ok", modelId: "gpt-4o" },
            ],
            filesReferenced: ["a.ts"],
            toolsUsed: [],
            cursorRules: [],
            skillsReferenced: ["brainstorming"],
            subagentsReferenced: ["explore"],
            sessionContextSignals: ["manual-skills"],
            sourceCoverage: {
              workspace: true,
              agentStore: false,
              agentTranscript: true,
              sourceCount: 2,
            },
            completenessFlags: {
              hasFiles: true,
              hasTools: false,
              hasModels: true,
              hasTranscriptSignals: true,
            },
          },
        ],
        parserMeta: { sourceSummary: {}, mergeSummary: {} },
      },
      { timeRange: "all" }
    );
    expect(out.bumps.length).toBeGreaterThanOrEqual(0);
    expect(out.modelPerformance).toBeDefined();
    expect(out.meta.filteredConversationCount).toBe(1);
  });

  it("timeRange today and legacy 1d filter the same (calendar day)", () => {
    const oldIso = "2020-01-15T12:00:00.000Z";
    const freshIso = new Date().toISOString();
    const conv = (id, createdAt) => ({
      composerId: id,
      project: "p",
      createdAt,
      lastUpdatedAt: createdAt,
      userMessageCount: 2,
      messages: [
        { role: "user", text: "auth login issue" },
        { role: "assistant", text: "ok", modelId: "gpt-4o" },
      ],
      filesReferenced: [],
      toolsUsed: [],
      cursorRules: [],
    });
    const data = {
      conversations: [conv("old", oldIso), conv("new", freshIso)],
      parserMeta: { sourceSummary: {}, mergeSummary: {} },
    };
    const all = analyze(data, { timeRange: "all" });
    const today = analyze(data, { timeRange: "today" });
    const legacy1d = analyze(data, { timeRange: "1d" });
    expect(JSON.stringify(today)).toBe(JSON.stringify(legacy1d));
    expect(all.bumps[0]?.count).toBe(2);
    expect(today.bumps[0]?.count).toBe(1);
  });

  it("surfaces transcript-derived support patterns in whatWorked.activeTools", () => {
    const out = analyze(
      {
        conversations: [
          {
            composerId: "1",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "help with auth flow" },
              { role: "assistant", text: "ok", modelId: "gpt-4o" },
            ],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
            skillsReferenced: ["brainstorming"],
            subagentsReferenced: ["explore"],
            sessionContextSignals: ["delegated-task"],
            sourceCoverage: { workspace: true, agentStore: false, agentTranscript: true, sourceCount: 2 },
            completenessFlags: { hasFiles: false, hasTools: false, hasModels: true, hasTranscriptSignals: true },
          },
          {
            composerId: "2",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "help with auth flow again" },
              { role: "assistant", text: "ok", modelId: "gpt-4o" },
            ],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
            skillsReferenced: ["brainstorming"],
            subagentsReferenced: ["explore"],
            sessionContextSignals: ["delegated-task"],
            sourceCoverage: { workspace: false, agentStore: false, agentTranscript: true, sourceCount: 1 },
            completenessFlags: { hasFiles: false, hasTools: false, hasModels: true, hasTranscriptSignals: true },
          },
        ],
        parserMeta: { sourceSummary: {}, mergeSummary: {} },
      },
      { timeRange: "all" }
    );

    expect(out.whatWorked.activeTools.join(" ")).toMatch(/brainstorming|explore|delegated task/i);
    expect(out.meta.sourceCoverage.withAgentTranscript).toBe(2);
  });

  it("keeps modelPerformance available for low-signal ranges", () => {
    const out = analyze(
      {
        conversations: [
          {
            composerId: "1",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "first" },
              { role: "assistant", text: "ok", modelId: "composer-2-fast" },
            ],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
          },
          {
            composerId: "2",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "second" },
              { role: "assistant", text: "ok", modelId: "composer-2-fast" },
            ],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
          },
          {
            composerId: "3",
            project: "p",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 2,
            messages: [
              { role: "user", text: "third" },
              { role: "assistant", text: "ok", modelId: "gpt-4o" },
            ],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
          },
        ],
        parserMeta: { sourceSummary: {}, mergeSummary: {} },
      },
      { timeRange: "all" }
    );

    expect(out.modelPerformance[0]).toMatchObject({
      model: expect.any(String),
      sessionCount: 2,
      lowConfidence: true,
    });
  });
});
