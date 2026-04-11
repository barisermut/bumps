import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import WidgetEmptyState from './WidgetEmptyState'
import { FILTER_EMPTY_HINT } from '../lib/insightsEmpty'

const BAR_COLOR = 'oklch(0.74 0.14 65)'
const BAR_COLOR_FADED = 'oklch(0.74 0.14 65 / 0.15)'

// Color signal zones: red (problem), amber (watch), green (healthy)
const BAR_RED = 'oklch(0.65 0.18 25)'
const BAR_AMBER = 'oklch(0.74 0.14 65)'
const BAR_GREEN = 'oklch(0.60 0.10 155)'
const CHART_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function barColor(index, total) {
  if (index < 3) return BAR_RED
  if (index >= total - 3 && total > 6) return BAR_GREEN
  return BAR_AMBER
}
const TEXT_PRIMARY = 'oklch(0.93 0.01 75)'
const TEXT_MUTED = 'oklch(0.48 0.012 55)'

function PercentLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      fill={TEXT_PRIMARY}
      fontSize={12}
      fontFamily={CHART_FONT}
      dominantBaseline="central"
    >
      {value}%
    </text>
  )
}

function TopicTick({ x, y, payload }) {
  return (
    <text
      x={x - 4}
      y={y}
      fill={TEXT_MUTED}
      fontSize={12}
      fontFamily={CHART_FONT}
      textAnchor="end"
      dominantBaseline="central"
    >
      {payload.value}
    </text>
  )
}

export default function YourBumps({ bumps, scopeEmpty = false, loading = false }) {
  if (loading) {
    return <WidgetEmptyState title="Loading insights…" className="h-full min-h-[12rem]" />
  }
  if (!bumps || bumps.length === 0) {
    return (
      <WidgetEmptyState
        title={
          scopeEmpty
            ? 'No sessions in this range'
            : 'No topics to chart for this range'
        }
        hint={
          scopeEmpty
            ? FILTER_EMPTY_HINT
            : 'Session text didn’t match Bumps’ topic keywords enough to rank categories. Widen the time range or try another project.'
        }
        className="h-full min-h-[12rem]"
      />
    )
  }

  const data = bumps
    .slice(0, 8)
    .map((b) => ({
      topic: b.topic,
      percentage: b.percentage,
    }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
        barCategoryGap="20%"
      >
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis
          dataKey="topic"
          type="category"
          axisLine={false}
          tickLine={false}
          width={180}
          interval={0}
          tick={<TopicTick />}
        />
        <Bar
          dataKey="percentage"
          radius={[4, 4, 4, 4]}
          label={<PercentLabel />}
          background={{ fill: BAR_COLOR_FADED, radius: 4 }}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={barColor(i, data.length)}
              style={{ opacity: 1 - i * 0.04 }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
