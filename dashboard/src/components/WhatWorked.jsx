import { useState } from 'react'
import { Zap, FolderOpen, Plug, Cpu, Wrench } from 'lucide-react'
import Modal from './Modal'
import WidgetEmptyState from './WidgetEmptyState'
import { FILTER_EMPTY_HINT } from '../lib/insightsEmpty'
import { formatWhatWorkedFinding } from '../lib/formatWhatWorked'

const GREEN_DOT = 'oklch(0.60 0.10 155)'

const CATEGORIES = [
  { key: 'fastPromptPatterns', label: 'Fastest Prompts', icon: Zap },
  { key: 'cleanDomains', label: 'Cleanest Domain', icon: FolderOpen },
  { key: 'activeTools', label: 'Helpful Support', icon: Wrench },
  { key: 'mcpServers', label: 'Most Used MCP', icon: Plug },
]

function InsightRow({ icon: Icon, label, finding, onDetails }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-800/60 last:border-b-0">
      <Icon size={14} className="text-text-muted/50 shrink-0" />
      <span className="text-[11px] uppercase tracking-wider text-text-muted w-[110px] shrink-0">
        {label}
      </span>
      <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
        {finding}
      </span>
      <button
        onClick={onDetails}
        className="text-[11px] text-text-muted/40 hover:text-accent-500 transition-colors whitespace-nowrap cursor-pointer shrink-0"
      >
        See details →
      </button>
    </div>
  )
}

export default function WhatWorked({
  whatWorked,
  modelPerformance,
  scopeEmpty = false,
  loading = false,
}) {
  const [modal, setModal] = useState(null)

  if (loading) {
    return <WidgetEmptyState title="Loading insights…" className="h-full min-h-[12rem]" />
  }

  if (!whatWorked) {
    return (
      <WidgetEmptyState
        title={scopeEmpty ? 'No sessions in this range' : 'Nothing to show for this range'}
        hint={
          scopeEmpty
            ? FILTER_EMPTY_HINT
            : 'Patterns need enough fast sessions and tool usage to surface. Try widening the time range.'
        }
        className="h-full min-h-[12rem]"
      />
    )
  }

  const rows = CATEGORIES.map((cat) => {
    const items = whatWorked[cat.key]
    if (!items || items.length === 0) {
      if (cat.key === 'cleanDomains' || cat.key === 'mcpServers' || cat.key === 'activeTools') {
        return { ...cat, finding: 'Not enough data yet', empty: true }
      }
      return null
    }
    const formatted = items.map((item) => formatWhatWorkedFinding(cat.key, item))
    return { ...cat, finding: formatted[0], allItems: formatted }
  }).filter(Boolean)

  // Add Best Model row from modelPerformance data
  if (modelPerformance && modelPerformance.length > 0) {
    const best = modelPerformance[0]
    const finding = best.lowConfidence
      ? `${best.model} — low signal (${best.sessionCount} session${best.sessionCount === 1 ? '' : 's'} in this range)`
      : `${best.model} — avg ${best.avgFollowUps} follow-ups across ${best.sessionCount} sessions`
    rows.push({
      key: 'bestModel',
      label: 'Best Model',
      icon: Cpu,
      finding,
      allItems: modelPerformance.map(
        (m) =>
          m.lowConfidence
            ? `${m.model} — low signal (${m.sessionCount} session${m.sessionCount === 1 ? '' : 's'} in this range)`
            : `${m.model} — avg ${m.avgFollowUps} follow-ups across ${m.sessionCount} sessions`
      ),
    })
  } else {
    rows.push({
      key: 'bestModel',
      label: 'Best Model',
      icon: Cpu,
      finding: 'Not enough data yet',
      empty: true,
    })
  }

  if (rows.length === 0) {
    return (
      <WidgetEmptyState
        title={scopeEmpty ? 'No sessions in this range' : 'Nothing to show for this range'}
        hint={scopeEmpty ? FILTER_EMPTY_HINT : undefined}
        className="h-full min-h-[12rem]"
      />
    )
  }

  const allPlaceholder = rows.every((r) => r.empty)
  if (allPlaceholder) {
    return (
      <WidgetEmptyState
        title={scopeEmpty ? 'No sessions in this range' : 'No clear wins in this range'}
        hint={
          scopeEmpty
            ? FILTER_EMPTY_HINT
            : 'Fast prompts, domains, MCP usage, and model stats need more signal. Expand the time range or keep coding — we’ll pick it up when there’s enough data.'
        }
        className="h-full min-h-[12rem]"
      />
    )
  }

  return (
    <>
      <div className="w-full h-full flex flex-col justify-center min-h-0">
        {rows.map((row) => (
          row.empty ? (
            <div key={row.key} className="flex items-center gap-3 py-2.5 border-b border-surface-800/60 last:border-b-0">
              <row.icon size={14} className="text-text-muted/50 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider text-text-muted w-[110px] shrink-0">
                {row.label}
              </span>
              <span className="text-sm text-text-muted/50 italic flex-1 min-w-0">
                {row.finding}
              </span>
            </div>
          ) : (
            <InsightRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              finding={row.finding}
              onDetails={() => setModal({ label: row.label, items: row.allItems })}
            />
          )
        ))}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.label || ''}
      >
        {modal && (
          <ul className="space-y-1.5">
            {modal.items.map((item, i) => (
              <li
                key={i}
                className="text-sm text-text-secondary leading-relaxed flex items-baseline gap-2.5 py-1"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0 translate-y-[1px]"
                  style={{ backgroundColor: GREEN_DOT }}
                />
                {item}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
