/**
 * Integer-only counters for resilient parse paths (no message text or paths).
 * Returned as `parseStats` on the object from `parse()`.
 *
 * @typedef {Object} ParseStats
 * @property {number} workspaceStorageDirReadFailed
 * @property {number} workspaceJsonInvalid
 * @property {number} workspaceDbOpenFailed
 * @property {number} workspaceComposerDataSkipped
 * @property {number} bubbleRowsJsonSkipped
 * @property {number} composerDataRowsJsonSkipped
 * @property {number} agentChatsRootListFailed
 * @property {number} agentChatsWorkspaceStatFailed
 * @property {number} agentChatsDirListFailed
 * @property {number} agentStoreDbOpenFailed
 * @property {number} agentStoreConversationSkipped
 * @property {number} storeMetaQueryFailed
 * @property {number} storeMetaDecodeFailed
 * @property {number} storeBlobSelectFailed
 * @property {number} agentProjectsDirListFailed
 * @property {number} agentTranscriptsDirListFailed
 * @property {number} agentTranscriptNestedStatFailed
 * @property {number} agentTranscriptFileReadFailed
 * @property {number} agentTranscriptLineJsonSkipped
 * @property {number} agentTranscriptFileStatFailed
 * @property {number} globalModelPreferenceParseFailed
 * @property {number} workspaceHeadersWithoutMessagesSkipped
 * @property {number} agentStoreOverlapsMerged
 * @property {number} agentTranscriptOverlapsMerged
 */

const KEYS = [
  "workspaceStorageDirReadFailed",
  "workspaceJsonInvalid",
  "workspaceDbOpenFailed",
  "workspaceComposerDataSkipped",
  "bubbleRowsJsonSkipped",
  "composerDataRowsJsonSkipped",
  "agentChatsRootListFailed",
  "agentChatsWorkspaceStatFailed",
  "agentChatsDirListFailed",
  "agentStoreDbOpenFailed",
  "agentStoreConversationSkipped",
  "storeMetaQueryFailed",
  "storeMetaDecodeFailed",
  "storeBlobSelectFailed",
  "agentProjectsDirListFailed",
  "agentTranscriptsDirListFailed",
  "agentTranscriptNestedStatFailed",
  "agentTranscriptFileReadFailed",
  "agentTranscriptLineJsonSkipped",
  "agentTranscriptFileStatFailed",
  "globalModelPreferenceParseFailed",
  "workspaceHeadersWithoutMessagesSkipped",
  "agentStoreOverlapsMerged",
  "agentTranscriptOverlapsMerged",
];

function createParseStats() {
  /** @type {ParseStats} */
  const stats = {};
  for (const k of KEYS) stats[k] = 0;
  return stats;
}

/**
 * @param {ParseStats|null|undefined} stats
 * @param {keyof ParseStats} key
 */
function bumpParseStat(stats, key) {
  if (!stats) return;
  if (Object.prototype.hasOwnProperty.call(stats, key)) stats[key]++;
}

module.exports = {
  createParseStats,
  bumpParseStat,
  /** @type {readonly string[]} */
  PARSE_STATS_KEYS: KEYS,
};
