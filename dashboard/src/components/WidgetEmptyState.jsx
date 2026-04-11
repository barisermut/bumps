/**
 * Consistent empty state for widget bodies (dark theme, matches WidgetShell).
 */
export default function WidgetEmptyState({
  title,
  hint,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-1.5 px-4 py-6 min-h-[7rem] ${className}`}
    >
      <p className="font-display text-base text-text-primary leading-snug max-w-sm">
        {title}
      </p>
      {hint && (
        <p className="text-sm text-text-muted leading-relaxed max-w-sm">
          {hint}
        </p>
      )}
    </div>
  )
}
