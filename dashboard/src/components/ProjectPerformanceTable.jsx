import { useMemo, useState } from 'react'
import { severityColor } from '../lib/severityColors'
import { frustrationTier } from '../lib/frustrationTier'
import WidgetEmptyState from './WidgetEmptyState'
import Modal from './Modal'

const TIER_LABEL = { low: 'Low', medium: 'Med', high: 'High' }

function formatProjectCell(name) {
  const s = String(name || '').replace(/[_-]+/g, ' ').trim()
  if (!s) return '—'
  return s[0].toUpperCase() + s.slice(1)
}

function normalizeProjectKey(p) {
  return String(p || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * @param {{
 *   rows: Array<{ project: string; sessions: number; messages: number; avgTimeMinutes: number; frustrationPercent: number }> | undefined;
 *   insights: Array<{ project: string; insight?: string }> | undefined;
 * }} props
 */
export default function ProjectPerformanceTable({ rows, insights }) {
  const [active, setActive] = useState(null)

  const insightMap = useMemo(() => {
    const m = new Map()
    for (const p of insights || []) {
      if (
        p?.project &&
        typeof p.insight === 'string' &&
        p.insight.trim()
      ) {
        m.set(normalizeProjectKey(p.project), p.insight.trim())
      }
    }
    return m
  }, [insights])

  if (!rows || rows.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
          PROJECT PERFORMANCE
        </h2>
        <WidgetEmptyState
          title="No project rows yet"
          hint="No project activity in this period."
        />
      </section>
    )
  }

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 pt-4 flex flex-col gap-3 overflow-x-auto">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
        PROJECT PERFORMANCE
      </h2>
      <table className="w-full text-left text-[13px] border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-border-subtle text-[11px] tracking-wide text-text-muted">
            <th className="py-2 pr-4 font-medium whitespace-nowrap">Project</th>
            <th className="py-2 pr-4 font-medium tabular-nums whitespace-nowrap">
              Sessions
            </th>
            <th className="py-2 pr-4 font-medium tabular-nums whitespace-nowrap">
              Messages
            </th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">Avg Time</th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">
              Frustration
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tier = frustrationTier(r.frustrationPercent)
            const c = severityColor(tier)
            const label = TIER_LABEL[tier]
            const nk = normalizeProjectKey(r.project)
            const insightText = insightMap.get(nk)
            return (
              <tr
                key={r.project}
                className={
                  i % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/30'
                }
              >
                <td className="py-2.5 pr-4 min-w-0 max-w-[14rem] sm:max-w-none">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-text-primary font-medium truncate min-w-0">
                      {formatProjectCell(r.project)}
                    </span>
                    {insightText ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActive({
                            project: r.project,
                            insight: insightText,
                          })
                        }
                        className="shrink-0 text-[11px] text-text-muted hover:text-text-primary cursor-pointer whitespace-nowrap"
                      >
                        View insight →
                      </button>
                    ) : null}
                  </div>
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
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: c }}
                    />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: c }}
                    >
                      {label}
                    </span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? formatProjectCell(active.project) : ''}
      >
        {active ? (
          <p className="text-sm text-text-secondary text-pretty max-w-prose">
            {active.insight}
          </p>
        ) : null}
      </Modal>
    </section>
  )
}
