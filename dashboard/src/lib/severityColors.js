/** Same signal system as Your Bumps bars — red / amber / green (muted low). */
export const SEVERITY = {
  high: 'oklch(0.65 0.18 25)',
  medium: 'oklch(0.74 0.14 65)',
  low: 'oklch(0.60 0.10 155)',
}

export const CHART_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const TEXT_PRIMARY_CHART = 'oklch(0.93 0.01 75)'
export const TEXT_MUTED_CHART = 'oklch(0.48 0.012 55)'

/** @param {'low'|'medium'|'high'} severity */
export function severityColor(severity) {
  if (severity === 'high') return SEVERITY.high
  if (severity === 'medium') return SEVERITY.medium
  return SEVERITY.low
}
