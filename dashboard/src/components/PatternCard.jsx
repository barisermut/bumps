import { severityColor } from '../lib/severityColors'

function SeverityChip({ severity }) {
  const color = severityColor(severity)
  const label =
    severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'
  return (
    <span
      className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color }}
    >
      {label}
    </span>
  )
}

/**
 * @param {{ pattern: {
 *   id: string;
 *   title: string;
 *   severity: 'low'|'medium'|'high';
 *   diagnosis: string;
 *   evidence: Array<{ project: string; sessionIds: string[]; summary: string }>;
 *   guidance: string;
 * }}} props
 */
export default function PatternCard({ pattern }) {
  const dotColor = severityColor(pattern.severity)

  return (
    <div className="bg-surface-900 rounded-xl border border-border-subtle p-4">
      <div className="flex items-start gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: dotColor }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary leading-snug">
            {pattern.title}
          </h3>
          <SeverityChip severity={pattern.severity} />
        </div>
      </div>
      <p className="mt-3 text-[13px] text-text-secondary leading-relaxed">
        {pattern.diagnosis}
      </p>

      <div className="mt-3 space-y-1.5">
        {pattern.evidence.map((ev, i) => (
          <div
            key={i}
            className="text-[11px] text-text-muted grid grid-cols-1 sm:grid-cols-[minmax(0,7rem)_1fr] gap-x-2 gap-y-0.5"
          >
            <span className="truncate font-medium text-text-secondary">
              {ev.project}
            </span>
            <span className="min-w-0 leading-relaxed">
              <span className="text-text-secondary">
                {ev.sessionIds.length} session{ev.sessionIds.length === 1 ? '' : 's'}
              </span>
              {' · '}
              {ev.summary}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md bg-surface-800/60 border-l-2 border-accent-500 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">
          What to try
        </p>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          {pattern.guidance}
        </p>
      </div>
    </div>
  )
}
