import WidgetEmptyState from './WidgetEmptyState'
import { SEVERITY } from '../lib/severityColors'

const MUTED_BAR = 'oklch(0.48 0.012 55)'

/**
 * @param {{
 *   patterns: Array<{ name: string; percentage: number }> | undefined;
 * }} props
 */
export default function TopPatterns({ patterns }) {
  if (!patterns || patterns.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 flex flex-col gap-3 min-h-[14rem]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
          TOP PATTERNS
        </h2>
        <WidgetEmptyState
          title="No patterns yet"
          hint="No patterns in this period."
          className="flex-1"
        />
      </section>
    )
  }

  const sorted = [...patterns].sort((a, b) => b.percentage - a.percentage)
  const total = sorted.length
  const top = sorted.slice(0, 5).map((p) => ({
    name: p.name.length > 42 ? `${p.name.slice(0, 40)}…` : p.name,
    percentage: p.percentage,
  }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 pt-4 flex flex-col gap-3 min-w-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
        TOP PATTERNS
      </h2>
      <ul role="list" className="divide-y divide-border-subtle/40 min-w-0">
        {top.map((p, rank) => (
          <li
            key={`${p.name}-${rank}`}
            className="flex items-center gap-3 py-2.5 first:pt-0 min-w-0"
          >
            <span className="text-[13px] text-text-primary truncate min-w-0 flex-1">
              {p.name}
            </span>
            <div className="relative h-1.5 w-32 shrink-0 rounded-full bg-surface-800 overflow-hidden">
              <div
                className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-border-subtle/40"
                aria-hidden
              />
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full"
                style={{
                  width: `${p.percentage}%`,
                  backgroundColor: rank === 0 ? SEVERITY.medium : MUTED_BAR,
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-text-muted">
              {p.percentage}%
            </span>
          </li>
        ))}
      </ul>
      {total > 5 ? (
        <p className="text-[11px] text-text-muted mt-2">+{total - 5} more</p>
      ) : null}
    </section>
  )
}
