import { SEVERITY, severityColor } from '../lib/severityColors'

const SEVERITY_LABEL = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }

/**
 * @param {{
 *   insights: Array<{ id: string; severity: string; title: string; diagnosis: string; guidance: string }> | undefined;
 * }} props
 */
export default function MentorInsightsSection({ insights }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-900/90 p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          AI INSIGHTS
        </h2>
        <p className="text-[12px] text-text-muted">
          Cross-session patterns worth your attention.
        </p>
      </div>

      {!insights || insights.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">
          No insights for this period.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.slice(0, 6).map((ins) => {
            const sev =
              ins.severity === 'high' || ins.severity === 'medium' || ins.severity === 'low'
                ? ins.severity
                : 'low'
            const dot = severityColor(sev)
            const chipColor = dot
            return (
              <article
                key={ins.id}
                className="rounded-xl border border-border-subtle bg-surface-800/30 p-5 flex flex-col gap-2 min-h-[7rem] transition-colors hover:border-border/80 hover:bg-surface-800/50"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: dot }}
                  />
                  <h3 className="text-sm font-semibold text-text-primary min-w-0 flex-1 truncate">
                    {ins.title}
                  </h3>
                  <span
                    className="shrink-0 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full tabular-nums"
                    style={{
                      color: chipColor,
                      backgroundColor: `color-mix(in oklch, ${chipColor} 14%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${chipColor} 30%, transparent)`,
                    }}
                  >
                    {SEVERITY_LABEL[sev]}
                  </span>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-2">
                  {ins.diagnosis}
                </p>
                <div
                  className="mt-3 border-l-2 pl-3 py-1 rounded-r-md"
                  style={{
                    borderColor: SEVERITY.medium,
                    backgroundColor: `color-mix(in oklch, ${SEVERITY.medium} 8%, transparent)`,
                  }}
                >
                  <p className="text-[12px] text-text-secondary leading-relaxed">
                    {ins.guidance}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
