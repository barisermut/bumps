import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import MentorSectionHeader from './MentorSectionHeader'
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

/**
 * @param {{
 *   themes: Array<{ name: string; share: number; sampleSessionIds?: string[] }>;
 *   sessionCount: number;
 *   projectLabel: string;
 *   timeRangeLabel: string;
 * }} props
 */
export default function ThemeBreakdown({
  themes,
  sessionCount,
  projectLabel,
  timeRangeLabel,
}) {
  if (!themes || themes.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-h-[14rem]">
        <MentorSectionHeader
          title="Theme breakdown"
          sessionCount={sessionCount}
          projectLabel={projectLabel}
          timeRangeLabel={timeRangeLabel}
        />
        <WidgetEmptyState
          title="No themes for this range"
          hint="Mentor didn’t return theme shares for this filter."
          className="flex-1"
        />
      </section>
    )
  }

  const data = themes.map((t) => ({
    name: t.name,
    value: Math.round((t.share || 0) * 1000) / 10,
  }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-h-[280px]">
      <MentorSectionHeader
        title="Theme breakdown"
        sessionCount={sessionCount}
        projectLabel={projectLabel}
        timeRangeLabel={timeRangeLabel}
      />
      <div className="flex-1 min-h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              stroke="oklch(0.20 0.012 50)"
              strokeWidth={1}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.16 0.01 55)',
                border: '1px solid oklch(0.20 0.008 50)',
                borderRadius: '8px',
                fontSize: '12px',
                color: TEXT_PRIMARY_CHART,
              }}
              formatter={(value) => [`${value}%`, 'Share']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-[11px] text-text-muted">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="text-text-secondary truncate">{d.name}</span>
            <span className="ml-auto tabular-nums">{d.value}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
