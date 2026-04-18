/**
 * Map server fallback.reason to short user-facing explanation (banner body).
 * @param {string | null | undefined} reason
 */
export function mentorFallbackMessage(reason) {
  const r = String(reason || '')
  if (r === 'mentor_disabled') {
    return 'Mentor mode is off. Showing Mirror view.'
  }
  if (r === 'agent_missing') {
    return 'Cursor Agent CLI isn’t installed. Showing Mirror view. Run `agent --help` to verify installation.'
  }
  if (r === 'stream_timeout_30s') {
    return 'Mentor stopped receiving data. Try running again.'
  }
  if (r === 'invalid_json' || r === 'validation_empty') {
    return 'Mentor analysis couldn’t produce a valid result. Showing Mirror view.'
  }
  if (
    r.startsWith('agent_exit_') ||
    r === 'agent_spawn_error' ||
    r === 'unexpected_error'
  ) {
    return 'Mentor analysis failed. Showing Mirror view.'
  }
  if (r.startsWith('validation_warnings:')) {
    return 'Mentor analysis completed with warnings.'
  }
  return 'Mentor analysis isn’t available for this view. Showing Mirror view.'
}
