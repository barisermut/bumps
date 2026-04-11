const SOURCE_PRIORITY = {
  workspace: 3,
  "agent-store": 2,
  "agent-transcript": 1,
};

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function countTruthy(values) {
  return values.filter(Boolean).length;
}

function pickPreferred(current, incoming, preferIncoming = false) {
  if (preferIncoming) return incoming ?? current ?? null;
  return current ?? incoming ?? null;
}

function chooseMessages(baseMessages, incomingMessages) {
  if (!Array.isArray(baseMessages) || baseMessages.length === 0) {
    return incomingMessages || [];
  }
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return baseMessages;
  }

  const baseScore = baseMessages.reduce(
    (sum, m) =>
      sum +
      countTruthy([
        m.text,
        m.toolName,
        (m.toolCallsDetailed || []).length > 0,
        (m.cursorRules || []).length > 0,
        (m.mcpDescriptors || []).length > 0,
        m.modelId,
      ]),
    0
  );
  const incomingScore = incomingMessages.reduce(
    (sum, m) =>
      sum +
      countTruthy([
        m.text,
        m.toolName,
        (m.toolCallsDetailed || []).length > 0,
        (m.cursorRules || []).length > 0,
        (m.mcpDescriptors || []).length > 0,
        m.modelId,
      ]),
    0
  );

  return incomingScore > baseScore ? incomingMessages : baseMessages;
}

function buildCompletenessFlags(conversation) {
  const messages = conversation.messages || [];
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  return {
    hasMessages: messages.length > 0,
    hasUserText: messages.some((m) => m.role === "user" && m.text),
    hasAssistantText: assistantMessages.some((m) => m.text),
    hasFiles: (conversation.filesReferenced || []).length > 0,
    hasTools: (conversation.toolsUsed || []).length > 0,
    hasRules: (conversation.cursorRules || []).length > 0,
    hasModels: assistantMessages.some((m) => m.modelId),
    hasTranscriptSignals:
      (conversation.sessionContextSignals || []).length > 0 ||
      (conversation.skillsReferenced || []).length > 0 ||
      (conversation.subagentsReferenced || []).length > 0,
    hasSourceOverlap: (conversation.sourceCoverage?.sourceCount || 0) > 1,
  };
}

function createSourceCoverage(source) {
  return {
    workspace: source === "workspace",
    agentStore: source === "agent-store",
    agentTranscript: source === "agent-transcript",
    sourceCount: 1,
    sourceOrder: [source],
  };
}

function normalizeConversation(candidate, source) {
  const conversation = {
    ...candidate,
    _source: source,
    toolsUsed: unique(candidate.toolsUsed),
    cursorRules: unique(candidate.cursorRules),
    filesReferenced: unique(candidate.filesReferenced),
    skillsReferenced: unique(candidate.skillsReferenced),
    subagentsReferenced: unique(candidate.subagentsReferenced),
    sessionContextSignals: unique(candidate.sessionContextSignals),
    linkedTranscriptIds: unique(candidate.linkedTranscriptIds),
    sourceCoverage: createSourceCoverage(source),
  };
  conversation.completenessFlags = buildCompletenessFlags(conversation);
  return conversation;
}

function mergeConversations(existing, incoming, source) {
  const normalizedIncoming = normalizeConversation(incoming, source);
  const merged = {
    ...existing,
    name: pickPreferred(existing.name, normalizedIncoming.name),
    project: pickPreferred(existing.project, normalizedIncoming.project),
    workspacePath: pickPreferred(
      existing.workspacePath,
      normalizedIncoming.workspacePath
    ),
    mode: pickPreferred(existing.mode, normalizedIncoming.mode),
    createdAt: pickPreferred(existing.createdAt, normalizedIncoming.createdAt),
    lastUpdatedAt: pickPreferred(
      existing.lastUpdatedAt,
      normalizedIncoming.lastUpdatedAt,
      true
    ),
    subtitle: pickPreferred(existing.subtitle, normalizedIncoming.subtitle),
    linesAdded: Math.max(existing.linesAdded || 0, normalizedIncoming.linesAdded || 0),
    linesRemoved: Math.max(
      existing.linesRemoved || 0,
      normalizedIncoming.linesRemoved || 0
    ),
    filesChanged: Math.max(
      existing.filesChanged || 0,
      normalizedIncoming.filesChanged || 0
    ),
    messages: chooseMessages(existing.messages, normalizedIncoming.messages),
    filesReferenced: unique([
      ...(existing.filesReferenced || []),
      ...(normalizedIncoming.filesReferenced || []),
    ]),
    toolsUsed: unique([
      ...(existing.toolsUsed || []),
      ...(normalizedIncoming.toolsUsed || []),
    ]),
    cursorRules: unique([
      ...(existing.cursorRules || []),
      ...(normalizedIncoming.cursorRules || []),
    ]),
    skillsReferenced: unique([
      ...(existing.skillsReferenced || []),
      ...(normalizedIncoming.skillsReferenced || []),
    ]),
    subagentsReferenced: unique([
      ...(existing.subagentsReferenced || []),
      ...(normalizedIncoming.subagentsReferenced || []),
    ]),
    sessionContextSignals: unique([
      ...(existing.sessionContextSignals || []),
      ...(normalizedIncoming.sessionContextSignals || []),
    ]),
    linkedTranscriptIds: unique([
      ...(existing.linkedTranscriptIds || []),
      ...(normalizedIncoming.linkedTranscriptIds || []),
    ]),
    attachmentsSummary: {
      hasFiles:
        existing.attachmentsSummary?.hasFiles ||
        normalizedIncoming.attachmentsSummary?.hasFiles ||
        false,
      hasImages:
        existing.attachmentsSummary?.hasImages ||
        normalizedIncoming.attachmentsSummary?.hasImages ||
        false,
      imageCount: Math.max(
        existing.attachmentsSummary?.imageCount || 0,
        normalizedIncoming.attachmentsSummary?.imageCount || 0
      ),
    },
    sourceCoverage: {
      workspace:
        existing.sourceCoverage?.workspace ||
        normalizedIncoming.sourceCoverage.workspace,
      agentStore:
        existing.sourceCoverage?.agentStore ||
        normalizedIncoming.sourceCoverage.agentStore,
      agentTranscript:
        existing.sourceCoverage?.agentTranscript ||
        normalizedIncoming.sourceCoverage.agentTranscript,
      sourceOrder: unique([
        ...(existing.sourceCoverage?.sourceOrder || []),
        ...normalizedIncoming.sourceCoverage.sourceOrder,
      ]),
      sourceCount: 0,
    },
  };

  merged.sourceCoverage.sourceCount = countTruthy([
    merged.sourceCoverage.workspace,
    merged.sourceCoverage.agentStore,
    merged.sourceCoverage.agentTranscript,
  ]);

  const messageCount = merged.messages?.length || 0;
  const userMessageCount =
    merged.messages?.filter((m) => m.role === "user").length || 0;
  merged.messageCount = messageCount;
  merged.userMessageCount = userMessageCount;
  merged.assistantMessageCount = Math.max(0, messageCount - userMessageCount);

  if (
    SOURCE_PRIORITY[normalizedIncoming._source] > SOURCE_PRIORITY[existing._source]
  ) {
    merged._source = normalizedIncoming._source;
  }

  merged.completenessFlags = buildCompletenessFlags(merged);
  return merged;
}

module.exports = {
  normalizeConversation,
  mergeConversations,
};
