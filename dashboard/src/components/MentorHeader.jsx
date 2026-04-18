export default function MentorHeader() {
  return (
    <header className="border-b border-border shrink-0 bg-surface-900/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-text-primary tracking-tight">
            bumps
          </h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-800 text-accent-500 border border-border-subtle">
            Mentor
          </span>
        </div>
      </div>
    </header>
  )
}
