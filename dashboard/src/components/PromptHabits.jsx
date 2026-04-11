import WidgetEmptyState from './WidgetEmptyState'
import { FILTER_EMPTY_HINT } from '../lib/insightsEmpty'

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-display text-text-primary leading-none">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  )
}

function Column({ title, desc, avgMessages, avgResolution, winner, slower }) {
  return (
    <div className={`flex-1 rounded-lg px-4 py-3 ${
      winner
        ? 'bg-accent-500/5'
        : slower
          ? ''
          : 'bg-surface-800/30'
    }`}
      style={slower ? { backgroundColor: 'oklch(0.16 0.015 25 / 0.4)' } : undefined}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-text-secondary">{title}</span>
        {winner && (
          <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: 'oklch(0.70 0.12 155)', backgroundColor: 'oklch(0.60 0.10 155 / 0.12)' }}
          >
            Faster
          </span>
        )}
      </div>
      <div className="text-[11px] text-text-muted/50 mb-3">{desc}</div>
      <div className="flex gap-6">
        <Stat label="avg messages" value={avgMessages} />
        <Stat label="avg follow-ups" value={avgResolution} />
      </div>
    </div>
  )
}

export default function PromptHabits({ promptHabits, scopeEmpty = false, loading = false }) {
  if (loading) {
    return <WidgetEmptyState title="Loading insights…" className="h-full min-h-[12rem]" />
  }

  if (!promptHabits?.short || !promptHabits?.long) {
    return (
      <WidgetEmptyState
        title={scopeEmpty ? 'No sessions in this range' : 'No prompt data for this range'}
        hint={scopeEmpty ? FILTER_EMPTY_HINT : 'We compare first user message length to follow-up counts. If there’s nothing here, sessions may be missing user messages in this slice.'}
        className="h-full min-h-[12rem]"
      />
    )
  }

  const { short, long } = promptHabits
  const hasData = short.avgMessages > 0 || long.avgMessages > 0
  if (!hasData) {
    return (
      <WidgetEmptyState
        title={scopeEmpty ? 'No sessions in this range' : 'No prompt comparison for this range'}
        hint={
          scopeEmpty
            ? FILTER_EMPTY_HINT
            : 'Need a mix of short and long first prompts to compare. Try a wider time range.'
        }
        className="h-full min-h-[12rem]"
      />
    )
  }

  const shortFaster = short.avgResolution > 0 && short.avgResolution <= long.avgResolution
  const longFaster = long.avgResolution > 0 && long.avgResolution < short.avgResolution

  return (
    <div className="flex gap-3 w-full h-full items-stretch">
      <Column
        title="Short prompts"
        desc="Under 200 characters"
        avgMessages={short.avgMessages}
        avgResolution={short.avgResolution}
        winner={shortFaster}
        slower={longFaster}
      />
      <Column
        title="Long prompts"
        desc="Over 200 characters"
        avgMessages={long.avgMessages}
        avgResolution={long.avgResolution}
        winner={longFaster}
        slower={shortFaster}
      />
    </div>
  )
}
