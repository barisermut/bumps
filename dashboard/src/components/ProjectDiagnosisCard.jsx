import { severityColor } from '../lib/severityColors'

/**
 * @param {{
 *   item: { project: string; diagnosis: string; primaryPatternIds: string[] };
 *   patterns: Array<{ id: string; title: string; severity: 'low'|'medium'|'high' }>;
 * }} props
 */
export default function ProjectDiagnosisCard({ item, patterns }) {
  const byId = new Map(patterns.map((p) => [p.id, p]))

  return (
    <div className="bg-surface-900 rounded-xl border border-border-subtle p-4">
      <h3 className="text-base font-semibold text-text-primary mb-2">
        {item.project}
      </h3>
      <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-2">
        {item.diagnosis}
      </p>
      {item.primaryPatternIds?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.primaryPatternIds.map((id) => {
            const p = byId.get(id)
            if (!p) {
              return (
                <span
                  key={id}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border-subtle text-text-muted"
                >
                  {id}
                </span>
              )
            }
            const c = severityColor(p.severity)
            return (
              <span
                key={id}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: c,
                  backgroundColor: `color-mix(in oklch, ${c} 14%, transparent)`,
                  border: `1px solid color-mix(in oklch, ${c} 30%, transparent)`,
                }}
              >
                {p.title}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
