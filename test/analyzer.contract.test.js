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
    expect(out.changeVolume).toMatchObject({
      totalLinesChanged: 0,
      avgLinesPerSession: 0,
      sessionsWithChanges: 0,
      heaviestSession: null,
    });
    expect(out.contextRichness).toMatchObject({
      sessionsWithSkills: 0,
      sessionsWithSubagents: 0,
      sessionsWithFileContext: 0,
      topSkills: [],
      topContextSignals: [],
    });
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
    if (out.bumps.length > 0) {
      expect(out.bumps[0]).toMatchObject({
        avgUserMessages: expect.any(Number),
        avgMessages: expect.any(Number),
        avgSessionSpanMinutes: expect.any(Number),
        avgLinesChanged: expect.any(Number),
        effortScore: expect.any(Number),
      });
    }
    expect(out.modelPerformance).toBeDefined();
    expect(out.meta.filteredConversationCount).toBe(1);
    expect(out.contextRichness.sessionsWithSkills).toBe(1);
    expect(out.contextRichness.sessionsWithSubagents).toBe(1);
    expect(out.contextRichness.sessionsWithFileContext).toBe(1);
    expect(out.contextRichness.topSkills).toEqual(["brainstorming"]);
    expect(out.contextRichness.topContextSignals).toEqual(["manual-skills"]);
    expect(out.changeVolume.totalLinesChanged).toBe(0);
    expect(out.changeVolume.heaviestSession).toBeNull();
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
    expect(all.biggestBump).toMatch(
      /came up in \d+ sessions, averaging [\d.]+ messages each/
    );
    expect(today.biggestBump).toMatch(
      /came up in \d+ sessions, averaging [\d.]+ messages each/
    );
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

  it("ranks bumps by effort score so a single heavy session can beat higher prevalence", () => {
    const t0 = "2026-01-10T12:00:00.000Z";
    const tLong = "2026-01-11T20:00:00.000Z";
    const tShort = "2026-01-10T12:01:00.000Z";
    const highEffort = {
      composerId: "high",
      project: "p",
      createdAt: t0,
      lastUpdatedAt: tLong,
      userMessageCount: 24,
      messageCount: 40,
      linesAdded: 800,
      linesRemoved: 200,
      messages: [
        { role: "user", text: "auth login token jwt oauth debugging session" },
        { role: "assistant", text: "ok", modelId: "gpt-4o" },
      ],
      filesReferenced: [],
      toolsUsed: [],
      cursorRules: [],
    };
    const low = {
      composerId: "low1",
      project: "p",
      createdAt: t0,
      lastUpdatedAt: tShort,
      userMessageCount: 2,
      messageCount: 4,
      linesAdded: 5,
      linesRemoved: 2,
      messages: [
        { role: "user", text: "database sql migration schema" },
        { role: "assistant", text: "ok", modelId: "gpt-4o" },
      ],
      filesReferenced: [],
      toolsUsed: [],
      cursorRules: [],
    };
    const data = {
      conversations: [highEffort, { ...low, composerId: "low2" }, low],
      parserMeta: { sourceSummary: {}, mergeSummary: {} },
    };
    const out = analyze(data, { timeRange: "all" });
    const auth = out.bumps.find((b) => b.topic === "Stuck on auth again");
    const db = out.bumps.find((b) => b.topic === "Down the database rabbit hole");
    expect(auth.count).toBe(1);
    expect(db.count).toBe(2);
    expect(out.bumps[0].topic).toBe("Stuck on auth again");
  });

  it("computes change volume and heaviest session", () => {
    const out = analyze(
      {
        conversations: [
          {
            composerId: "1",
            project: "alpha",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 1,
            linesAdded: 100,
            linesRemoved: 20,
            messages: [{ role: "user", text: "x" }],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
          },
          {
            composerId: "2",
            project: "beta",
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            userMessageCount: 1,
            linesAdded: 5,
            linesRemoved: 0,
            messages: [{ role: "user", text: "y" }],
            filesReferenced: [],
            toolsUsed: [],
            cursorRules: [],
          },
        ],
        parserMeta: { sourceSummary: {}, mergeSummary: {} },
      },
      { timeRange: "all" }
    );
    expect(out.changeVolume.totalLinesChanged).toBe(125);
    expect(out.changeVolume.sessionsWithChanges).toBe(2);
    expect(out.changeVolume.heaviestSession).toEqual({
      project: "alpha",
      linesChanged: 120,
    });
  });
});
