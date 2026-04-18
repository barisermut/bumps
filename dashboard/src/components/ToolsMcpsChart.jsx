import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import WidgetEmptyState from './WidgetEmptyState'
import { TEXT_PRIMARY_CHART, TEXT_MUTED_CHART } from '../lib/severityColors'

/**
 * @param {{
 *   items: Array<{ name: string; sessionCount: number }> | undefined;
 * }} props
 */
export default function ToolsMcpsChart({ items }) {
  if (!items || items.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-h-[12rem]">
        <h2 className="font-display text-base text-text-primary">Tools and MCPs used</h2>
        <WidgetEmptyState
          title="No tool usage yet"
          hint="Mentor will summarize tools when analysis finishes."
          className="flex-1"
        />
      </section>
    )
  }

  const max = Math.max(...items.map((t) => t.sessionCount), 1)
  const data = [...items]
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .map((t) => ({
      name: t.name.length > 36 ? `${t.name.slice(0, 34)}…` : t.name,
      sessionCount: t.sessionCount,
    }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3 min-w-0">
      <h2 className="font-display text-base text-text-primary">Tools and MCPs used</h2>
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              domain={[0, max]}
              tick={{ fill: TEXT_MUTED_CHART, fontSize: 11 }}
              axisLine={{ stroke: 'oklch(0.28 0.01 50)' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
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
              formatter={(v) => [v, 'Sessions']}
            />
            <Bar
              dataKey="sessionCount"
              fill="oklch(0.65 0.13 280)"
              radius={[0, 4, 4, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
