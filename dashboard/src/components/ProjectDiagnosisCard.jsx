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
      <h3 className="text-sm font-medium text-text-primary mb-2">
        {item.project}
      </h3>
      <p className="text-[13px] text-text-secondary leading-relaxed">
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
            return (
              <span
                key={id}
                className="text-[10px] px-2 py-0.5 rounded-full border border-border-subtle"
                style={{ color: severityColor(p.severity) }}
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
