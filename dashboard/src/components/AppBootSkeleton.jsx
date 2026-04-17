import FilterBar from './FilterBar'

/** Shown while /api/mode is loading so Mentor users don’t briefly see Mirror chrome. */
export default function AppBootSkeleton() {
  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden">
      <FilterBar
        projects={[]}
        selectedProject=""
        onProjectChange={() => {}}
        timeRange="all"
        onTimeRangeChange={() => {}}
      />
      <main className="flex-1 p-4 flex items-center justify-center min-h-0">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    </div>
  )
}
