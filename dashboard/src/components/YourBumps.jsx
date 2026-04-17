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
import {
  SEVERITY,
  CHART_FONT,
  TEXT_PRIMARY_CHART,
  TEXT_MUTED_CHART,
} from '../lib/severityColors'

const BAR_COLOR = SEVERITY.medium
const BAR_COLOR_FADED = 'oklch(0.74 0.14 65 / 0.15)'

function barColor(index, total) {
  if (index < 3) return SEVERITY.high
  if (index >= total - 3 && total > 6) return SEVERITY.low
  return SEVERITY.medium
}

function PercentLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      fill={TEXT_PRIMARY_CHART}
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
      fill={TEXT_MUTED_CHART}
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
