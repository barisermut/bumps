import { Activity, FolderOpen, Zap, Clock } from 'lucide-react'
import WidgetEmptyState from './WidgetEmptyState'
import { noSessionsInRange, FILTER_EMPTY_HINT } from '../lib/insightsEmpty'

function Card({ icon: Icon, value, label }) {
  return (
    <div className="bg-surface-900 rounded-xl border border-border-subtle px-4 py-3 flex items-center gap-3">
      <Icon size={18} className="text-text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{value}</p>
        <p className="text-[11px] text-text-muted/60 leading-tight truncate">{label}</p>
      </div>
    </div>
  )
}

export default function StatCards({ insights }) {
  if (!insights) {
    return (
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="col-span-4 rounded-xl border border-border-subtle bg-surface-900">
          <WidgetEmptyState title="Loading insights…" />
        </div>
      </div>
    )
  }

  if (noSessionsInRange(insights)) {
    return (
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="col-span-4 rounded-xl border border-border-subtle bg-surface-900">
          <WidgetEmptyState
            title="No session stats for this range"
            hint={FILTER_EMPTY_HINT}
          />
        </div>
      </div>
    )
  }

  const topBump = insights.bumps?.[0]
  const totalSessions = insights.meta?.filteredConversationCount ?? 0

  // Most active project from scopeDrift (project with most timeline entries)
  let mostActiveProject = '—'
  let mostActiveCount = 0
  if (insights.scopeDrift) {
    for (const entry of insights.scopeDrift) {
      const count = entry.timeline?.length || 0
      if (count > mostActiveCount) {
        mostActiveCount = count
        mostActiveProject = entry.project
      }
    }
  }

  // Fastest prompt style
  const habits = insights.promptHabits
  let fastestStyle = '—'
  let fastestAvg = ''
  if (habits?.short && habits?.long) {
    const shortAvg = habits.short.avgMessages
    const longAvg = habits.long.avgMessages
    if (shortAvg <= longAvg) {
      fastestStyle = 'Short prompts'
      fastestAvg = `avg ${shortAvg.toFixed(1)} follow-ups`
    } else {
      fastestStyle = 'Long prompts'
      fastestAvg = `avg ${longAvg.toFixed(1)} follow-ups`
    }
  }

  // Biggest time sink
  const timeSinkValue = topBump ? topBump.topic : '—'
  const timeSinkLabel = topBump ? `${Math.round(topBump.percentage)}% of sessions` : ''
  const trustNote = insights.meta?.trustNote

  return (
    <div className="shrink-0">
      <div className="grid grid-cols-4 gap-3">
        <Card icon={Activity} value={totalSessions} label="Total sessions analyzed" />
        <Card icon={FolderOpen} value={mostActiveProject} label={mostActiveCount ? `${mostActiveCount} sessions` : 'Most active project'} />
        <Card icon={Zap} value={fastestStyle} label={fastestAvg || 'Fastest prompt style'} />
        <Card icon={Clock} value={timeSinkValue} label={timeSinkLabel || 'Biggest time sink'} />
      </div>
      {trustNote && (
        <p className="text-[11px] text-text-muted/70 mt-2 px-1">{trustNote}</p>
      )}
    </div>
  )
}
