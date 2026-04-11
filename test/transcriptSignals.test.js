const {
  collectTranscriptSignals,
  stripTranscriptMarkup,
} = require("../src/lib/transcriptSignals");

describe("transcriptSignals", () => {
  it("extracts Bumps-native transcript context signals", () => {
    const raw = `
<manually_attached_skills>
/Users/me/.agents/skills/brainstorming/SKILL.md
</manually_attached_skills>
Role: You are a senior engineer.
subagent_type: "explore"
Full audit details: @/Users/me/.cursor/projects/foo/agent-transcripts/abc-123.jsonl
<attached_files><file path="src/app.js" /></attached_files>
[Image]
`;

    const out = collectTranscriptSignals(raw);
    expect(out.skillsReferenced).toEqual(["brainstorming"]);
    expect(out.subagentsReferenced).toEqual(["explore"]);
    expect(out.agentTranscriptRefs).toEqual(["abc-123"]);
    expect(out.sessionContextSignals).toEqual(
      expect.arrayContaining([
        "manual-skills",
        "subagent-context",
        "linked-transcript",
        "delegated-task",
        "file-context",
        "image-context",
      ])
    );
    expect(out.attachmentsSummary).toMatchObject({
      hasFiles: true,
      hasImages: true,
      imageCount: 1,
    });
  });

  it("strips transcript wrappers but keeps meaningful text", () => {
    const cleaned = stripTranscriptMarkup(
      "<user_query>Hello</user_query><attached_files><file path=\"a\" /></attached_files>[Image]"
    );
    expect(cleaned).toBe("Hello");
  });
});
