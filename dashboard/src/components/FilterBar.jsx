const TIME_RANGES = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'All time', value: 'all' },
]

export default function FilterBar({ projects, selectedProject, onProjectChange, timeRange, onTimeRangeChange }) {
  return (
    <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
      {/* Left — brand */}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl text-text-primary tracking-tight">
          bumps
        </h1>
        <span className="text-xs text-text-muted font-medium tracking-wide uppercase">
          v1
        </span>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-4">
        {/* Project selector */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => onProjectChange(e.target.value)}
            className="appearance-none bg-surface-800 text-text-secondary text-sm pl-3 pr-8 py-2 rounded-lg border border-border-subtle hover:border-surface-600 focus:outline-none focus:border-accent-500 transition-colors duration-200 cursor-pointer"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Time range toggle */}
        <div className="flex bg-surface-800 rounded-lg border border-border-subtle p-0.5">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onTimeRangeChange(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 cursor-pointer ${
                timeRange === value
                  ? 'bg-surface-700 text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
