import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { listSprints, createSprint } from '../../api/sprints'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS = {
  draft:     { bg: 'bg-gray-700/50', text: 'text-gray-400' },
  scheduled: { bg: 'bg-blue-900/40', text: 'text-blue-400' },
  live:      { bg: 'bg-green-900/40', text: 'text-green-400' },
  completed: { bg: 'bg-purple-900/40', text: 'text-purple-400' },
  archived:  { bg: 'bg-gray-800/40', text: 'text-gray-500' },
}

const GW_BAR_COLORS = ['bg-gray-600', 'bg-blue-500', 'bg-green-500', 'bg-purple-500']

function getMonthIndex(sprintName) {
  if (!sprintName) return -1
  for (let i = 0; i < MONTHS.length; i++) {
    if (sprintName.toLowerCase().includes(MONTHS[i].toLowerCase())) return i
  }
  return -1
}

function getYear(sprintName) {
  const m = sprintName?.match(/\d{4}/)
  return m ? parseInt(m[0]) : null
}

function firstMondayOfMonth(year, month) {
  const d   = new Date(Date.UTC(year, month, 1))
  const dow = d.getUTCDay() // 0=Sun, 1=Mon, …
  const offset = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow
  return new Date(Date.UTC(year, month, 1 + offset))
}

function buildYearSprints(year) {
  const startMonth = year === 2026 ? 6 : 0
  return MONTHS.slice(startMonth).map((name, i) => {
    const monthIdx = startMonth + i
    const start = firstMondayOfMonth(year, monthIdx)
    const end   = new Date(start.getTime() + 28 * 86400000 - 1000) // 4 weeks later, Sunday 23:59:59
    return {
      name:           `Sprint of ${name} ${year}`,
      start_date:     start.toISOString(),
      end_date:       end.toISOString(),
      gameweek_count: 4,
    }
  })
}

