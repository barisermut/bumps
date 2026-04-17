import { mentorFallbackMessage } from '../lib/mentorReasons'
import HowThisWorksButton from './HowThisWorksButton'

/**
 * @param {{
 *   reason: string | null | undefined;
 *   sessionCount: number;
 *   projectLabel: string;
 *   timeRangeLabel: string;
 * }} props
 */
export default function MentorFallbackBanner({
  reason,
  sessionCount,
  projectLabel,
  timeRangeLabel,
}) {
  const body = mentorFallbackMessage(reason)

  return (
    <div
      className="mx-4 mt-3 rounded-lg border border-border-subtle border-l-2 border-l-accent-500 bg-surface-800/60 px-4 py-3 flex flex-wrap items-center gap-3"
      role="status"
    >
      <p className="text-sm text-text-secondary leading-relaxed flex-1 min-w-[12rem]">
        {body}
      </p>
      <HowThisWorksButton
        sectionTitle="Mentor fallback"
        sessionCount={sessionCount}
        projectLabel={projectLabel}
        timeRangeLabel={timeRangeLabel}
      />
    </div>
  )
}
