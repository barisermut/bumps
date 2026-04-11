/**
 * Fill missing per-message `createdAt` (ISO string) with monotonic timestamps
 * so ordering and time-range filters behave predictably for agent sources.
 *
 * @param {Array<{ createdAt?: string|null }>} messages - in conversation order; mutated in place
 * @param {number|null|undefined} anchorMs - epoch ms for first synthetic stamp (e.g. session meta)
 */
function assignSyntheticMessageTimestamps(messages, anchorMs) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  let base =
    anchorMs != null && Number.isFinite(anchorMs) ? anchorMs : Date.now();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.createdAt) {
      const t = new Date(m.createdAt).getTime();
      if (Number.isFinite(t)) base = Math.max(base, t + 1);
      continue;
    }
    m.createdAt = new Date(base).toISOString();
    base += 1;
  }
}

module.exports = {
  assignSyntheticMessageTimestamps,
};
