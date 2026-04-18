import { Activity, MessageSquare, Clock, Flame } from 'lucide-react'

function Card({ icon: Icon, value, label, sub }) {
  return (
    <div className="bg-surface-900 rounded-xl border border-border-subtle px-4 py-3 flex items-start gap-3 min-h-[4.5rem]">
      <Icon size={18} className="text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted/80 uppercase tracking-wide font-medium mb-1">
          {label}
        </p>
        <p className="text-lg font-semibold text-text-primary tabular-nums leading-tight">
          {value}
        </p>
        {sub ? (
          <p className="text-[11px] text-text-muted mt-1 leading-snug">{sub}</p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * @param {{ stats: { totalSessions: number; totalMessages: number; avgSessionMinutes: number; frustrationPercent: number } | null | undefined }} props
 */
export default function MentorStatCards({ stats }) {
  const dash = '—'
  const sessions = stats?.totalSessions ?? null
  const messages = stats?.totalMessages ?? null
  const avgMin = stats?.avgSessionMinutes ?? null
  const frustr = stats?.frustrationPercent ?? null

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        icon={Activity}
        value={sessions == null ? dash : String(sessions)}
        label="Total sessions analyzed"
      />
      <Card
        icon={MessageSquare}
        value={messages == null ? dash : messages.toLocaleString()}
        label="Total messages sent"
      />
      <Card
        icon={Clock}
        value={
          avgMin == null
            ? dash
            : avgMin === 0
              ? '0 min'
              : `${avgMin} min`
        }
        label="Avg time per session"
      />
      <Card
        icon={Flame}
        value={frustr == null ? dash : `${frustr}%`}
        label="% sessions showing frustration"
      />
    </section>
  )
}
