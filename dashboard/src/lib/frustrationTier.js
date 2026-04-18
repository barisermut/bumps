/** @param {number} pct */
export function frustrationTier(pct) {
  if (pct < 20) return 'low'
  if (pct <= 40) return 'medium'
  return 'high'
}
