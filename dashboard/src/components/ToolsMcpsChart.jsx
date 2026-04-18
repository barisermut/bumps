import WidgetEmptyState from './WidgetEmptyState'

/**
 * @param {{
 *   items: Array<{ name: string; sessionCount: number }> | undefined;
 * }} props
 */
export default function ToolsMcpsChart({ items }) {
  if (!items || items.length === 0) {
    return (
      <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 flex flex-col gap-3 min-h-[12rem]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
          SKILLS & MCPS
        </h2>
        <WidgetEmptyState
          title="No skills or MCPs used in this period"
          hint="Add skills to your Cursor setup to track them here."
          className="flex-1"
        />
      </section>
    )
  }

  const sorted = [...items].sort((a, b) => b.sessionCount - a.sessionCount)
  const total = sorted.length
  const top = sorted.slice(0, 6).map((t) => ({
    name: t.name.length > 36 ? `${t.name.slice(0, 34)}…` : t.name,
    sessionCount: t.sessionCount,
  }))

  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-5 pt-4 flex flex-col gap-3 min-w-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
        SKILLS & MCPS
      </h2>
      <ul role="list" className="min-w-0">
        {top.map((t) => (
          <li
            key={t.name}
            className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle/40 last:border-0"
          >
            <span className="text-[13px] text-text-primary truncate min-w-0">
              {t.name}
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md bg-surface-800 text-text-secondary border border-border-subtle">
              {t.sessionCount}×
            </span>
          </li>
        ))}
      </ul>
      {total > 6 ? (
        <p className="text-[11px] text-text-muted mt-1">+{total - 6} more</p>
      ) : null}
    </section>
  )
}
