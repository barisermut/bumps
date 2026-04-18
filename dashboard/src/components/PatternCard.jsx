import { useState } from 'react'
import { severityColor } from '../lib/severityColors'

function SeverityChip({ severity }) {
  const color = severityColor(severity)
  const label =
    severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'
  return (
    <span
      className="inline-block shrink-0 text-[10px] font-semibold uppercase tracking-wide"
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
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-900 rounded-xl border border-border-subtle p-4">
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <h3 className="text-sm font-semibold text-text-primary leading-snug flex-1 min-w-0 truncate">
          {pattern.title}
        </h3>
        <SeverityChip severity={pattern.severity} />
      </div>

      <p
        className={`mt-3 text-[13px] text-text-secondary leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}
      >
        {pattern.diagnosis}
      </p>
      {pattern.diagnosis.length > 140 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] text-text-muted hover:text-text-secondary"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="mt-4 divide-y divide-border-subtle/60 rounded-md bg-surface-800/40">
        {pattern.evidence.map((ev, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 px-3 py-2 text-[11px]"
          >
            <span className="font-medium text-text-secondary truncate max-w-[9rem]">
              {ev.project}
            </span>
            <span className="text-text-muted tabular-nums shrink-0">
              {ev.sessionIds.length} session{ev.sessionIds.length === 1 ? '' : 's'}
            </span>
            <span className="text-text-secondary min-w-0 truncate">
              {ev.summary}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md bg-surface-800/60 border-l-2 border-accent-500 px-4 py-3">
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
