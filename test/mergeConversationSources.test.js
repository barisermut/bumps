const {
  normalizeConversation,
  mergeConversations,
} = require("../src/lib/mergeConversationSources");

describe("mergeConversationSources", () => {
  it("merges transcript enrichment into an existing workspace conversation", () => {
    const base = normalizeConversation(
      {
        composerId: "abc",
        name: "Base",
        project: "proj",
        workspacePath: "/tmp/proj",
        mode: "chat",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastUpdatedAt: "2026-01-01T00:00:10.000Z",
        subtitle: null,
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        filesReferenced: ["src/a.ts"],
        toolsUsed: ["ReadFile"],
        cursorRules: ["CLAUDE.md"],
        messages: [
          { role: "user", text: "hello", attachedFiles: [], cursorRules: [], mcpDescriptors: [] },
          { role: "assistant", text: "ok", modelId: "gpt-4o", attachedFiles: [], cursorRules: [], mcpDescriptors: [] },
        ],
      },
      "workspace"
    );

    const merged = mergeConversations(
      base,
      {
        composerId: "abc",
        name: "Transcript",
        project: "proj",
        workspacePath: "/tmp/proj",
        mode: "agent",
        createdAt: "2026-01-01T00:00:01.000Z",
        lastUpdatedAt: "2026-01-01T00:00:11.000Z",
        subtitle: null,
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        filesReferenced: ["src/b.ts"],
        toolsUsed: [],
        cursorRules: [],
        skillsReferenced: ["brainstorming"],
        subagentsReferenced: ["explore"],
        sessionContextSignals: ["delegated-task"],
        linkedTranscriptIds: ["xyz"],
        attachmentsSummary: { hasFiles: true, hasImages: false, imageCount: 0 },
        messages: [
          { role: "user", text: "transcript", attachedFiles: [], cursorRules: [], mcpDescriptors: [] },
        ],
      },
      "agent-transcript"
    );

    expect(merged.sourceCoverage).toMatchObject({
      workspace: true,
      agentTranscript: true,
      sourceCount: 2,
    });
    expect(merged.filesReferenced).toEqual(
      expect.arrayContaining(["src/a.ts", "src/b.ts"])
    );
    expect(merged.skillsReferenced).toEqual(["brainstorming"]);
    expect(merged.subagentsReferenced).toEqual(["explore"]);
    expect(merged.sessionContextSignals).toEqual(["delegated-task"]);
    expect(merged.completenessFlags.hasSourceOverlap).toBe(true);
    expect(merged.completenessFlags.hasTranscriptSignals).toBe(true);
  });
});
