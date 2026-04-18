import { useState, useEffect } from 'react'
import FilterBar from './components/FilterBar'
import MentorLoading from './components/MentorLoading'
import OverallDiagnosis from './components/OverallDiagnosis'
import PatternCard from './components/PatternCard'
import ThemeBreakdown from './components/ThemeBreakdown'
import ProjectDiagnosisCard from './components/ProjectDiagnosisCard'
import MentorSectionHeader from './components/MentorSectionHeader'
import MentorFallbackBanner from './components/MentorFallbackBanner'
import MirrorDashboard from './MirrorDashboard'
import WidgetEmptyState from './components/WidgetEmptyState'

function filterKeyFrom(project, timeRange) {
  return `${project || 'all'}|${timeRange}`
}

function humanProject(selectedProject) {
  return selectedProject
    ? `in project “${selectedProject}”`
    : 'across all projects'
}

function humanTimeRange(timeRange) {
  const map = {
    today: 'Today',
    '1d': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    all: 'All time',
  }
  return map[timeRange] || timeRange
}

/**
 * @param {{
 *   projects: string[];
 *   selectedProject: string;
 *   onProjectChange: (v: string) => void;
 *   timeRange: string;
 *   onTimeRangeChange: (v: string) => void;
 * }} props
 */
export default function MentorDashboard({
  projects,
  selectedProject,
  onProjectChange,
  timeRange,
  onTimeRangeChange,
}) {
  const filterKey = filterKeyFrom(selectedProject, timeRange)
  const [envelopeCache, setEnvelopeCache] = useState(
    /** @type {Record<string, object>} */ ({}),
  )
  const [loadingKey, setLoadingKey] = useState(/** @type {string | null} */ (null))

  const envelope = envelopeCache[filterKey]
  const isLoading = loadingKey === filterKey && envelope === undefined

  const projectLabel = humanProject(selectedProject)
  const timeRangeLabel = humanTimeRange(timeRange)

  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(envelopeCache, filterKey)) {
      setLoadingKey(null)
      return
    }

    let cancelled = false
    const keyAtStart = filterKey
    setLoadingKey(keyAtStart)

    const params = new URLSearchParams()
    if (selectedProject) params.set('project', selectedProject)
    if (timeRange && timeRange !== 'all') params.set('timeRange', timeRange)

    fetch(`/api/mentor-insights?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setEnvelopeCache((c) => ({ ...c, [keyAtStart]: data }))
        setLoadingKey((lk) => (lk === keyAtStart ? null : lk))
      })
      .catch((err) => {
        console.error('[bumps] Failed to fetch mentor insights:', err)
        if (cancelled) return
        const mirrorParams = new URLSearchParams()
        if (selectedProject) mirrorParams.set('project', selectedProject)
        if (timeRange && timeRange !== 'all') {
          mirrorParams.set('timeRange', timeRange)
        }
        fetch(`/api/insights?${mirrorParams}`)
          .then((r) => r.json())
          .then((mirror) => {
            if (cancelled) return
            setEnvelopeCache((c) => ({
              ...c,
              [keyAtStart]: {
                mode: 'mentor',
                generatedAt: new Date().toISOString(),
                filter: {
                  project: selectedProject || null,
                  timeRange,
                },
                mirror,
                mentor: null,
                fallback: { used: true, reason: 'unexpected_error' },
                fromCache: false,
                durationMs: 0,
              },
            }))
          })
          .catch(() => {
            if (cancelled) return
            setEnvelopeCache((c) => ({
              ...c,
              [keyAtStart]: {
                mode: 'mentor',
                generatedAt: new Date().toISOString(),
                filter: {
                  project: selectedProject || null,
                  timeRange,
                },
                mirror: null,
                mentor: null,
                fallback: { used: true, reason: 'unexpected_error' },
                fromCache: false,
                durationMs: 0,
              },
            }))
          })
          .finally(() => {
            if (cancelled) return
            setLoadingKey((lk) => (lk === keyAtStart ? null : lk))
          })
      })

    return () => {
      cancelled = true
    }
  }, [filterKey, selectedProject, timeRange, envelopeCache])

  const mentor = envelope?.mentor
  const fallback = envelope?.fallback
  const useFallbackUI = Boolean(
    envelope && mentor == null && fallback?.used === true,
  )

  const sessionCount = envelope?.mirror?.meta?.filteredConversationCount ?? 0

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden">
      <FilterBar
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={onProjectChange}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
      />

      {isLoading && <MentorLoading />}

      {!isLoading && useFallbackUI && envelope?.mirror && (
        <>
          <MentorFallbackBanner
            reason={fallback?.reason}
            sessionCount={sessionCount}
            projectLabel={projectLabel}
            timeRangeLabel={timeRangeLabel}
          />
          <MirrorDashboard
            embedded
            projects={projects}
            selectedProject={selectedProject}
            onProjectChange={onProjectChange}
            timeRange={timeRange}
            onTimeRangeChange={onTimeRangeChange}
            externalInsights={envelope.mirror}
          />
        </>
      )}

      {!isLoading && useFallbackUI && !envelope?.mirror && (
        <main className="flex-1 p-4 flex flex-col gap-4">
          <MentorFallbackBanner
            reason={fallback?.reason}
            sessionCount={0}
            projectLabel={projectLabel}
            timeRangeLabel={timeRangeLabel}
          />
          <WidgetEmptyState
            title="Couldn’t load Mirror view"
            hint="Network error while loading insights. Try refreshing."
          />
        </main>
      )}

      {!isLoading && mentor && (
        <main className="flex-1 px-6 py-8 flex flex-col gap-10 overflow-y-auto min-h-0">
          <OverallDiagnosis
            text={mentor.overallDiagnosis}
            sessionCount={sessionCount}
            projectLabel={projectLabel}
            timeRangeLabel={timeRangeLabel}
          />

          <hr className="border-border-subtle/60" />

          <section className="flex flex-col gap-4">
            <MentorSectionHeader
              title="Patterns"
              sessionCount={sessionCount}
              projectLabel={projectLabel}
              timeRangeLabel={timeRangeLabel}
            />
            <div className="space-y-5">
              {mentor.patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} />
              ))}
            </div>
          </section>

          <hr className="border-border-subtle/60" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ThemeBreakdown
              themes={mentor.themes}
              sessionCount={sessionCount}
              projectLabel={projectLabel}
              timeRangeLabel={timeRangeLabel}
            />
            <div className="flex flex-col gap-4 min-w-0">
              <MentorSectionHeader
                title="Per-project"
                sessionCount={sessionCount}
                projectLabel={projectLabel}
                timeRangeLabel={timeRangeLabel}
              />
              <div className="space-y-4">
                {mentor.perProject?.length ? (
                  mentor.perProject.map((pp) => (
                    <ProjectDiagnosisCard
                      key={pp.project}
                      item={pp}
                      patterns={mentor.patterns}
                    />
                  ))
                ) : (
                  <div className="bg-surface-900 rounded-xl border border-border-subtle p-4">
                    <p className="text-sm text-text-muted">
                      No per-project diagnoses for this filter.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
