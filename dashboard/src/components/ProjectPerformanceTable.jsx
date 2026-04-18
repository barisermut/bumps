import { severityColor } from '../lib/severityColors'
import { frustrationTier } from '../lib/frustrationTier'
import WidgetEmptyState from './WidgetEmptyState'

function formatProjectCell(name) {
  return String(name || '').replace(/[_-]+/g, ' ').trim() || '—'
}

/**
 * @param {{
 *   rows: Array<{ project: string; sessions: number; messages: number; avgTimeMinutes: number; frustrationPercent: number }> | undefined;
 * }} props
 */
export default function ProjectPerformanceTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3">
        <h2 className="font-display text-base text-text-primary">Project performance</h2>
        <WidgetEmptyState
          title="No project rows yet"
          hint="Mentor will fill this table when analysis finishes."
        />
      </section>
    )
  }

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 overflow-x-auto">
      <h2 className="font-display text-base text-text-primary">Project performance</h2>
      <table className="w-full text-left text-[13px] border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wide text-text-muted">
            <th className="py-2 pr-4 font-medium">Project</th>
            <th className="py-2 pr-4 font-medium tabular-nums">Sessions</th>
            <th className="py-2 pr-4 font-medium tabular-nums">Messages</th>
            <th className="py-2 pr-4 font-medium">Avg time</th>
            <th className="py-2 font-medium">Frustration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tier = frustrationTier(r.frustrationPercent)
            const c = severityColor(tier)
            return (
              <tr
                key={r.project}
                className="border-b border-border-subtle/50 last:border-0"
              >
                <td className="py-2.5 pr-4 text-text-primary font-medium">
                  {formatProjectCell(r.project)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-text-secondary">
                  {r.sessions}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-text-secondary">
                  {r.messages}
                </td>
                <td className="py-2.5 pr-4 text-text-secondary tabular-nums">
                  {r.avgTimeMinutes === 0 ? '0m' : `${r.avgTimeMinutes}m`}
                </td>
                <td className="py-2.5">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums"
                    style={{
                      color: c,
                      backgroundColor: `color-mix(in oklch, ${c} 14%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${c} 30%, transparent)`,
                    }}
                  >
                    {r.frustrationPercent}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
