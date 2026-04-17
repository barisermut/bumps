const {
  validateMentorResponse,
} = require("../src/lib/mentorAgent");

describe("validateMentorResponse", () => {
  const knownSessionIds = new Set(["abc12345", "def67890"]);
  const knownProjects = new Set(["p1", "p2"]);

  it("accepts a valid payload", () => {
    const json = {
      overallDiagnosis: "You tend to iterate.",
      patterns: [
        {
          id: "x",
          title: "Short title here",
          severity: "medium",
          diagnosis: "d".repeat(50),
          evidence: [
            {
              project: "p1",
              sessionIds: ["abc12345"],
              summary: "s",
            },
          ],
          guidance: "g".repeat(40),
        },
      ],
      themes: [{ name: "t", share: 0.5, sampleSessionIds: ["abc12345"] }],
      perProject: [
        { project: "p1", diagnosis: "pd", primaryPatternIds: ["x"] },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.patterns).toHaveLength(1);
  });

  it("filters invented session ids and drops empty evidence", () => {
    const json = {
      overallDiagnosis: "d",
      patterns: [
        {
          id: "x",
          title: "t",
          severity: "low",
          diagnosis: "d",
          evidence: [
            {
              project: "p1",
              sessionIds: ["abc12345", "nope_nope"],
              summary: "s",
            },
          ],
          guidance: "g",
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.warnings).toContain("dropped_invented_session_ids");
    expect(out.value.patterns[0].evidence[0].sessionIds).toEqual(["abc12345"]);
  });

  it("returns validation_empty when patterns missing", () => {
    const out = validateMentorResponse(
      { overallDiagnosis: "x" },
      { knownSessionIds, knownProjects }
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("validation_empty");
  });

  it("clamps themes share to 1", () => {
    const json = {
      overallDiagnosis: "d",
      patterns: [
        {
          id: "a",
          title: "t",
          severity: "high",
          diagnosis: "d",
          evidence: [
            { project: "p1", sessionIds: ["abc12345"], summary: "s" },
          ],
          guidance: "g",
        },
      ],
      themes: [{ name: "big", share: 1.5, sampleSessionIds: [] }],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.themes[0].share).toBe(1);
  });

  it("does not pass through perProject.sessionCount", () => {
    const json = {
      overallDiagnosis: "d",
      patterns: [
        {
          id: "a",
          title: "t",
          severity: "high",
          diagnosis: "d",
          evidence: [
            { project: "p1", sessionIds: ["abc12345"], summary: "s" },
          ],
          guidance: "g",
        },
      ],
      perProject: [
        {
          project: "p1",
          sessionCount: 99,
          diagnosis: "pd",
          primaryPatternIds: [],
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.perProject[0].sessionCount).toBeUndefined();
  });
});
