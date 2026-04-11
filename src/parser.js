const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");

const GLOBAL_DB_PATH = path.join(
  os.homedir(),
  "Library/Application Support/Cursor/User/globalStorage/state.vscdb"
);

const WORKSPACE_STORAGE_PATH = path.join(
  os.homedir(),
  "Library/Application Support/Cursor/User/workspaceStorage"
);

const AGENT_CHATS_PATH = path.join(os.homedir(), ".cursor", "chats");

const AGENT_PROJECTS_PATH = path.join(os.homedir(), ".cursor", "projects");

function openDb() {
  return new Database(GLOBAL_DB_PATH, { readonly: true });
}

/**
 * Extract project name from a workspace fsPath.
 * e.g. "/Users/barisermut/idea-pressure" -> "idea-pressure"
 */
function inferProject(workspaceIdentifier) {
  if (!workspaceIdentifier) return null;
  const uri = workspaceIdentifier.uri;
  if (!uri || !uri.fsPath) return null;
  return path.basename(uri.fsPath);
}

const fs = require("fs");
const { decodeStoreMetaRow } = require("./lib/storeMeta");
const {
  inferProjectFromFileSelections,
  inferProjectFromMessageText,
} = require("./lib/cursorPaths");
const { assignSyntheticMessageTimestamps } = require("./lib/messageTimestamps");
const { extractAttachedFilePathsFromTranscriptText } = require(
  "./lib/transcriptAttachedFiles"
);
const { collectTranscriptSignals } = require("./lib/transcriptSignals");
const {
  enrichAssistantFromBubble,
  toolCallsFromOpenAiToolCalls,
  addMessageToolsToSet,
} = require("./lib/assistantBubble");
const { createParseStats, bumpParseStat } = require("./lib/parseStats");
const {
  normalizeConversation,
  mergeConversations,
} = require("./lib/mergeConversationSources");

function createParserMeta() {
  return {
    sourceSummary: {
      workspaceHeaders: 0,
      workspaceConversations: 0,
      bubbleBackedConversations: 0,
      agentStoreConversations: 0,
      agentTranscriptConversations: 0,
      canonicalConversations: 0,
    },
    mergeSummary: {
      agentStoreOverlapsMerged: 0,
      agentTranscriptOverlapsMerged: 0,
      transcriptOnlyConversations: 0,
    },
  };
}

function ingestConversation(conversationsById, candidate, source, parserMeta, stats) {
  if (!candidate || !candidate.composerId) return;

  if (source === "workspace") {
    parserMeta.sourceSummary.workspaceConversations++;
  } else if (source === "agent-store") {
    parserMeta.sourceSummary.agentStoreConversations++;
  } else if (source === "agent-transcript") {
    parserMeta.sourceSummary.agentTranscriptConversations++;
  }

  const existing = conversationsById.get(candidate.composerId);
  if (!existing) {
    const normalized = normalizeConversation(candidate, source);
    conversationsById.set(candidate.composerId, normalized);
    if (source === "agent-transcript") {
      parserMeta.mergeSummary.transcriptOnlyConversations++;
    }
    return;
  }

  if (source === "agent-store") {
    parserMeta.mergeSummary.agentStoreOverlapsMerged++;
    bumpParseStat(stats, "agentStoreOverlapsMerged");
  } else if (source === "agent-transcript") {
    parserMeta.mergeSummary.agentTranscriptOverlapsMerged++;
    bumpParseStat(stats, "agentTranscriptOverlapsMerged");
    if (!existing.sourceCoverage?.agentTranscript) {
      parserMeta.mergeSummary.transcriptOnlyConversations = Math.max(
        0,
        parserMeta.mergeSummary.transcriptOnlyConversations - 1
      );
    }
  }

  conversationsById.set(
    candidate.composerId,
    mergeConversations(existing, candidate, source)
  );
}

