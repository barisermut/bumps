import HowThisWorksButton from './HowThisWorksButton'

/**
 * @param {{
 *   title: string;
 *   sessionCount: number;
 *   projectLabel: string;
 *   timeRangeLabel: string;
 * }} props
 */
export default function MentorSectionHeader({
  title,
  sessionCount,
  projectLabel,
  timeRangeLabel,
}) {
  return (
    <div className="flex items-center justify-between gap-2 shrink-0">
      <span className="text-xs font-medium tracking-wide uppercase text-text-muted">
        {title}
      </span>
      <HowThisWorksButton
        sectionTitle={title}
        sessionCount={sessionCount}
        projectLabel={projectLabel}
        timeRangeLabel={timeRangeLabel}
      />
    </div>
  )
}
