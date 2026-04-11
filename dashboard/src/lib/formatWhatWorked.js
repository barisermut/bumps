/**
 * Display-only rewrites for What Worked API strings (same numbers, warmer copy).
 * Shapes are produced by src/analyzer.js — keep regexes in sync if those change.
 */

const FAST_PROMPT_LINE_RE =
  /^(.+?)\s+prompts\s+\(avg\s+([\d.]+)\s+follow-ups?,\s+(\d+)\s+sessions?\)$/i

const MCP_LINE_RE = /^(.+?)\s+—\s+used in\s+(\d+)\s+sessions?$/i
const ACTIVE_TOOL_LINE_RE =
  /^(.+?)\s+—\s+avg\s+([\d.]+)\s+follow-ups?\s+across\s+(\d+)\s+sessions?$/i

function joinNatural(parts) {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

/**
 * Parse classifyPrompt() output (space-separated trait tokens).
 */
function parseClassifyPattern(pattern) {
  const flags = {
    length: /** @type {'short' | 'medium' | 'long' | null} */ (null),
    code: false,
    imperative: false,
    question: false,
    files: false,
  }
  const src = pattern.trim()
  if (/^Short\b/.test(src)) flags.length = 'short'
  else if (/^Medium\b/.test(src)) flags.length = 'medium'
  else if (/^Long\b/.test(src)) flags.length = 'long'

  flags.code = /\bwith code blocks\b/.test(src)
  flags.imperative = /\bimperative\b/.test(src)
  flags.question = /\bquestion\b/.test(src)
  flags.files = /\bwith file refs\b/.test(src)

  return flags
}

function patternToReadableLead(pattern) {
  const flags = parseClassifyPattern(pattern)
  const len =
    flags.length === 'short'
      ? 'short'
      : flags.length === 'medium'
        ? 'medium-length'
        : flags.length === 'long'
          ? 'long'
          : null

  const noun = flags.question ? 'questions' : 'prompts'

  const extras = []
  if (flags.code) extras.push('inline code')
  if (flags.files) extras.push('file references')
  if (flags.imperative) extras.push('a direct, task-first opener')

  let core
  if (len) {
    core = `${len} ${noun}`
  } else {
    core = flags.question ? 'these questions' : 'these prompts'
  }

  if (extras.length === 1) {
    core += ` including ${extras[0]}`
  } else if (extras.length > 1) {
    core += ` including ${joinNatural(extras)}`
  }

  return `When you opened with ${core}, threads tended to stay lean`
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function formatFastPromptPatternLine(raw) {
  const m = raw.match(FAST_PROMPT_LINE_RE)
  if (!m) return raw
  const [, pattern, avg, sessions] = m
  const lead = patternToReadableLead(pattern.trim())
  return `${lead} — avg ${avg} follow-ups across ${sessions} sessions`
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function formatMcpServerLine(raw) {
  const m = raw.match(MCP_LINE_RE)
  if (!m) return raw
  const name = m[1].trim()
  const n = parseInt(m[2], 10)
  const sessWord = n === 1 ? 'session' : 'sessions'
  return `You used ${name} in ${n} ${sessWord} this range.`
}

export function formatActiveToolLine(raw) {
  const m = raw.match(ACTIVE_TOOL_LINE_RE)
  if (!m) return raw
  const [, name, avg, sessions] = m
  return `${name} showed up in smoother threads — avg ${avg} follow-ups across ${sessions} sessions`
}

/**
 * @param {'fastPromptPatterns' | 'mcpServers' | string} categoryKey
 * @param {string} raw
 * @returns {string}
 */
export function formatWhatWorkedFinding(categoryKey, raw) {
  if (categoryKey === 'fastPromptPatterns') return formatFastPromptPatternLine(raw)
  if (categoryKey === 'mcpServers') return formatMcpServerLine(raw)
  if (categoryKey === 'activeTools') return formatActiveToolLine(raw)
  return raw
}
