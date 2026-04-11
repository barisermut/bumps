const THINKING_TEXT_CAP = 8000;

function parseToolArgs(rawArgs, params) {
  let args = {};
  if (rawArgs && typeof rawArgs === "string" && rawArgs !== "") {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = {};
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    args = rawArgs;
  }

  if (!args || typeof args !== "object" || Object.keys(args).length === 0) {
    if (params && typeof params === "string" && params !== "") {
      try {
        const p = JSON.parse(params);
        if (p && typeof p === "object") args = p;
      } catch {
        /* keep args */
      }
    } else if (params && typeof params === "object") {
      args = params;
    }
  }

  return args && typeof args === "object" ? args : {};
}

/**
 * @param {{ name?: string, rawArgs?: string|object, params?: string|object }|null|undefined} tfd
 * @returns {{ name: string, argKeys: string }[]}
 */
function toolCallsFromToolFormerData(tfd) {
  if (!tfd || !tfd.name) return [];
  const args = parseToolArgs(tfd.rawArgs, tfd.params);
  const argKeys = Object.keys(args).join(", ");
  return [{ name: tfd.name, argKeys }];
}

/**
 * Structured assistant-only fields from a Cursor bubble (global DB).
 * @param {Record<string, unknown>} bubble - raw JSON from cursorDiskKV
 */
function enrichAssistantFromBubble(bubble) {
  const thinkingText =
    bubble.thinking && typeof bubble.thinking.text === "string"
      ? bubble.thinking.text.length > THINKING_TEXT_CAP
        ? bubble.thinking.text.slice(0, THINKING_TEXT_CAP)
        : bubble.thinking.text
      : null;

  const codeBlockPaths = [];
  if (Array.isArray(bubble.codeBlocks)) {
    for (const cb of bubble.codeBlocks) {
      const uri = cb && cb.uri;
      const p =
        uri &&
        (typeof uri.path === "string"
          ? uri.path
          : typeof uri.fsPath === "string"
            ? uri.fsPath
            : "");
      if (p) codeBlockPaths.push(p);
    }
  }

  const toolCallsDetailed = toolCallsFromToolFormerData(bubble.toolFormerData);

  return {
    thinkingText,
    codeBlockPaths: codeBlockPaths.length ? codeBlockPaths : undefined,
    toolCallsDetailed:
      toolCallsDetailed.length > 0 ? toolCallsDetailed : undefined,
  };
}

/**
 * OpenAI-style tool_calls from agent store JSON message.
 * @param {unknown} toolCalls
 * @returns {{ name: string, argKeys: string }[]}
 */
function toolCallsFromOpenAiToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  const out = [];
  for (const tc of toolCalls) {
    const fn = tc && tc.function;
    const name = fn?.name || tc?.name;
    if (!name || typeof name !== "string") continue;
    let argKeys = "";
    const raw = fn?.arguments;
    if (typeof raw === "string" && raw !== "") {
      try {
        const args = JSON.parse(raw);
        if (args && typeof args === "object") {
          argKeys = Object.keys(args).join(", ");
        }
      } catch {
        argKeys = "";
      }
    } else if (raw && typeof raw === "object") {
      argKeys = Object.keys(raw).join(", ");
    }
    out.push({ name, argKeys });
  }
  return out;
}

/**
 * Union tool names for conversation-level toolsUsed.
 * @param {Set<string>} toolsUsed
 * @param {{ toolName?: string|null, toolCallsDetailed?: { name: string }[] }} message
 */
function addMessageToolsToSet(toolsUsed, message) {
  if (message.toolName) toolsUsed.add(message.toolName);
  for (const tc of message.toolCallsDetailed || []) {
    if (tc.name) toolsUsed.add(tc.name);
  }
}

module.exports = {
  enrichAssistantFromBubble,
  toolCallsFromOpenAiToolCalls,
  addMessageToolsToSet,
  THINKING_TEXT_CAP,
};
