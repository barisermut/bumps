const path = require("path");
const os = require("os");
const { fileURLToPath } = require("url");

/** Container folders we should never treat as projects. */
const HARD_SKIP_PROJECT_NAMES = new Set([
  "Desktop",
  "Downloads",
  "Documents",
  "Library",
  "Applications",
  ".Trash",
  ".cursor",
]);

/** Generic containers we skip through to reach the real repo name. */
const SOFT_SKIP_PROJECT_NAMES = new Set([
  "projects",
  "code",
  "repos",
  "workspace",
]);

function shouldSkipProjectSegment(name) {
  if (!name || name.startsWith(".")) return true;
  return (
    HARD_SKIP_PROJECT_NAMES.has(name) || SOFT_SKIP_PROJECT_NAMES.has(name)
  );
}

function isHardSkipProjectSegment(name) {
  if (!name || name.startsWith(".")) return true;
  return HARD_SKIP_PROJECT_NAMES.has(name);
}

/**
 * Resolve a key from composerData fileSelections to an absolute filesystem path.
 * @param {string} uriKey - Often a file:// URL; may be other shapes from Cursor.
 * @returns {string|null}
 */
function fileSelectionKeyToAbsolutePath(uriKey) {
  if (!uriKey || typeof uriKey !== "string") return null;
  const trimmed = uriKey.trim();
  if (trimmed.startsWith("file:")) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function pickProjectFromRelativePath(relPath) {
  if (!relPath || typeof relPath !== "string") return null;
  const segments = relPath.split(path.sep).filter(Boolean);
  if (segments.length === 0) return null;
  if (isHardSkipProjectSegment(segments[0])) return null;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const looksLikeFile = isLast && /\.[A-Za-z0-9]{1,10}$/.test(seg);
    if (looksLikeFile) continue;
    if (!seg || shouldSkipProjectSegment(seg)) continue;
    const workspacePath = path.join(os.homedir(), ...segments.slice(0, i + 1));
    return { project: seg, workspacePath };
  }
  return null;
}

/**
 * Pick project folder (first segment under user home) from composerData fileSelections.
 * @param {Record<string, unknown>} fileSelections
 * @returns {{ project: string, workspacePath: string } | null}
 */
function inferProjectFromFileSelections(fileSelections) {
  if (!fileSelections || typeof fileSelections !== "object") return null;

  const home = os.homedir();
  if (!home) return null;

  for (const uriKey of Object.keys(fileSelections)) {
    const abs = fileSelectionKeyToAbsolutePath(uriKey);
    if (!abs) continue;
    let rel = path.relative(home, abs);
    if (!rel || rel.startsWith("..")) continue;
    const inferred = pickProjectFromRelativePath(rel);
    if (inferred) return inferred;
  }
  return null;
}

/**
 * Infer project from free text (e.g. agent message) by finding the user home prefix
 * and taking the first path segment after it. Works for Unix and Windows home paths.
 * @returns {{ project: string|null, workspacePath: string|null }}
 */
function inferProjectFromMessageText(text) {
  if (!text || typeof text !== "string") {
    return { project: null, workspacePath: null };
  }

  const home = os.homedir();
  if (!home) return { project: null, workspacePath: null };

  const normText = text.replace(/\\/g, "/");
  const normHome = home.replace(/\\/g, "/");

  let idx = normText.indexOf(normHome);
  if (idx === -1) {
    const lower = normText.toLowerCase();
    const lowerHome = normHome.toLowerCase();
    const j = lower.indexOf(lowerHome);
    if (j === -1) return { project: null, workspacePath: null };
    idx = j;
  }

  let rest = normText.slice(idx + normHome.length).replace(/^\/+/, "");
  const pathLikePrefix = rest.match(/^[^\s"'`),;]+/);
  if (!pathLikePrefix) return { project: null, workspacePath: null };
  rest = pathLikePrefix[0].replace(/[.:!?]+$/, "");
  const inferred = pickProjectFromRelativePath(rest.replace(/\//g, path.sep));
  if (!inferred) return { project: null, workspacePath: null };
  return inferred;
}

module.exports = {
  shouldSkipProjectSegment,
  isHardSkipProjectSegment,
  pickProjectFromRelativePath,
  fileSelectionKeyToAbsolutePath,
  inferProjectFromFileSelections,
  inferProjectFromMessageText,
  HARD_SKIP_PROJECT_NAMES,
  SOFT_SKIP_PROJECT_NAMES,
};
