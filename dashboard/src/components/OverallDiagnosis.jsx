import HowThisWorksButton from './HowThisWorksButton'

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
    <section className="px-1 pt-2 pb-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-display text-2xl md:text-3xl text-text-primary leading-tight tracking-tight max-w-3xl">
          {text}
        </p>
        <HowThisWorksButton
          sectionTitle="Overall diagnosis"
          sessionCount={sessionCount}
          projectLabel={projectLabel}
          timeRangeLabel={timeRangeLabel}
        />
      </div>
    </section>
  )
}
