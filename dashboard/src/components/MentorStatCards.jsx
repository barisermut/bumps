function StripMetric({ value, label, sub }) {
  return (
    <div className="min-w-0 px-4 py-3 min-h-[4.5rem] flex flex-col justify-center">
      <p
        className="text-[11px] text-text-muted/80 uppercase tracking-wide font-medium mb-1 truncate"
        title={label}
      >
        {label}
      </p>
      <p className="text-lg font-semibold text-text-primary tabular-nums leading-tight">
        {value}
      </p>
      {sub ? (
        <p className="text-[11px] text-text-muted mt-1 leading-snug truncate" title={sub}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ stats: { totalSessions: number; totalMessages: number; avgSessionMinutes: number; frustrationPercent: number } | null | undefined }} props
 */
export default function MentorStatCards({ stats }) {
  const dash = '—'
  const sessions = stats?.totalSessions ?? null
  const messages = stats?.totalMessages ?? null
  const avgMin = stats?.avgSessionMinutes ?? null
  const frustr = stats?.frustrationPercent ?? null

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-xl border border-border-subtle bg-surface-900/50 divide-x divide-y divide-border-subtle/15 overflow-hidden">
      <StripMetric
        value={sessions == null ? dash : String(sessions)}
        label="Total sessions analyzed"
      />
      <StripMetric
        value={messages == null ? dash : messages.toLocaleString()}
        label="Total messages sent"
      />
      <StripMetric
        value={avgMin == null ? dash : avgMin === 0 ? '0 min' : `${avgMin} min`}
        label="Avg time per session"
      />
      <StripMetric
        value={frustr == null ? dash : `${frustr}%`}
        label="% sessions showing frustration"
      />
    </section>
  )
}