function buildConversationRecord({
  composerId,
  meta,
  messages,
  source,
  attachmentsSummary,
  skillsReferenced,
  subagentsReferenced,
  sessionContextSignals,
  linkedTranscriptIds,
}) {
  let project = meta.project;
  let workspacePath = meta.workspacePath;
  if (!project || !workspacePath) {
    for (const m of messages) {
      const inferred = inferProjectFromMessageText(m.text);
      if (inferred.project) {
        project = project || inferred.project;
        workspacePath = workspacePath || inferred.workspacePath;
        break;
      }
    }
  }

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const allFiles = new Set();
  const toolsUsed = new Set();
  const allRules = new Set();
  for (const m of messages) {
    for (const f of m.attachedFiles || []) allFiles.add(f);
    addMessageToolsToSet(toolsUsed, m);
    for (const r of m.cursorRules || []) allRules.add(r);
  }

  return {
    composerId,
    name: meta.name,
    project,
    workspacePath,
    mode: meta.mode,
    createdAt: meta.createdAt,
    lastUpdatedAt: meta.lastUpdatedAt,
    subtitle: meta.subtitle,
    linesAdded: meta.linesAdded,
    linesRemoved: meta.linesRemoved,
    filesChanged: meta.filesChanged,
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    filesReferenced: [...allFiles],
    toolsUsed: [...toolsUsed],
    cursorRules: [...allRules],
    skillsReferenced: skillsReferenced || [],
    subagentsReferenced: subagentsReferenced || [],
    sessionContextSignals: sessionContextSignals || [],
    linkedTranscriptIds: linkedTranscriptIds || [],
    attachmentsSummary: attachmentsSummary || {
      hasFiles: false,
      hasImages: false,
      imageCount: 0,
    },
    messages,
    _source: source,
  };
}

/**
 * Build a map of composerId -> { project, workspacePath } from per-workspace state.vscdb files.
 * Each workspace folder has a workspace.json with the folder URI and a state.vscdb
 * with composer.composerData listing all composerIds for that workspace.
 */
function buildWorkspaceMap(stats) {
  const map = new Map();

  let dirs;
  try {
    dirs = fs.readdirSync(WORKSPACE_STORAGE_PATH);
  } catch {
    bumpParseStat(stats, "workspaceStorageDirReadFailed");
    return map;
  }

  for (const dir of dirs) {
    const wsDir = path.join(WORKSPACE_STORAGE_PATH, dir);
    const wsJsonPath = path.join(wsDir, "workspace.json");
    const wsDbPath = path.join(wsDir, "state.vscdb");

    // Read workspace.json to get the folder path
    let folder;
    try {
      const wsJson = JSON.parse(fs.readFileSync(wsJsonPath, "utf8"));
      const folderUri = wsJson.folder || "";
      folder = folderUri.replace("file://", "");
    } catch {
      bumpParseStat(stats, "workspaceJsonInvalid");
      continue;
    }

    if (!folder) continue;
    const project = path.basename(folder);

    // Read composer data from workspace state.vscdb
    let wsDb;
    try {
      wsDb = new Database(wsDbPath, { readonly: true });
    } catch {
      bumpParseStat(stats, "workspaceDbOpenFailed");
      continue;
    }

    try {
      const row = wsDb
        .prepare(
          `SELECT value FROM ItemTable WHERE key = 'composer.composerData'`
        )
        .get();
      if (!row) continue;

      const data = JSON.parse(row.value);
      for (const c of data.allComposers || []) {
        if (c.composerId && c.composerId !== "empty-state-draft") {
          map.set(c.composerId, { project, workspacePath: folder });
        }
      }
    } catch {
      bumpParseStat(stats, "workspaceComposerDataSkipped");
    } finally {
      wsDb.close();
    }
  }

  return map;
}

/**
 * Parse the composer headers from ItemTable.
 * Returns a map of composerId -> conversation metadata.
 */
function parseComposerHeaders(db) {
  const row = db
    .prepare(
      `SELECT value FROM ItemTable WHERE key = 'composer.composerHeaders'`
    )
    .get();
  if (!row) return new Map();

  const data = JSON.parse(row.value);
  const composers = new Map();

  for (const c of data.allComposers) {
    if (c.composerId === "empty-state-draft") continue;

    composers.set(c.composerId, {
      composerId: c.composerId,
      name: c.name || null,
      createdAt: c.createdAt, // epoch ms
      lastUpdatedAt: c.lastUpdatedAt,
      mode: c.unifiedMode || null,
      project: inferProject(c.workspaceIdentifier),
      workspacePath: c.workspaceIdentifier?.uri?.fsPath || null,
      subtitle: c.subtitle || null,
      linesAdded: c.totalLinesAdded || 0,
      linesRemoved: c.totalLinesRemoved || 0,
      filesChanged: c.filesChangedCount || 0,
    });
  }

  return composers;
}

/**
 * Parse all message bubbles from cursorDiskKV.
 * Groups them by composerId.
 * Returns a map of composerId -> sorted array of messages.
 */
