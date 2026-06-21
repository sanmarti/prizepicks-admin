import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { listSprints, createSprint } from '../../api/sprints'

const STATUS_COLORS = {
  draft:     'bg-gray-700/50 text-gray-400',
  scheduled: 'bg-blue-900/40 text-blue-400',
  live:      'bg-green-900/40 text-green-400',
  completed: 'bg-purple-900/40 text-purple-400',
  archived:  'bg-gray-800/40 text-gray-600',
}

function SprintCard({ sprint, onClick }) {
  const now = new Date()
  const start = new Date(sprint.start_date)
  const end   = new Date(sprint.end_date)
  const daysLeft = sprint.status === 'live'
    ? Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div
      onClick={onClick}
      className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 cursor-pointer hover:border-indigo-500/40 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">{sprint.name}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {new Date(sprint.start_date).toLocaleDateString()} →{' '}
            {new Date(sprint.end_date).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sprint.status] || 'bg-gray-700 text-gray-400'}`}>
          {sprint.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/5 rounded-xl p-2 text-center">
          <p className="text-gray-500">Gameweeks</p>
          <p className="text-white font-medium mt-0.5">{sprint.linked_gameweeks}/{sprint.gameweek_count}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2 text-center">
          <p className="text-gray-500">Players</p>
          <p className="text-white font-medium mt-0.5">{sprint.participants ?? 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2 text-center">
          <p className="text-gray-500">{sprint.status === 'live' ? 'Days left' : 'Duration'}</p>
          <p className="text-white font-medium mt-0.5">
            {daysLeft !== null
              ? daysLeft + 'd'
              : Math.round((end - start) / (1000 * 60 * 60 * 24)) + 'd'}
          </p>
        </div>
      </div>
    </div>
  )
}

function CreateSprintModal({ onCreated, onClose }) {
  const now = new Date()
  const fourWeeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 16)

  const [form, setForm] = useState({
    name: `Sprint ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,
    start_date: fmt(now),
    end_date: fmt(fourWeeks),
    gameweek_count: 4,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const res = await createSprint(form)
      onCreated(res.data)
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create sprint')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"
  const labelCls = "text-gray-400 text-xs mb-1 block"

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-white font-semibold text-sm">Create Sprint</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-red-400 text-xs bg-red-900/20 p-2 rounded-xl">{err}</p>}

          <div>
            <label className={labelCls}>Sprint name</label>
            <input className={inputCls} value={form.name}
              onChange={e => set('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start date &amp; time</label>
              <input className={inputCls} type="datetime-local" value={form.start_date}
                onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>End date &amp; time</label>
              <input className={inputCls} type="datetime-local" value={form.end_date}
                onChange={e => set('end_date', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className={labelCls}>Number of gameweeks</label>
            <input className={inputCls} type="number" min="1" max="8" value={form.gameweek_count}
              onChange={e => set('gameweek_count', parseInt(e.target.value))} required />
          </div>

          <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            After creating the sprint, go to its detail page to add the {form.gameweek_count} gameweeks and publish them. Then activate the sprint to start the competition.
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create sprint'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    listSprints()
      .then(r => setSprints(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const liveSprint  = sprints.find(s => s.status === 'live')
  const nextSprints = sprints.filter(s => ['scheduled','draft'].includes(s.status))
  const pastSprints = sprints.filter(s => ['completed','archived'].includes(s.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Sprints</h1>
          <p className="text-gray-500 text-sm mt-0.5">4-week competitive blocks for 6 to Glory</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          + New sprint
        </button>
      </div>

      {loading && <div className="text-center text-gray-500 py-12">Loading…</div>}

      {!loading && liveSprint && (
        <section>
          <p className="text-green-400 text-xs font-medium tracking-widest mb-3">LIVE</p>
          <SprintCard sprint={liveSprint} onClick={() => navigate(`/admin/sprints/${liveSprint.id}`)} />
        </section>
      )}

      {!loading && nextSprints.length > 0 && (
        <section>
          <p className="text-blue-400 text-xs font-medium tracking-widest mb-3">UPCOMING</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nextSprints.map(s => (
              <SprintCard key={s.id} sprint={s} onClick={() => navigate(`/admin/sprints/${s.id}`)} />
            ))}
          </div>
        </section>
      )}

      {!loading && pastSprints.length > 0 && (
        <section>
          <p className="text-gray-500 text-xs font-medium tracking-widest mb-3">PAST</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastSprints.map(s => (
              <SprintCard key={s.id} sprint={s} onClick={() => navigate(`/admin/sprints/${s.id}`)} />
            ))}
          </div>
        </section>
      )}

      {!loading && sprints.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-gray-400 font-medium">No sprints yet</p>
          <p className="text-gray-600 text-sm mt-1">Create the first Sprint to start 6 to Glory</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition-colors"
          >
            Create first sprint
          </button>
        </div>
      )}

      {showCreate && (
        <CreateSprintModal
          onCreated={(sprint) => {
            setShowCreate(false)
            navigate(`/admin/sprints/${sprint.id}`)
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
