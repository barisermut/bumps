import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { AlertTriangle, BarChart2, GitBranch, Zap, Sparkles } from 'lucide-react'
import FilterBar from './components/FilterBar'
import WidgetShell from './components/WidgetShell'
import WidgetEmptyState from './components/WidgetEmptyState'
import StatCards from './components/StatCards'
import ScopeDrift from './components/ScopeDrift'
import PromptHabits from './components/PromptHabits'
import WhatWorked from './components/WhatWorked'
import {
  noSessionsInRange,
  isPlaceholderBiggestBump,
  FILTER_EMPTY_HINT,
} from './lib/insightsEmpty'

const YourBumps = lazy(() => import('./components/YourBumps'))

function heroSubline(bumps) {
  if (!bumps || bumps.length === 0) return null
  const top = bumps[0]
  const total = Math.round(top.count / (top.percentage / 100))
  return `Found in ${top.count} of your ${total} sessions.`
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [timeRange, setTimeRange] = useState('all')
  const [insights, setInsights] = useState(null)

  // Fetch project list on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (import.meta.env.DEV) {
          const n = Array.isArray(data?.projects) ? data.projects.length : 0
          console.log(`[bumps] /api/projects → ${n} project(s)`)
        }
        setProjects(data.projects || [])
      })
      .catch((err) => console.error('[bumps] Failed to fetch projects:', err))
  }, [])

  // Fetch insights when filters change
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
        setInsights(data)
      })
      .catch((err) => console.error('[bumps] Failed to fetch insights:', err))
  }, [selectedProject, timeRange])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const loading = insights === null
  const scopeEmpty = insights ? noSessionsInRange(insights) : false
  const subline =
    insights?.meta?.filteredConversationCount > 0
      ? `Found in ${insights?.bumps?.[0]?.count || 0} of your ${insights.meta.filteredConversationCount} sessions.`
      : heroSubline(insights?.bumps)

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
    <div className="h-screen flex flex-col overflow-hidden">
      <FilterBar
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      <main className="flex-1 p-4 flex flex-col gap-3 overflow-hidden min-h-0">
        {/* Row 1 — Hero callout, compact */}
        <WidgetShell title="Your biggest bump" icon={AlertTriangle} span="shrink-0">
          {heroBody()}
        </WidgetShell>

        {/* Row 1.5 — Stat cards */}
        <StatCards insights={insights} />

        {/* Row 2 — 2-column grid */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <WidgetShell title="Your bumps" icon={BarChart2} subtitle="% of sessions where this topic came up" verdict="Topics in red are where you lose the most time. Focus here first." span="min-h-0" flush>
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

        {/* Row 3 — 2-column grid */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
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
              scopeEmpty={scopeEmpty}
              loading={loading}
            />
          </WidgetShell>
        </div>
      </main>
    </div>
  )
}