function parseBubbles(db, stats) {
  const stmt = db.prepare(
    `SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'`
  );
  const grouped = new Map();

  for (const row of stmt.iterate()) {
    // key format: bubbleId:{composerId}:{bubbleId}
    const parts = row.key.split(":");
    if (parts.length < 3) continue;
    const composerId = parts[1];

    let bubble;
    try {
      bubble = JSON.parse(row.value);
    } catch {
      bumpParseStat(stats, "bubbleRowsJsonSkipped");
      continue;
    }

    const message = {
      bubbleId: bubble.bubbleId || parts[2],
      type: bubble.type, // 1 = user, 2 = assistant
      role: bubble.type === 1 ? "user" : "assistant",
      text: bubble.text || "",
      createdAt: bubble.createdAt || null, // ISO string
      // Files the user attached or were contextually relevant
      attachedFiles: extractFilePaths(bubble.attachedCodeChunks),
      // Cursor rules referenced
      cursorRules: (bubble.cursorRules || []).map((r) => r.name || r).slice(0, 10),
      // Tool usage
      toolName: bubble.toolFormerData?.name || null,
      // Token counts
      inputTokens: bubble.tokenCount?.inputTokens || 0,
      outputTokens: bubble.tokenCount?.outputTokens || 0,
      // MCP servers referenced
      mcpDescriptors: (bubble.mcpDescriptors || []).map((m) => m.name || m).slice(0, 10),
      // Model used for this message
      modelId: bubble.modelId || bubble.modelType || bubble.model || null,
      // Was this an agentic message
      isAgentic: bubble.isAgentic || false,
    };

    if (bubble.type === 2) {
      const extra = enrichAssistantFromBubble(bubble);
      if (extra.thinkingText != null) message.thinkingText = extra.thinkingText;
      if (extra.codeBlockPaths) message.codeBlockPaths = extra.codeBlockPaths;
      if (extra.toolCallsDetailed) {
        message.toolCallsDetailed = extra.toolCallsDetailed;
      }
    }

    if (!grouped.has(composerId)) {
      grouped.set(composerId, []);
    }
    grouped.get(composerId).push(message);
  }

  // Sort each conversation's messages by createdAt
  for (const [, messages] of grouped) {
    messages.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  return grouped;
}

/**
 * Extract file paths from attachedCodeChunks.
 */
function extractFilePaths(chunks) {
  if (!chunks || !Array.isArray(chunks)) return [];
  return chunks
    .map((c) => c.relativeWorkspacePath || c.path || null)
    .filter(Boolean);
}

/**
 * Parse composerData entries from cursorDiskKV.
 * These contain metadata for conversations that may not appear in composerHeaders,
 * especially Agent mode conversations.
 * Returns a map of composerId -> metadata.
 */
function parseComposerData(db, stats) {
  const rows = db
    .prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'`)
    .all();

  const map = new Map();

  for (const row of rows) {
    if (!row.value) continue;
    let parsed;
    try {
      const str =
        typeof row.value === "string"
          ? row.value
          : Buffer.from(row.value).toString("utf8");
      parsed = JSON.parse(str);
    } catch {
      bumpParseStat(stats, "composerDataRowsJsonSkipped");
      continue;
    }

    const composerId =
      parsed.composerId || row.key.replace("composerData:", "");
    if (composerId === "empty-state-draft") continue;

    const fileSelections = parsed.context?.mentions?.fileSelections;
    const inferred = inferProjectFromFileSelections(fileSelections);
    const project = inferred ? inferred.project : null;
    const workspacePath = inferred ? inferred.workspacePath : null;

    map.set(composerId, {
      composerId,
      name: parsed.name || null,
      createdAt: parsed.createdAt || null,
      lastUpdatedAt: parsed.lastUpdatedAt || null,
      mode: parsed.unifiedMode || null,
      project,
      workspacePath,
      subtitle: parsed.subtitle || null,
      linesAdded: parsed.totalLinesAdded || 0,
      linesRemoved: parsed.totalLinesRemoved || 0,
      filesChanged: parsed.filesChangedCount || 0,
      isAgentic: parsed.isAgentic || false,
      modelName: parsed.modelConfig?.modelName || null,
    });
  }

  return map;
}

// ============================================================
// Agent Store: ~/.cursor/chats/<hash>/<chatId>/store.db
// ============================================================

/**
 * Scan ~/.cursor/chats/ for all store.db files.
 * Returns array of { workspace, chatId, dbPath }.
 */
function findAgentStoreChats(stats) {
  const results = [];
  if (!fs.existsSync(AGENT_CHATS_PATH)) return results;

  let workspaces;
  try {
    workspaces = fs.readdirSync(AGENT_CHATS_PATH);
  } catch {
    bumpParseStat(stats, "agentChatsRootListFailed");
    return results;
  }

  for (const workspace of workspaces) {
    const wsDir = path.join(AGENT_CHATS_PATH, workspace);
    let stat;
    try {
      stat = fs.statSync(wsDir);
    } catch {
      bumpParseStat(stats, "agentChatsWorkspaceStatFailed");
      continue;
    }
    if (!stat.isDirectory()) continue;

    let chats;
    try {
      chats = fs.readdirSync(wsDir);
    } catch {
      bumpParseStat(stats, "agentChatsDirListFailed");
      continue;
    }

    for (const chat of chats) {
      const dbPath = path.join(wsDir, chat, "store.db");
      if (fs.existsSync(dbPath)) {
        results.push({ workspace, chatId: chat, dbPath });
      }
    }
  }
  return results;
}

/**
 * Read the meta table from a store.db to get conversation info.
 */
function readStoreMeta(storeDb, stats) {
  let row;
  try {
    row = storeDb.prepare("SELECT value FROM meta WHERE key = ?").get("0");
  } catch {
    bumpParseStat(stats, "storeMetaQueryFailed");
    return null;
  }
  if (!row) return null;
  const decoded = decodeStoreMetaRow(row);
  if (!decoded) {
    bumpParseStat(stats, "storeMetaDecodeFailed");
    return null;
  }
  return decoded;
}

/**
 * Parse a tree blob from the agent store to extract message and child references.
 * Tree blobs use a tag+length+hash format: tag (1 byte) + length 0x20 (1 byte) + 32-byte hash.
 */
function parseTreeBlob(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const messageRefs = [];
  const childRefs = [];
  let offset = 0;
  while (offset < buf.length) {
    if (offset + 34 > buf.length) break;
    const tag = buf[offset];
    const len = buf[offset + 1];
    if (len !== 0x20) break;
    const hash = buf.slice(offset + 2, offset + 2 + 32).toString("hex");
    if (tag === 0x0a) messageRefs.push(hash);
    else if (tag === 0x12) childRefs.push(hash);
    else break;
    offset += 2 + 32;
  }
  return { messageRefs, childRefs };
}

/**
 * Walk the blob tree in a store.db starting from rootBlobId, collecting all messages.
 */
function collectStoreMessages(storeDb, rootBlobId, stats) {
  const allMessages = [];
  const visited = new Set();

  function walk(blobId) {
    if (visited.has(blobId)) return;
    visited.add(blobId);

    let row;
    try {
      row = storeDb.prepare("SELECT data FROM blobs WHERE id = ?").get(blobId);
    } catch {
      bumpParseStat(stats, "storeBlobSelectFailed");
      return;
    }
    if (!row) return;

    const data = row.data;

    // Try parsing as a JSON message first
    try {
      const str =
        typeof data === "string" ? data : Buffer.from(data).toString("utf8");
      const json = JSON.parse(str);
      if (json && json.role) {
        // Extract content
        let text = "";
        if (typeof json.content === "string") {
          text = json.content;
        } else if (Array.isArray(json.content)) {
          text = json.content
            .map((p) => (typeof p === "string" ? p : p.text || ""))
            .join("\n");
        }

        const role =
          json.role === "user"
            ? "user"
            : json.role === "assistant"
              ? "assistant"
              : json.role;

        const toolCallsDetailed = toolCallsFromOpenAiToolCalls(json.tool_calls);
        const toolName = toolCallsDetailed[0]?.name || null;

        const msg = {
          bubbleId: blobId,
          type: role === "user" ? 1 : 2,
          role,
          text,
          createdAt: null,
          attachedFiles: [],
          cursorRules: [],
          toolName,
          inputTokens: 0,
          outputTokens: 0,
          modelId: json.model || null,
          mcpDescriptors: [],
          isAgentic: true,
        };
        if (toolCallsDetailed.length > 0) {
          msg.toolCallsDetailed = toolCallsDetailed;
        }
        allMessages.push(msg);
        return;
      }
    } catch {
      // Not JSON — treat as tree blob
    }

    // Parse as tree blob and recurse
    const { messageRefs, childRefs } = parseTreeBlob(data);
    for (const ref of messageRefs) walk(ref);
    for (const ref of childRefs) walk(ref);
  }

  walk(rootBlobId);
  return allMessages;
}

/**
 * Parse all agent store.db files and return conversations in the same shape
 * as the main parser output.
 */
function parseAgentStoreChats(stats) {
  const conversations = [];
  const storeChats = findAgentStoreChats(stats);

  for (const { chatId, dbPath } of storeChats) {
    let storeDb;
    try {
      storeDb = new Database(dbPath, { readonly: true });
    } catch {
      bumpParseStat(stats, "agentStoreDbOpenFailed");
      continue;
    }

    try {
      const meta = readStoreMeta(storeDb, stats);
      if (!meta) continue;

      const rootBlobId = meta.latestRootBlobId;
      if (!rootBlobId) continue;

      const messages = collectStoreMessages(storeDb, rootBlobId, stats);
      if (messages.length === 0) continue;

      // Filter out system messages
      const filtered = messages.filter(
        (m) => m.role === "user" || m.role === "assistant"
      );
      if (filtered.length === 0) continue;

      const userMessages = filtered.filter((m) => m.role === "user");

      let project = null;
      let workspacePath = null;
      for (const m of filtered) {
        const inf = inferProjectFromMessageText(m.text);
        if (inf.project) {
          project = inf.project;
          workspacePath = inf.workspacePath;
          break;
        }
      }

      // Backfill modelId from store meta lastUsedModel
      const lastUsedModel = meta.lastUsedModel || null;
      if (lastUsedModel) {
        for (const m of filtered) {
          if (m.role === "assistant" && !m.modelId) m.modelId = lastUsedModel;
        }
      }

      const anchorMs =
        meta.createdAt != null ? new Date(meta.createdAt).getTime() : null;
      assignSyntheticMessageTimestamps(filtered, anchorMs);

      const allFiles = new Set();
      const toolsUsed = new Set();
      for (const m of filtered) {
        for (const f of m.attachedFiles) allFiles.add(f);
        addMessageToolsToSet(toolsUsed, m);
      }

      conversations.push({
        composerId: chatId,
        name: meta.name || null,
        project,
        workspacePath,
        mode: meta.mode || "agent",
        createdAt: meta.createdAt
          ? new Date(meta.createdAt).toISOString()
          : filtered[0]?.createdAt || null,
        lastUpdatedAt:
          filtered[filtered.length - 1]?.createdAt || null,
        subtitle: null,
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        messageCount: filtered.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: filtered.length - userMessages.length,
        filesReferenced: [...allFiles],
        toolsUsed: [...toolsUsed],
        cursorRules: [],
        messages: filtered,
        _source: "agent-store",
      });
    } catch {
      bumpParseStat(stats, "agentStoreConversationSkipped");
    } finally {
      storeDb.close();
    }
  }

  return conversations;
}

// ============================================================
// Agent Transcripts: ~/.cursor/projects/<project>/agent-transcripts/
// ============================================================

/**
 * Decode a project directory name back to a folder path.
 * e.g. "Users-barisermut-noisebrief" → "/Users/barisermut/noisebrief"
 */
function decodeProjectDir(dirName) {
  const candidate = "/" + dirName.replace(/-/g, "/");
  if (fs.existsSync(candidate)) return candidate;
  // Handle ambiguity: try splitting at different points
  const parts = dirName.split("-");
  for (let i = 2; i < parts.length; i++) {
    const prefix = "/" + parts.slice(0, i).join("/");
    const suffix = parts.slice(i).join("-");
    const full = path.join(prefix, suffix);
    if (fs.existsSync(full)) return full;
  }
  return candidate;
}

/**
 * Find all agent transcript JSONL files across all projects.
 */
function findAgentTranscripts(stats) {
  const results = [];
  if (!fs.existsSync(AGENT_PROJECTS_PATH)) return results;

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(AGENT_PROJECTS_PATH);
  } catch {
    bumpParseStat(stats, "agentProjectsDirListFailed");
    return results;
  }

  for (const projDir of projectDirs) {
    const transcriptsDir = path.join(
      AGENT_PROJECTS_PATH,
      projDir,
      "agent-transcripts"
    );
    if (!fs.existsSync(transcriptsDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(transcriptsDir);
    } catch {
      bumpParseStat(stats, "agentTranscriptsDirListFailed");
      continue;
    }

    const folder = decodeProjectDir(projDir);
    const project = path.basename(folder);

    for (const entry of entries) {
      const entryPath = path.join(transcriptsDir, entry);

      // Flat pattern: <id>.jsonl
      if (entry.endsWith(".jsonl")) {
        results.push({
          sessionId: entry.replace(".jsonl", ""),
          jsonlPath: entryPath,
          folder,
          project,
        });
        continue;
      }

      // Nested pattern: <id>/<id>.jsonl
      try {
        if (fs.statSync(entryPath).isDirectory()) {
          const nestedJsonl = path.join(entryPath, entry + ".jsonl");
          if (fs.existsSync(nestedJsonl)) {
            results.push({
              sessionId: entry,
              jsonlPath: nestedJsonl,
              folder,
              project,
            });
          }
        }
      } catch {
        bumpParseStat(stats, "agentTranscriptNestedStatFailed");
      }
    }
  }
  return results;
}

/**
 * Parse JSONL transcript files into conversations.
 */
function parseAgentTranscripts(stats) {
  const conversations = [];
  const transcripts = findAgentTranscripts(stats);

  for (const { sessionId, jsonlPath, folder, project } of transcripts) {
    let lines;
    try {
      lines = fs
        .readFileSync(jsonlPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      bumpParseStat(stats, "agentTranscriptFileReadFailed");
      continue;
    }

    const messages = [];
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        bumpParseStat(stats, "agentTranscriptLineJsonSkipped");
        continue;
      }

      if (!entry.role || !entry.message?.content) continue;
      const role = entry.role === "user" ? "user" : "assistant";

      const textChunks = [];
      const attachedForMessage = [];
      const signalSets = {
        skillsReferenced: new Set(),
        subagentsReferenced: new Set(),
        sessionContextSignals: new Set(),
        linkedTranscriptIds: new Set(),
      };
      let hasImages = false;
      if (Array.isArray(entry.message.content)) {
        for (const p of entry.message.content) {
          if (p.type !== "text" || !p.text) continue;
          const raw = p.text;
          for (const fp of extractAttachedFilePathsFromTranscriptText(raw)) {
            attachedForMessage.push(fp);
          }
          const signals = collectTranscriptSignals(raw);
          for (const skill of signals.skillsReferenced) {
            signalSets.skillsReferenced.add(skill);
          }
          for (const subagent of signals.subagentsReferenced) {
            signalSets.subagentsReferenced.add(subagent);
          }
          for (const signal of signals.sessionContextSignals) {
            signalSets.sessionContextSignals.add(signal);
          }
          for (const ref of signals.agentTranscriptRefs) {
            signalSets.linkedTranscriptIds.add(ref);
          }
          hasImages = hasImages || signals.attachmentsSummary.hasImages;
          const t = signals.cleanedText;
          if (t) textChunks.push(t);
        }
      }

      const text = textChunks.join("\n");
      if (!text) continue;

      const uniqueAttached = [...new Set(attachedForMessage)];

      messages.push({
        bubbleId: sessionId + "-" + messages.length,
        type: role === "user" ? 1 : 2,
        role,
        text,
        createdAt: null,
        attachedFiles: uniqueAttached,
        cursorRules: [],
        toolName: null,
        inputTokens: 0,
        outputTokens: 0,
        modelId: null,
        mcpDescriptors: [],
        isAgentic: true,
        skillsReferenced: [...signalSets.skillsReferenced],
        subagentsReferenced: [...signalSets.subagentsReferenced],
        sessionContextSignals: [...signalSets.sessionContextSignals],
        linkedTranscriptIds: [...signalSets.linkedTranscriptIds],
        attachmentsSummary: {
          hasFiles: uniqueAttached.length > 0,
          hasImages,
          imageCount: hasImages ? 1 : 0,
        },
      });
    }

    if (messages.length === 0) continue;

    const userMessages = messages.filter((m) => m.role === "user");

    let createdAt = null;
    let lastUpdatedAt = null;
    try {
      const stat = fs.statSync(jsonlPath);
      createdAt = new Date(stat.birthtimeMs || stat.mtimeMs).toISOString();
      lastUpdatedAt = new Date(stat.mtimeMs).toISOString();
    } catch {
      bumpParseStat(stats, "agentTranscriptFileStatFailed");
    }

    const anchorMs = createdAt ? new Date(createdAt).getTime() : null;
    assignSyntheticMessageTimestamps(messages, anchorMs);

    const allFiles = new Set();
    const skillsReferenced = new Set();
    const subagentsReferenced = new Set();
    const sessionContextSignals = new Set();
    const linkedTranscriptIds = new Set();
    const attachmentsSummary = {
      hasFiles: false,
      hasImages: false,
      imageCount: 0,
    };
    for (const m of messages) {
      for (const f of m.attachedFiles) allFiles.add(f);
      for (const skill of m.skillsReferenced || []) skillsReferenced.add(skill);
      for (const subagent of m.subagentsReferenced || []) {
        subagentsReferenced.add(subagent);
      }
      for (const signal of m.sessionContextSignals || []) {
        sessionContextSignals.add(signal);
      }
      for (const ref of m.linkedTranscriptIds || []) linkedTranscriptIds.add(ref);
      attachmentsSummary.hasFiles =
        attachmentsSummary.hasFiles || m.attachmentsSummary?.hasFiles || false;
      attachmentsSummary.hasImages =
        attachmentsSummary.hasImages || m.attachmentsSummary?.hasImages || false;
      attachmentsSummary.imageCount = Math.max(
        attachmentsSummary.imageCount,
        m.attachmentsSummary?.imageCount || 0
      );
    }

    conversations.push({
      composerId: sessionId,
      name:
        userMessages[0]?.text?.slice(0, 120) || null,
      project: project !== "empty-window" ? project : null,
      workspacePath: folder,
      mode: "agent",
      createdAt,
      lastUpdatedAt,
      subtitle: null,
      linesAdded: 0,
      linesRemoved: 0,
      filesChanged: 0,
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: messages.length - userMessages.length,
      filesReferenced: [...allFiles],
      cursorRules: [],
      toolsUsed: [],
      skillsReferenced: [...skillsReferenced],
      subagentsReferenced: [...subagentsReferenced],
      sessionContextSignals: [...sessionContextSignals],
      linkedTranscriptIds: [...linkedTranscriptIds],
      attachmentsSummary,
      messages,
      _source: "agent-transcript",
    });
  }

  return conversations;
}

