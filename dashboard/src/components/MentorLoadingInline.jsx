import { Loader2 } from 'lucide-react'

/**
 * @param {{ label?: string; className?: string }} props
 */
export default function MentorLoadingInline({
  label = 'Mentor is analyzing…',
  className = '',
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-800/40 px-4 py-6 ${className}`}
    >
      <Loader2
        className="w-5 h-5 text-accent-500 animate-spin shrink-0"
        aria-hidden
      />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
