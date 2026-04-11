const {
  enrichAssistantFromBubble,
  toolCallsFromOpenAiToolCalls,
  addMessageToolsToSet,
} = require("../src/lib/assistantBubble");

describe("enrichAssistantFromBubble", () => {
  it("extracts thinking, code blocks, tool former", () => {
    const bubble = {
      thinking: { text: "plan" },
      codeBlocks: [{ uri: { path: "/p/x.ts" } }],
      toolFormerData: {
        name: "read",
        rawArgs: '{"path":"a"}',
      },
    };
    const e = enrichAssistantFromBubble(bubble);
    expect(e.thinkingText).toBe("plan");
    expect(e.codeBlockPaths).toEqual(["/p/x.ts"]);
    expect(e.toolCallsDetailed).toEqual([{ name: "read", argKeys: "path" }]);
  });
});

describe("toolCallsFromOpenAiToolCalls", () => {
  it("maps all tool calls", () => {
    const tcs = toolCallsFromOpenAiToolCalls([
      { function: { name: "a", arguments: '{"x":1}' } },
      { function: { name: "b", arguments: "{}" } },
    ]);
    expect(tcs.map((t) => t.name)).toEqual(["a", "b"]);
    expect(tcs[0].argKeys).toBe("x");
  });
});

describe("addMessageToolsToSet", () => {
  it("unions toolName and toolCallsDetailed", () => {
    const s = new Set();
    addMessageToolsToSet(s, {
      toolName: "run",
      toolCallsDetailed: [{ name: "other" }],
    });
    expect([...s].sort()).toEqual(["other", "run"]);
  });
});
