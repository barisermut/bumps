import { useState } from 'react'
import Modal from './Modal'
import WidgetEmptyState from './WidgetEmptyState'
import { FILTER_EMPTY_HINT } from '../lib/insightsEmpty'

const COLOR_GREEN = 'oklch(0.60 0.10 155)'
const COLOR_AMBER = 'oklch(0.74 0.14 65)'
const COLOR_RED = 'oklch(0.65 0.18 25)'

function groupByDate(timeline) {
  const sorted = [...timeline].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return da - db
  })
  const map = {}
  for (const entry of sorted) {
    const key = entry.date ? entry.date.split('T')[0] : 'unknown'
    if (!map[key]) map[key] = []
    map[key].push(entry)
  }
  return Object.entries(map).map(([date, entries]) => ({ date, entries }))
}

function getRiskLevel(timeline) {
  const byDate = {}
  for (const entry of timeline) {
    const key = entry.date ? entry.date.split('T')[0] : 'unknown'
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(entry)
  }
  const maxOnDay = Math.max(...Object.values(byDate).map((e) => e.length), 0)
  if (maxOnDay >= 4) return 'red'
  if (maxOnDay >= 3) return 'amber'
  return 'green'
}

function getPatternLabel(timeline) {
  const sorted = [...timeline].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return da - db
  })
  if (sorted.length === 0) return 'No data'
  const firstDate = sorted[0].date ? sorted[0].date.split('T')[0] : 'unknown'
  const firstDayCount = sorted.filter(
    (e) => (e.date ? e.date.split('T')[0] : 'unknown') === firstDate
  ).length
  if (firstDayCount >= 4) return 'Early burst'
  if (firstDayCount >= 3) return 'Moderate'
  return 'Gradual'
}

function getPeakDay(timeline) {
  const byDate = {}
  for (const entry of timeline) {
    const key = entry.date ? entry.date.split('T')[0] : 'unknown'
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(entry)
  }
  let peakDate = null
  let peakCount = 0
  for (const [date, entries] of Object.entries(byDate)) {
    if (entries.length > peakCount) {
      peakCount = entries.length
      peakDate = date
    }
  }
  return { date: peakDate, count: peakCount }
}

function riskDotColor(risk) {
  if (risk === 'red') return COLOR_RED
  if (risk === 'amber') return COLOR_AMBER
  return COLOR_GREEN
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'unknown') return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getStartDate(timeline) {
  const sorted = [...timeline].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return da - db
  })
  if (sorted.length === 0) return ''
  return sorted[0].date ? sorted[0].date.split('T')[0] : ''
}

function getUniqueDays(timeline) {
  const dates = new Set()
  for (const entry of timeline) {
    if (entry.date) dates.add(entry.date.split('T')[0])
  }
  return dates.size
}

export default function ScopeDrift({ scopeDrift, scopeEmpty = false, loading = false }) {
  const [modal, setModal] = useState(null)

  if (loading) {
    return <WidgetEmptyState title="Loading insights…" className="h-full min-h-[12rem]" />
  }
  if (!scopeDrift || scopeDrift.length === 0) {
    return (
      <WidgetEmptyState
        title={
          scopeEmpty
            ? 'No sessions in this range'
            : 'No scope drift for this range'
        }
        hint={
          scopeEmpty
            ? FILTER_EMPTY_HINT
            : 'This view only marks days when a new topic first appeared in a project, not every day you had sessions.'
        }
        className="h-full min-h-[12rem]"
      />
    )
  }

  // Prepare and sort cards
  const cards = scopeDrift.map((proj) => {
    const risk = getRiskLevel(proj.timeline)
    const pattern = getPatternLabel(proj.timeline)
    const peak = getPeakDay(proj.timeline)
    const totalTopics = proj.timeline.length
    const days = getUniqueDays(proj.timeline)
    const startDate = getStartDate(proj.timeline)
    return { project: proj.project, timeline: proj.timeline, risk, pattern, peak, totalTopics, days, startDate }
  })

  const riskOrder = { red: 0, amber: 1, green: 2 }
  cards.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk])

  function openModal(card) {
    const days = groupByDate(card.timeline)
    setModal({ project: card.project, days })
  }

  return (
    <>
      <div className="w-full h-full overflow-y-auto pr-1 custom-scroll">
        <div className="space-y-1.5">
          {cards.map((card) => {
            const dotColor = riskDotColor(card.risk)
            return (
              <button
                key={card.project}
                className="w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer border"
                style={{
                  backgroundColor: 'oklch(0.14 0.008 55)',
                  borderColor: 'oklch(0.22 0.01 50)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'oklch(0.18 0.01 50)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'oklch(0.14 0.008 55)'
                }}
                onClick={() => openModal(card)}
              >
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 220px 100px' }}>
                  {/* Left: dot + name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="text-[13px] font-medium text-text-primary truncate">
                      {card.project}
                    </span>
                  </div>

                  {/* Middle: summary — fixed width */}
                  <span className="text-[11px] text-text-muted text-center">
                    {card.totalTopics} new topics · {card.days} topic days · started {formatDate(card.startDate)}
                  </span>

                  {/* Right: pattern label — fixed width */}
                  <div className="text-right">
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: dotColor }}
                    >
                      {card.pattern}
                    </span>
                    <div className="text-[10px] text-text-muted/50 leading-tight">
                      Peak: {formatDate(card.peak.date)} — {card.peak.count} topics
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? modal.project : ''}
      >
        {modal && (
          <div className="relative pl-5">
            <p className="text-[11px] text-text-muted/70 mb-3">
              Dates here show when new topics first entered this project, not every session day.
            </p>
            {/* Vertical timeline line */}
            <div
              className="absolute left-[5px] top-1 bottom-1 w-px"
              style={{ backgroundColor: 'oklch(0.28 0.01 50)' }}
            />

            <div className="space-y-4">
              {modal.days.map((day, i) => (
                <div key={day.date} className="relative">
                  {/* Dot on the timeline */}
                  <div
                    className="absolute -left-5 top-[5px] w-[11px] h-[11px] rounded-full border-2"
                    style={{
                      borderColor: 'oklch(0.45 0.01 55)',
                      backgroundColor: 'oklch(0.16 0.01 55)',
                    }}
                  />

                  {/* Date */}
                  <div className="text-[12px] font-medium text-text-secondary">
                    {formatDate(day.date)}
                  </div>

                  {/* Concepts */}
                  <div className="mt-1 space-y-0.5">
                    {day.entries.map((entry, j) => (
                      <div key={j} className="text-[11px] text-text-muted leading-relaxed">
                        {entry.concept}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
