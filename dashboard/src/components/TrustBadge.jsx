import { Layers, ShieldCheck } from 'lucide-react'

export default function TrustBadge({ meta }) {
  if (!meta || meta.filteredConversationCount === 0) {
    return null
  }

  const total = meta.filteredConversationCount
  const multi = meta.sourceCoverage?.multiSource ?? 0
  const tools = meta.completeness?.withTools ?? 0

  if (multi <= 0 && tools <= 0) {
    return null
  }

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2">
      {multi > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/70 bg-surface-900/60 px-2.5 py-1 text-[11px] text-text-muted/80">
          <Layers size={11} className="text-text-muted/70 shrink-0" />
          {multi} of {total} sessions had multi-source context
        </span>
      )}
      {tools > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/70 bg-surface-900/60 px-2.5 py-1 text-[11px] text-text-muted/80">
          <ShieldCheck size={11} className="text-text-muted/70 shrink-0" />
          {tools} of {total} sessions had full model + tool data
        </span>
      )}
    </div>
  )
}
