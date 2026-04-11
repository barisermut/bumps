/**
 * Extract filesystem paths from Cursor agent transcript markup inside user text.
 * @param {string} rawText
 * @returns {string[]}
 */
function extractAttachedFilePathsFromTranscriptText(rawText) {
  if (!rawText || typeof rawText !== "string") return [];

  const block = rawText.match(/<attached_files>([\s\S]*?)<\/attached_files>/i);
  if (!block) return [];

  const inner = block[1];
  const paths = [];
  const re = /path="([^"]+)"/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    if (m[1]) paths.push(m[1]);
  }
  return paths;
}

module.exports = {
  extractAttachedFilePathsFromTranscriptText,
};
