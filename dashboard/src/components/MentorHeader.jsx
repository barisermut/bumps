export default function MentorHeader() {
  return (
    <header className="border-b border-border shrink-0 bg-surface-900/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
          <div className="flex items-baseline gap-3 shrink-0">
            <h1 className="font-display text-2xl text-text-primary tracking-tight">
              bumps
            </h1>
            <span className="text-xs text-text-muted font-medium tracking-wide uppercase">
              V2 · MENTOR
            </span>
          </div>
          <p className="text-[12px] text-text-muted text-balance">
            Cross-session reflection — what bumped, what worked, what to try
            next.
          </p>
        </div>
      </div>
    </header>
  )
}
