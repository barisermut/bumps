import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import Modal from './Modal'

/**
 * @param {{
 *   sectionTitle: string;
 *   sessionCount: number;
 *   projectLabel: string;
 *   timeRangeLabel: string;
 * }} props
 */
export default function HowThisWorksButton({
  sectionTitle,
  sessionCount,
  projectLabel,
  timeRangeLabel,
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-1 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
        aria-label={`How does ${sectionTitle} work?`}
      >
        <HelpCircle size={16} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="How does this work?">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            <span className="text-text-primary font-medium">{sectionTitle}</span>
            {' '}is based on your Cursor conversation history on this machine — not raw code or file contents.
          </p>
          <p>
            For this view we analyzed{' '}
            <span className="text-text-primary">{sessionCount}</span>
            {' '}session{sessionCount === 1 ? '' : 's'}{' '}
            {projectLabel} · {timeRangeLabel}.
          </p>
          <p>
            Mentor used message text, timestamps, tool usage, and file references your sessions already contain. It looked for behavioral patterns and themes across those sessions.
          </p>
          <p className="text-text-primary">
            Everything ran locally. Bumps never saw your data. Cursor Agent ran under your own account on your machine.
          </p>
        </div>
      </Modal>
    </>
  )
}
