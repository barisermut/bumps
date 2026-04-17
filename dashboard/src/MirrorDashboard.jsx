import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { AlertTriangle, BarChart2, GitBranch, Zap, Sparkles } from 'lucide-react'
import FilterBar from './components/FilterBar'
import WidgetShell from './components/WidgetShell'
import WidgetEmptyState from './components/WidgetEmptyState'
import StatCards from './components/StatCards'
import TrustBadge from './components/TrustBadge'
import ScopeDrift from './components/ScopeDrift'
import PromptHabits from './components/PromptHabits'
import WhatWorked from './components/WhatWorked'
import {
  noSessionsInRange,
  isPlaceholderBiggestBump,
  FILTER_EMPTY_HINT,
} from './lib/insightsEmpty'

const YourBumps = lazy(() => import('./components/YourBumps'))

/**
 * @param {{
 *   projects: string[];
 *   selectedProject: string;
 *   onProjectChange: (v: string) => void;
 *   timeRange: string;
 *   onTimeRangeChange: (v: string) => void;
 *   externalInsights?: object | null;
 *   embedded?: boolean;
 * }} props
 */
export default function MirrorDashboard({
  projects,
  selectedProject,
  onProjectChange,
  timeRange,
  onTimeRangeChange,
  externalInsights = null,
  embedded = false,
}) {
  const [internalInsights, setInternalInsights] = useState(null)

  const fetchInsights = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedProject) params.set('project', selectedProject)
    if (timeRange && timeRange !== 'all') params.set('timeRange', timeRange)

    fetch(`/api/insights?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (import.meta.env.DEV) {
          const err = data?.error
          const summary =
            typeof err === 'string'
              ? err
              : `ok (${data && typeof data === 'object' ? Object.keys(data).length : 0} top-level keys)`
          console.log(`[bumps] /api/insights → ${summary}`)
        }
        setInternalInsights(data)
      })
      .catch((err) => console.error('[bumps] Failed to fetch insights:', err))
  }, [selectedProject, timeRange])

  useEffect(() => {
    if (externalInsights != null) return
    fetchInsights()
  }, [fetchInsights, externalInsights])

  const insights = externalInsights != null ? externalInsights : internalInsights
  const loading = insights === null
  const scopeEmpty = insights ? noSessionsInRange(insights) : false
  const totalSessions = insights?.meta?.filteredConversationCount ?? 0
  const subline =
    totalSessions > 0
      ? `Across your ${totalSessions} sessions analyzed.`
      : null

  function heroBody() {
    if (loading) {
      return <WidgetEmptyState title="Loading insights…" />
    }
    if (scopeEmpty) {
      return (
        <WidgetEmptyState
          title="No sessions in this range"
          hint={FILTER_EMPTY_HINT}
        />
      )
    }
    const bb = insights?.biggestBump
    if (!bb || isPlaceholderBiggestBump(bb)) {
      return (
        <WidgetEmptyState
          title="No single bump stood out"
          hint="Topics didn’t repeat enough in these sessions to highlight one. Try a wider time range or check the other widgets."
        />
      )
    }
    return (
      <div className="text-center px-4 py-1">
        <p className="font-display text-lg text-text-primary leading-snug">
          &ldquo;{bb}&rdquo;
        </p>
        {subline && (
          <p className="text-sm text-text-muted mt-1">{subline}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col min-h-0 ${embedded ? 'flex-1 lg:overflow-hidden' : 'min-h-screen lg:h-screen lg:overflow-hidden'}`}>
      {!embedded && (
        <FilterBar
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={onProjectChange}
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
        />
      )}

      <main className="flex-1 p-4 flex flex-col gap-3 lg:overflow-hidden min-h-0">
        <WidgetShell title="Your biggest bump" icon={AlertTriangle} span="shrink-0">
          {heroBody()}
        </WidgetShell>

        <StatCards insights={insights} />

        <TrustBadge meta={insights?.meta} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
          <WidgetShell title="Your bumps" icon={BarChart2} subtitle="Topics ranked by effort — frequency, messages, and session length" verdict="Red topics took the most back-and-forth to get right." span="min-h-0" flush>
            <Suspense
              fallback={
                <WidgetEmptyState
                  title="Loading chart…"
                  className="h-full min-h-[12rem]"
                />
              }
            >
              <YourBumps
                bumps={insights?.bumps}
                scopeEmpty={scopeEmpty}
                loading={loading}
              />
            </Suspense>
          </WidgetShell>
          <WidgetShell title="Scope drift" icon={GitBranch} subtitle="When new topics entered your projects" verdict="Projects that introduced many topics quickly tend to stall." span="min-h-0" flush>
            <ScopeDrift
              scopeDrift={insights?.scopeDrift}
              scopeEmpty={scopeEmpty}
              loading={loading}
            />
          </WidgetShell>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
          <WidgetShell title="Prompt habits" icon={Zap} subtitle="How your prompt length affects resolution speed" verdict="Shorter prompts resolved faster. Lead with the ask, add context after." span="min-h-0" flush>
            <PromptHabits
              promptHabits={insights?.promptHabits}
              scopeEmpty={scopeEmpty}
              loading={loading}
            />
          </WidgetShell>
          <WidgetShell title="What worked" icon={Sparkles} subtitle="What was different when things went well" verdict="These patterns appeared most in your fastest sessions." span="min-h-0" flush>
            <WhatWorked
              whatWorked={insights?.whatWorked}
              modelPerformance={insights?.modelPerformance}
              contextRichness={insights?.contextRichness}
              scopeEmpty={scopeEmpty}
              loading={loading}
            />
          </WidgetShell>
        </div>
      </main>
    </div>
  )
}
