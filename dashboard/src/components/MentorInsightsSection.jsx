import { Sparkles } from 'lucide-react'
import { severityColor } from '../lib/severityColors'

/**
 * @param {{
 *   insights: Array<{ id: string; severity: string; title: string; diagnosis: string; guidance: string }> | undefined;
 * }} props
 */
export default function MentorInsightsSection({ insights }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-900/90 p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="w-5 h-5 text-accent-500 shrink-0" aria-hidden />
        <h2 className="font-display text-lg md:text-xl text-text-primary tracking-tight">
          AI insights
        </h2>
      </div>

      {!insights || insights.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">
          No insights yet. If analysis failed, check the banner above or run
          Mentor again.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.slice(0, 6).map((ins) => {
            const dot = severityColor(
              ins.severity === 'high' || ins.severity === 'medium' || ins.severity === 'low'
                ? ins.severity
                : 'low',
            )
            return (
              <article
                key={ins.id}
                className="rounded-xl border border-border-subtle bg-surface-800/30 p-4 flex flex-col gap-2 min-h-[7rem]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: dot }}
                  />
                  <h3 className="text-sm font-semibold text-text-primary leading-snug flex-1">
                    {ins.title}
                  </h3>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed pl-5 line-clamp-3">
                  {ins.diagnosis}
                </p>
                <div className="border-t border-border-subtle/60 pt-2 mt-1 pl-5">
                  <p className="text-[12px] text-text-muted italic leading-relaxed">
                    {ins.guidance}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
