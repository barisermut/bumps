import { useEffect, useState, useRef } from 'react'
import MentorHeader from './components/MentorHeader'
import MentorStatCards from './components/MentorStatCards'
import MentorInsightsSection from './components/MentorInsightsSection'
import BumpsBreakdown from './components/BumpsBreakdown'
import TopPatterns from './components/TopPatterns'
import ToolsMcpsChart from './components/ToolsMcpsChart'
import ProjectPerformanceTable from './components/ProjectPerformanceTable'

/**
 * @typedef {{
 *   status: 'ready' | 'computing' | 'error';
 *   cacheKey: string;
 *   stats: { totalSessions: number; totalMessages: number; avgSessionMinutes: number; frustrationPercent: number };
 *   mentor?: { insights: object[]; themes: object[]; topPatterns: object[]; toolsAndMcps: object[]; perProject: object[] };
 *   reason?: string | null;
 * }} MentorSnap
 */

export default function MentorDashboard() {
  /** @type {[MentorSnap | null, (v: MentorSnap | null) => void]} */
  const [snap, setSnap] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const r = await fetch('/api/mentor-insights')
        const data = await r.json()
        if (cancelled) return
        setSnap(data)
        if (data.status === 'computing') {
          timerRef.current = window.setTimeout(poll, 1000)
        }
      } catch (e) {
        console.error('[bumps] mentor-insights fetch failed', e)
        if (!cancelled) {
          setSnap({
            status: 'error',
            cacheKey: 'none',
            stats: {
              totalSessions: 0,
              totalMessages: 0,
              avgSessionMinutes: 0,
              frustrationPercent: 0,
            },
            reason: 'network_error',
          })
        }
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const aiLoading = snap?.status === 'computing' || snap == null
  const showErrorBanner =
    snap?.status === 'error' && snap.reason !== 'mentor_disabled'

  return (
    <div className="min-h-screen flex flex-col bg-surface-950">
      <MentorHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10 pb-16">
        {snap?.status === 'error' && snap.reason === 'mentor_disabled' ? (
          <div
            className="rounded-xl border border-border-subtle bg-surface-900 px-4 py-3 text-sm text-text-secondary"
            role="status"
          >
            Mentor mode is off. Run{' '}
            <code className="text-text-primary">npx getbumps</code> and choose
            Mentor, or{' '}
            <code className="text-text-primary">--mode=mentor</code>.
          </div>
        ) : null}

        {showErrorBanner ? (
          <div
            className="rounded-xl border border-border-subtle bg-surface-900 px-4 py-3 text-sm text-text-secondary"
            role="alert"
          >
            Mentor analysis failed ({snap.reason}). Stats below are from your
            local data; AI sections stay empty until you refresh after fixing the
            issue.
          </div>
        ) : null}

        <MentorStatCards stats={snap?.stats} />

        <MentorInsightsSection
          insights={snap?.mentor?.insights}
          loading={aiLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <BumpsBreakdown themes={snap?.mentor?.themes} loading={aiLoading} />
          <TopPatterns patterns={snap?.mentor?.topPatterns} loading={aiLoading} />
        </div>

        <ToolsMcpsChart items={snap?.mentor?.toolsAndMcps} loading={aiLoading} />

        <ProjectPerformanceTable
          rows={snap?.mentor?.perProject}
          loading={aiLoading}
        />
      </main>
    </div>
  )
}
