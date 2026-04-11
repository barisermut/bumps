/** Shown under empty-state titles when filters likely caused zero results */
export const FILTER_EMPTY_HINT =
  'Try All time or another project from the filters above.'

const PLACEHOLDER_BUMP =
  'Not enough data to identify patterns yet.'

/**
 * True when the filtered scope has no analyzable session signal (matches
 * server emptyInsights: zero conversations, or equivalent sparse payload).
 */
export function noSessionsInRange(insights) {
  if (!insights) return false
  const bumps = insights.bumps
  const sd = insights.scopeDrift
  const ph = insights.promptHabits
  const noBumps = !Array.isArray(bumps) || bumps.length === 0
  const noDrift = !Array.isArray(sd) || sd.length === 0
  const shortZ =
    !ph?.short ||
    (ph.short.avgMessages === 0 && ph.short.avgResolution === 0)
  const longZ =
    !ph?.long || (ph.long.avgMessages === 0 && ph.long.avgResolution === 0)
  return noBumps && noDrift && shortZ && longZ
}

export function isPlaceholderBiggestBump(text) {
  return typeof text === 'string' && text.trim() === PLACEHOLDER_BUMP
}
