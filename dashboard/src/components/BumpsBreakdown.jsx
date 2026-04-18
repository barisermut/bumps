import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import WidgetEmptyState from './WidgetEmptyState'
import { TEXT_PRIMARY_CHART } from '../lib/severityColors'

const PIE_COLORS = [
  'oklch(0.82 0.12 75)',
  'oklch(0.74 0.14 65)',
  'oklch(0.65 0.13 60)',
  'oklch(0.35 0.01 50)',
  'oklch(0.45 0.01 55)',
  'oklch(0.55 0.02 55)',
]

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name = item?.name
  const value = item?.value
  const fill = item?.payload?.fill ?? PIE_COLORS[0]
  return (
    <div
      className="rounded-lg border border-border-subtle px-3 py-2 text-[12px] shadow-sm"
      style={{
        backgroundColor: 'oklch(0.16 0.01 55)',
        color: TEXT_PRIMARY_CHART,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="size-2 rounded-sm shrink-0"
          style={{ backgroundColor: fill }}
        />
        <span className="font-medium truncate">{name}</span>
      </div>
      <p className="tabular-nums mt-1 pl-4 text-[11px] opacity-90">{value}%</p>
    </div>
  )
}

/**
 * @param {{
 *   themes: Array<{ name: string; share: number }> | undefined;
 * }} props
 */
export default function BumpsBreakdown({ themes }) {
  if (!themes || themes.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 flex flex-col gap-3 min-h-[14rem]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
          BUMPS BREAKDOWN
        </h2>
        <WidgetEmptyState
          title="No themes yet"
          hint="No themes in this period."
          className="flex-1"
        />
      </section>
    )
  }

  const data = themes.map((t, i) => ({
    name: t.name,
    value: Math.round((t.share || 0) * 1000) / 10,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 pt-4 flex flex-col gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
        BUMPS BREAKDOWN
      </h2>
      <div className="min-h-[240px] h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
              stroke="oklch(0.20 0.012 50)"
              strokeWidth={1}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul
        role="list"
        className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]"
      >
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 min-w-0">
            <span
              className="size-2 rounded-sm shrink-0"
              style={{ backgroundColor: d.fill }}
            />
            <span className="text-text-secondary truncate min-w-0">{d.name}</span>
            <span className="ml-auto tabular-nums text-text-primary font-medium shrink-0">
              {d.value}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