/**
 * Build the full parsed output: conversations with metadata + messages.
 *
 * On success, the return value includes `parseStats`: integer counters for silent
 * skips (no message text or paths). Existing fields are unchanged for callers
 * that ignore `parseStats`.
 */
function parse() {
  const parseStats = createParseStats();
  const parserMeta = createParserMeta();
  const db = openDb();

  try {
    const headers = parseComposerHeaders(db);
    const bubbles = parseBubbles(db, parseStats);
    const composerDataMap = parseComposerData(db, parseStats);
    const workspaceMap = buildWorkspaceMap(parseStats);
    parserMeta.sourceSummary.workspaceHeaders = headers.size;
    parserMeta.sourceSummary.bubbleBackedConversations = bubbles.size;

    // Backfill project info from workspace map for headers missing it
    for (const [composerId, meta] of headers) {
      if (!meta.project && workspaceMap.has(composerId)) {
        const ws = workspaceMap.get(composerId);
        meta.project = ws.project;
        meta.workspacePath = ws.workspacePath;
      }
    }

    const conversationsById = new Map();

    // Merge headers with their messages
    for (const [composerId, meta] of headers) {
      const messages = bubbles.get(composerId) || [];

      // Skip conversations with no messages
      if (messages.length === 0) {
        bumpParseStat(parseStats, "workspaceHeadersWithoutMessagesSkipped");
        continue;
      }

      // Enrich from composerData if available
      const cd = composerDataMap.get(composerId);
      if (cd) {
        if (!meta.name && cd.name) meta.name = cd.name;
        if (!meta.mode && cd.mode) meta.mode = cd.mode;
        if (!meta.project && cd.project) {
          meta.project = cd.project;
          meta.workspacePath = cd.workspacePath;
        }
      }

      ingestConversation(
        conversationsById,
        buildConversationRecord({
          composerId,
          meta: {
            ...meta,
            createdAt: meta.createdAt
              ? new Date(meta.createdAt).toISOString()
              : null,
            lastUpdatedAt: meta.lastUpdatedAt
              ? new Date(meta.lastUpdatedAt).toISOString()
              : null,
          },
          messages,
          source: "workspace",
        }),
        "workspace",
        parserMeta,
        parseStats
      );
    }

    // Include conversations that have bubbles but no header entry
    // Use composerData to enrich metadata for these
    for (const [composerId, messages] of bubbles) {
      if (headers.has(composerId)) continue;
      if (messages.length === 0) continue;

      const cd = composerDataMap.get(composerId);
      const ws = workspaceMap.get(composerId);

      // Prefer composerData metadata, fall back to workspace map, then message timestamps
      const project = cd?.project || ws?.project || null;
      const workspacePath = cd?.workspacePath || ws?.workspacePath || null;
      const createdAt = cd?.createdAt
        ? new Date(cd.createdAt).toISOString()
        : messages[0]?.createdAt || null;
      const lastUpdatedAt = cd?.lastUpdatedAt
        ? new Date(cd.lastUpdatedAt).toISOString()
        : messages[messages.length - 1]?.createdAt || null;
      ingestConversation(
        conversationsById,
        buildConversationRecord({
          composerId,
          meta: {
            name: cd?.name || null,
            project,
            workspacePath,
            mode: cd?.mode || null,
            createdAt,
            lastUpdatedAt,
            subtitle: cd?.subtitle || null,
            linesAdded: cd?.linesAdded || 0,
            linesRemoved: cd?.linesRemoved || 0,
            filesChanged: cd?.filesChanged || 0,
          },
          messages,
          source: "workspace",
        }),
        "workspace",
        parserMeta,
        parseStats
      );
    }

    // Source 2: Agent store (~/.cursor/chats/)
    const agentStoreConvs = parseAgentStoreChats(parseStats);
    for (const conv of agentStoreConvs) {
      ingestConversation(
        conversationsById,
        conv,
        "agent-store",
        parserMeta,
        parseStats
      );
    }

    // Source 3: Agent transcripts (~/.cursor/projects/*/agent-transcripts/)
    const agentTranscriptConvs = parseAgentTranscripts(parseStats);
    for (const conv of agentTranscriptConvs) {
      ingestConversation(
        conversationsById,
        conv,
        "agent-transcript",
        parserMeta,
        parseStats
      );
    }

    const conversations = [...conversationsById.values()];
    parserMeta.sourceSummary.canonicalConversations = conversations.length;

    // Backfill modelId from composerData modelConfig, then global preference
    let globalModelPref = null;
    try {
      const prefRow = db
        .prepare("SELECT value FROM ItemTable WHERE key = 'cursor/lastSingleModelPreference'")
        .get();
      if (prefRow) {
        const pref = JSON.parse(prefRow.value);
        globalModelPref = pref.composer || pref.agent || null;
      }
    } catch {
      bumpParseStat(parseStats, "globalModelPreferenceParseFailed");
    }

    for (const c of conversations) {
      if (c._source === "agent-store") continue; // already handled via lastUsedModel
      // Prefer per-conversation model from composerData, fall back to global pref
      const cd = composerDataMap.get(c.composerId);
      const modelFallback = (cd?.modelName && cd.modelName !== "default")
        ? cd.modelName
        : globalModelPref;
      if (modelFallback) {
        for (const m of c.messages) {
          if (m.role === "assistant" && !m.modelId) m.modelId = modelFallback;
        }
      }
      c.completenessFlags = c.completenessFlags || {};
      c.completenessFlags.hasModels = c.messages.some(
        (m) => m.role === "assistant" && !!m.modelId
      );
    }

    // Sort by createdAt descending (most recent first)
    conversations.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });

    return {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((s, c) => s + c.messageCount, 0),
      projects: [...new Set(conversations.map((c) => c.project).filter(Boolean))],
      conversations,
      parseStats,
      parserMeta,
    };
  } finally {
    db.close();
  }
}

module.exports = { parse, createParseStats };

// When run directly, output summary JSON
if (require.main === module) {
  const result = parse();

  // For console verification, output a summary (not all message text)
  const summary = {
    totalConversations: result.totalConversations,
    totalMessages: result.totalMessages,
    projects: result.projects,
    conversations: result.conversations.map((c) => ({
      composerId: c.composerId,
      name: c.name,
      project: c.project,
      workspacePath: c.workspacePath,
      mode: c.mode,
      createdAt: c.createdAt,
      lastUpdatedAt: c.lastUpdatedAt,
      linesAdded: c.linesAdded,
      linesRemoved: c.linesRemoved,
      filesChanged: c.filesChanged,
      messageCount: c.messageCount,
      userMessageCount: c.userMessageCount,
      assistantMessageCount: c.assistantMessageCount,
      filesReferenced: c.filesReferenced.slice(0, 5),
      toolsUsed: c.toolsUsed.slice(0, 10),
      cursorRules: c.cursorRules,
      // Show first user message as preview
      firstUserMessage:
        c.messages.find((m) => m.role === "user")?.text?.slice(0, 150) || "",
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("parseStats=" + JSON.stringify(result.parseStats));
}
