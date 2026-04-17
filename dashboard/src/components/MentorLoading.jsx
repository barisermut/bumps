import { Loader2 } from 'lucide-react'

export default function MentorLoading() {
  return (
    <main className="flex-1 p-4 flex flex-col items-center justify-center min-h-0 gap-4">
      <div className="bg-surface-900 rounded-xl border border-border-subtle px-8 py-10 max-w-md w-full flex flex-col items-center text-center gap-3">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin shrink-0" aria-hidden />
        <p className="font-display text-base text-text-primary leading-snug">
          Running Mentor analysis for this filter…
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Your Cursor Agent is analyzing your sessions on your machine. Typically 30–60 seconds the first time for a given filter — cached results load instantly next time.
        </p>
      </div>
    </main>
  )
}