// ── Sprint card ───────────────────────────────────────────────────────────────
function SprintCard({ sprint, onClick }) {
  const sc = STATUS_COLORS[sprint.status] || STATUS_COLORS.draft
  const gwLinked = sprint.linked_gameweeks ?? 0
  const gwTotal  = sprint.gameweek_count ?? 4
  const pct = (gwLinked / gwTotal) * 100

  return (
    <div
      onClick={onClick}
      className="group bg-[#0d1117] border border-white/8 rounded-2xl p-4 cursor-pointer hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{sprint.name}</h3>
          <p className="text-gray-600 text-[11px] mt-0.5">
            {new Date(sprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' – '}
            {new Date(sprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${sc.bg} ${sc.text}`}>
          {sprint.status?.toUpperCase()}
        </span>
      </div>

      {/* Gameweek progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1.5">
          <span>Gameweeks configured</span>
          <span className="text-white font-medium">{gwLinked}/{gwTotal}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: gwTotal }, (_, i) => (
            <div key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors ${i < gwLinked ? GW_BAR_COLORS[Math.min(i, 3)] : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-600">{sprint.participants ?? 0} players</span>
        <span className="text-indigo-400 group-hover:text-indigo-300 font-medium transition-colors">
          Configure →
        </span>
      </div>
    </div>
  )
}

// ── Generate year button ──────────────────────────────────────────────────────
function GenerateYearButton({ year, existingSprints, onGenerated }) {
  const [state, setState] = useState('idle') // idle | running | done
  const [progress, setProgress] = useState(0)

  const toCreate = buildYearSprints(year).filter(s =>
    !existingSprints.some(e => e.name === s.name)
  )

  if (toCreate.length === 0) return null

  const handleGenerate = async () => {
    setState('running')
    let created = 0
    for (const sprint of toCreate) {
      try {
        await createSprint(sprint)
        created++
        setProgress(Math.round((created / toCreate.length) * 100))
      } catch {
        // skip duplicates / errors
      }
    }
    setState('done')
    setTimeout(() => { setState('idle'); setProgress(0); onGenerated() }, 800)
  }

  return (
    <div className="flex items-center gap-3 bg-indigo-900/15 border border-indigo-500/20 rounded-2xl p-4">
      <div className="flex-1">
        <p className="text-indigo-300 text-sm font-medium">
          {toCreate.length} sprint{toCreate.length > 1 ? 's' : ''} missing for {year}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">
          {toCreate.map(s => s.name.split(' ')[0]).join(', ')}
        </p>
        {state === 'running' && (
          <div className="mt-2 bg-white/5 rounded-full h-1.5">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <button
        onClick={handleGenerate}
        disabled={state !== 'idle'}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 flex-shrink-0"
      >
        {state === 'idle' && `Generate ${toCreate.length} sprint${toCreate.length > 1 ? 's' : ''}`}
        {state === 'running' && `Creating… ${progress}%`}
        {state === 'done' && 'Done!'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SprintsPage() {
  const [sprints, setSprints]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [activeYear, setActiveYear]   = useState(2026)
  const [monthFilter, setMonthFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate]   = useState(false)
  const navigate = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    return listSprints()
      .then(r => r.data)
      .catch(() => [])
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load().then(async (data) => {
      const toCreate = [2026, 2027].flatMap(year =>
        buildYearSprints(year).filter(s => !data.some(e => e.name === s.name))
      )
      if (toCreate.length === 0) { setSprints(data); return }
      setAutoGenerating(true)
      setSprints(data)
      for (const sprint of toCreate) {
        try { await createSprint(sprint) } catch { /* skip duplicates */ }
      }
      setAutoGenerating(false)
      load().then(setSprints)
    })
  }, [load])

  // Filter to the selected year
  const yearSprints = sprints.filter(s => getYear(s.name) === activeYear)

  // Apply month + status filters
  const filtered = yearSprints.filter(s => {
    if (monthFilter !== null && getMonthIndex(s.name) !== monthFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    return true
  })

  // Which months have sprints in the selected year
  const monthsWithSprints = new Set(yearSprints.map(s => getMonthIndex(s.name)).filter(m => m >= 0))

  // Group filtered sprints by month (for month-labeled sections)
  const byMonth = []
  const seen = new Set()
  for (const s of filtered) {
    const mi = getMonthIndex(s.name)
    if (!seen.has(mi)) { seen.add(mi); byMonth.push({ monthIdx: mi, sprints: [] }) }
    byMonth.find(g => g.monthIdx === mi).sprints.push(s)
  }
  byMonth.sort((a, b) => a.monthIdx - b.monthIdx)

  // Live sprint from any year
  const liveSprint = sprints.find(s => s.status === 'live')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Sprints</h1>
          <p className="text-gray-500 text-sm mt-0.5">4-week competitive blocks for OddsRivals</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          + New sprint
        </button>
      </div>

      {/* Live banner */}
      {liveSprint && (
        <div
          onClick={() => navigate(`/admin/sprints/${liveSprint.id}`)}
          className="flex items-center justify-between bg-green-900/15 border border-green-500/30 rounded-2xl px-5 py-3 cursor-pointer hover:border-green-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <div>
              <p className="text-green-300 text-sm font-semibold">{liveSprint.name} — LIVE</p>
              <p className="text-gray-500 text-xs">{liveSprint.participants ?? 0} players competing</p>
            </div>
          </div>
          <span className="text-green-400 text-sm">View →</span>
        </div>
      )}

      {/* Year tabs */}
      <div className="flex items-center gap-1 bg-white/3 border border-white/8 rounded-2xl p-1 w-fit">
        {[2026, 2027].map(y => (
          <button key={y}
            onClick={() => { setActiveYear(y); setMonthFilter(null) }}
            className={`px-5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeYear === y
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {y}
            {sprints.filter(s => getYear(s.name) === y).length > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">
                ({sprints.filter(s => getYear(s.name) === y).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Month pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setMonthFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            monthFilter === null
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-gray-500 hover:text-gray-300'
          }`}
        >
          All months
        </button>
        {MONTHS_SHORT.map((m, i) => (
          <button key={i}
            onClick={() => setMonthFilter(monthFilter === i ? null : i)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              monthFilter === i
                ? 'bg-indigo-600 text-white'
                : monthsWithSprints.has(i)
                  ? 'bg-white/8 text-gray-300 hover:bg-white/12'
                  : 'bg-white/3 text-gray-700 hover:text-gray-500'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5">
        {['all','draft','scheduled','live','completed'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-white/15 text-white'
                : 'bg-white/5 text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Auto-generating banner */}
      {autoGenerating && (
        <div className="flex items-center gap-3 bg-indigo-900/15 border border-indigo-500/20 rounded-2xl px-5 py-3">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-indigo-300 text-sm">Creating sprint schedule for 2026–2027…</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 animate-pulse">
              <div className="h-3 bg-white/5 rounded w-2/3 mb-2"/>
              <div className="h-2 bg-white/5 rounded w-1/2 mb-4"/>
              <div className="h-1.5 bg-white/5 rounded-full"/>
            </div>
          ))}
        </div>
      )}

      {/* Sprint list grouped by month */}
      {!loading && byMonth.length > 0 && byMonth.map(({ monthIdx, sprints: mSprints }) => (
        <section key={monthIdx}>
          <p className="text-gray-600 text-xs font-medium tracking-widest mb-2 uppercase">
            {MONTHS[monthIdx]}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mSprints.map(s => (
              <SprintCard key={s.id} sprint={s} onClick={() => navigate(`/admin/sprints/${s.id}`)} />
            ))}
          </div>
        </section>
      ))}

      {/* Empty state */}
      {!loading && filtered.length === 0 && yearSprints.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="text-gray-400 font-medium">No sprints for {activeYear}</p>
          <p className="text-gray-600 text-sm mt-1">Use the button above to generate all monthly sprints automatically</p>
        </div>
      )}

      {!loading && filtered.length === 0 && yearSprints.length > 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500 text-sm">No sprints match the current filter</p>
          <button onClick={() => { setMonthFilter(null); setStatusFilter('all') }}
            className="mt-2 text-indigo-400 text-xs hover:text-indigo-300">
            Clear filters
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateSprintModal
          onCreated={(sprint) => { setShowCreate(false); navigate(`/admin/sprints/${sprint.id}`) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

// ── Manual create modal ───────────────────────────────────────────────────────
function CreateSprintModal({ onCreated, onClose }) {
  const now   = new Date()
  const start = firstMondayOfMonth(now.getUTCFullYear(), now.getUTCMonth())
  const end   = new Date(start.getTime() + 28 * 86400000 - 1000)
  const fmt   = (d) => d.toISOString().slice(0, 16)

  const [form, setForm] = useState({
    name: `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    start_date: fmt(start),
    end_date: fmt(end),
    gameweek_count: 4,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"

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
            <label className="text-gray-400 text-xs mb-1 block">Sprint name</label>
            <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Start</label>
              <input className={inp} type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">End</label>
              <input className={inp} type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} required />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Creating…' : 'Create sprint'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
