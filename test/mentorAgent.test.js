const { validateMentorResponse } = require("../src/lib/mentorAgent");

describe("validateMentorResponse", () => {
  const knownSessionIds = new Set(["abc12345", "def67890"]);
  const knownProjects = new Set(["p1", "p2", "p3"]);

  const baseInsight = {
    id: "x",
    title: "Short title here",
    severity: "medium",
    diagnosis: "d".repeat(50),
    guidance: "g".repeat(40),
    projects: ["p1", "p2", "p3"],
    sessionCount: 3,
  };

  it("accepts a valid payload", () => {
    const json = {
      insights: [baseInsight],
      themes: [{ name: "t", share: 0.5 }],
      topPatterns: [{ name: "a", percentage: 30 }],
      toolsAndMcps: [{ name: "read_file", sessionCount: 2 }],
      perProject: [
        {
          project: "p1",
          sessions: 3,
          messages: 10,
          avgTimeMinutes: 5,
          frustrationPercent: 12,
          insight: "Distinct focus on refactors.",
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.insights).toHaveLength(1);
    expect(out.value.insights[0].projects).toEqual(["p1", "p2", "p3"]);
    expect(out.value.perProject[0].insight).toBe("Distinct focus on refactors.");
  });

  it("drops insights with fewer than 3 projects", () => {
    const json = {
      insights: [
        {
          ...baseInsight,
          projects: ["p1", "p2"],
          sessionCount: 5,
        },
      ],
      themes: [],
      topPatterns: [],
      toolsAndMcps: [],
      perProject: [],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("validation_empty");
  });

  it("drops insights with sessionCount under 3", () => {
    const json = {
      insights: [{ ...baseInsight, sessionCount: 2 }],
      themes: [],
      topPatterns: [],
      toolsAndMcps: [],
      perProject: [],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(false);
  });

  it("humanizes project names with underscores", () => {
    const known = new Set(["my_proj", "p2", "p3"]);
    const json = {
      insights: [
        {
          ...baseInsight,
          projects: ["my proj", "p2", "p3"],
          sessionCount: 4,
        },
      ],
      themes: [],
      topPatterns: [],
      toolsAndMcps: [],
      perProject: [
        {
          project: "my_proj",
          sessions: 1,
          messages: 1,
          avgTimeMinutes: 1,
          frustrationPercent: 0,
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects: known });
    expect(out.ok).toBe(true);
    expect(out.value.insights[0].projects[0]).toBe("my proj");
    expect(out.value.perProject[0].project).toBe("my proj");
    expect(out.value.perProject[0].insight).toBe("");
  });

  it("returns validation_empty when insights missing", () => {
    const out = validateMentorResponse(
      { themes: [], topPatterns: [], toolsAndMcps: [], perProject: [] },
      { knownSessionIds, knownProjects }
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("validation_empty");
  });

  it("clamps themes share to 1", () => {
    const json = {
      insights: [baseInsight],
      themes: [{ name: "big", share: 1.5 }],
      topPatterns: [],
      toolsAndMcps: [],
      perProject: [],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.themes[0].share).toBe(1);
  });

  it("drops generic perProject rows with warning", () => {
    const json = {
      insights: [baseInsight],
      themes: [{ name: "t", share: 0.5 }],
      topPatterns: [],
      toolsAndMcps: [{ name: "read_file", sessionCount: 2 }],
      perProject: [
        {
          project: "untitled",
          sessions: 1,
          messages: 1,
          avgTimeMinutes: 1,
          frustrationPercent: 0,
        },
        {
          project: "p1",
          sessions: 3,
          messages: 10,
          avgTimeMinutes: 5,
          frustrationPercent: 12,
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.perProject).toHaveLength(1);
    expect(out.value.perProject[0].project).toBe("p1");
    expect(out.value.perProject[0].insight).toBe("");
    expect(out.warnings).toContain("dropped_generic_per_project");
  });

  it("drops generic names from insight projects list with warning", () => {
    const json = {
      insights: [
        {
          ...baseInsight,
          projects: ["p1", "window", "p2", "p3"],
          sessionCount: 5,
        },
      ],
      themes: [{ name: "t", share: 0.5 }],
      topPatterns: [],
      toolsAndMcps: [{ name: "read_file", sessionCount: 2 }],
      perProject: [
        {
          project: "p1",
          sessions: 3,
          messages: 10,
          avgTimeMinutes: 5,
          frustrationPercent: 12,
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.insights[0].projects).toEqual(["p1", "p2", "p3"]);
    expect(out.warnings).toContain("dropped_generic_project_in_insight");
  });

  it("defaults missing perProject insight to empty string", () => {
    const json = {
      insights: [baseInsight],
      themes: [{ name: "t", share: 0.5 }],
      topPatterns: [],
      toolsAndMcps: [{ name: "read_file", sessionCount: 2 }],
      perProject: [
        {
          project: "p1",
          sessions: 3,
          messages: 10,
          avgTimeMinutes: 5,
          frustrationPercent: 12,
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.perProject[0].insight).toBe("");
  });

  it("truncates long perProject insight", () => {
    const longInsight = "x".repeat(500);
    const json = {
      insights: [baseInsight],
      themes: [{ name: "t", share: 0.5 }],
      topPatterns: [],
      toolsAndMcps: [{ name: "read_file", sessionCount: 2 }],
      perProject: [
        {
          project: "p1",
          sessions: 3,
          messages: 10,
          avgTimeMinutes: 5,
          frustrationPercent: 12,
          insight: longInsight,
        },
      ],
    };
    const out = validateMentorResponse(json, { knownSessionIds, knownProjects });
    expect(out.ok).toBe(true);
    expect(out.value.perProject[0].insight.length).toBe(400);
  });
});
