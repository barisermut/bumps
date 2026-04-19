import { useState, useEffect } from 'react'
import AppBootSkeleton from './components/AppBootSkeleton'
import MirrorDashboard from './MirrorDashboard'
import MentorDashboard from './MentorDashboard'

export default function App() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [timeRange, setTimeRange] = useState('all')
  const [mode, setMode] = useState(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (import.meta.env.DEV) {
          const n = Array.isArray(data?.projects) ? data.projects.length : 0
          console.log(`[bumps] /api/projects → ${n} project(s)`)
        }
        setProjects(data.projects || [])
      })
      .catch((err) => console.error('[bumps] Failed to fetch projects:', err))
  }, [])

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('devMentor') === '1'
    ) {
      setMode('mentor')
      return
    }

    fetch('/api/mode')
      .then((r) => r.json())
      .then((d) => setMode(d.mode === 'mentor' ? 'mentor' : 'mirror'))
      .catch(() => setMode('mirror'))
  }, [])

  if (mode === null) {
    return <AppBootSkeleton />
  }

  if (mode === 'mentor') {
    return <MentorDashboard />
  }

  return (
    <MirrorDashboard
      projects={projects}
      selectedProject={selectedProject}
      onProjectChange={setSelectedProject}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
    />
  )
}
