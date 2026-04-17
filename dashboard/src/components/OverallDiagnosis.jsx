import MentorSectionHeader from './MentorSectionHeader'

/**
 * @param {{
 *   text: string;
 *   sessionCount: number;
 *   projectLabel: string;
 *   timeRangeLabel: string;
 * }} props
 */
export default function OverallDiagnosis({
  text,
  sessionCount,
  projectLabel,
  timeRangeLabel,
}) {
  return (
    <section className="bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col gap-3">
      <MentorSectionHeader
        title="Overall diagnosis"
        sessionCount={sessionCount}
        projectLabel={projectLabel}
        timeRangeLabel={timeRangeLabel}
      />
      <p className="font-display text-lg text-text-primary leading-relaxed">
        {text}
      </p>
    </section>
  )
}
