import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import WidgetEmptyState from './WidgetEmptyState'
import MentorLoadingInline from './MentorLoadingInline'
import { TEXT_PRIMARY_CHART, TEXT_MUTED_CHART } from '../lib/severityColors'

/**
 * @param {{
 *   patterns: Array<{ name: string; percentage: number }> | undefined;
 *   loading: boolean;
 * }} props
 */
export default function TopPatterns({ patterns, loading }) {
  if (loading) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-h-[18rem]">
        <h2 className="font-display text-base text-text-primary">Top patterns</h2>
        <MentorLoadingInline className="flex-1 justify-center" />
      </section>
    )
  }

  if (!patterns || patterns.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-h-[14rem]">
        <h2 className="font-display text-base text-text-primary">Top patterns</h2>
        <WidgetEmptyState
          title="No patterns yet"
          hint="Mentor will rank patterns when analysis finishes."
          className="flex-1"
        />
      </section>
    )
  }

  const data = [...patterns]
    .sort((a, b) => b.percentage - a.percentage)
    .map((p) => ({
      name:
        p.name.length > 42 ? `${p.name.slice(0, 40)}…` : p.name,
      percentage: p.percentage,
    }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-w-0">
      <h2 className="font-display text-base text-text-primary">Top patterns</h2>
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: TEXT_MUTED_CHART, fontSize: 11 }}
              axisLine={{ stroke: 'oklch(0.28 0.01 50)' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: TEXT_MUTED_CHART, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.16 0.01 55)',
                border: '1px solid oklch(0.20 0.008 50)',
                borderRadius: '8px',
                fontSize: '12px',
                color: TEXT_PRIMARY_CHART,
              }}
              formatter={(v) => [`${v}%`, 'Share']}
            />
            <Bar
              dataKey="percentage"
              fill="oklch(0.74 0.14 65)"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
