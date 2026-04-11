export default function WidgetShell({ title, subtitle, verdict, icon: Icon, span = '', flush = false, children }) {
  return (
    <div className={`bg-surface-900 rounded-xl border border-border-subtle p-4 flex flex-col ${span}`}>
      <div className="mb-2">
        <span className="text-xs font-medium tracking-wide uppercase text-text-muted inline-flex items-center gap-1.5">
          {Icon && <Icon size={14} className="text-text-muted" />}
          {title}
        </span>
        {subtitle && (
          <p className="text-[11px] text-text-muted/60 mt-0.5 leading-tight">
            {subtitle}
          </p>
        )}
        {verdict && (
          <p className="text-[11px] text-text-muted/60 mt-[2px] leading-tight">
            {verdict}
          </p>
        )}
      </div>
      <div className={`flex-1 min-h-0 ${flush ? '' : 'flex items-center justify-center'}`}>
        {children || (
          <span className="text-text-muted/40 text-sm italic flex items-center justify-center h-full">
            Coming soon
          </span>
        )}
      </div>
    </div>
  )
}
