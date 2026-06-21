import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  getSprint, updateSprint, activateSprint, settleSprint,
  addSprintGameweek, removeSprintGameweek, getRankings, getAvailableFixtures,
} from '../../api/sprints'
import { publishGameweek } from '../../api/gameweeks'

const STATUS_COLORS = {
  draft: 'text-gray-400', scheduled: 'text-blue-400',
  live: 'text-green-400',  completed: 'text-purple-400',
}

const EVENT_TYPES = ['MATCH_RESULT', 'GOALS', 'CLEAN_SHEET', 'PLAYER_SCORE']
const DEFAULT_OPTIONS = {
  MATCH_RESULT: ['Home Win', 'Draw', 'Away Win'],
  GOALS: ['Over 2.5', 'Under 2.5'],
  CLEAN_SHEET: ['Yes', 'No'],
  PLAYER_SCORE: ['Scores', 'Does not score'],
}

// ── Gameweek Builder ──────────────────────────────────────────────────────────
function GameweekBuilder({ sprintId, sprintWeek, sprintStart, sprintEnd, onSaved, onCancel }) {
  const now = new Date()
  const weekOffset = (sprintWeek - 1) * 7
  const weekStart  = new Date(new Date(sprintStart).getTime() + weekOffset * 86400000)
  const weekEnd    = new Date(weekStart.getTime() + 7 * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 16)

  const [lockTime, setLockTime] = useState(fmt(weekEnd))
  const [dateFrom, setDateFrom] = useState(weekStart.toISOString().slice(0, 10))
  const [dateTo, setDateTo]     = useState(weekEnd.toISOString().slice(0, 10))
  const [fixtures, setFixtures] = useState([])
  const [loadingFix, setLoadingFix] = useState(false)
  const [events, setEvents] = useState([])   // selected events (max 15)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const loadFixtures = async () => {
    if (!dateFrom || !dateTo) return
    setLoadingFix(true)
    try {
      const res = await getAvailableFixtures({ date_from: dateFrom + 'T00:00:00', date_to: dateTo + 'T23:59:59' })
      setFixtures(res.data)
    } catch {
      setFixtures([])
    } finally {
      setLoadingFix(false)
    }
  }

  useEffect(() => { loadFixtures() }, [])

  const isSelected = (fixtureId) => events.some(ev => ev.fixture_id === String(fixtureId))

  const toggleFixture = (fix) => {
    if (isSelected(fix.id)) {
      setEvents(prev => prev.filter(ev => ev.fixture_id !== String(fix.id)))
    } else if (events.length < 15) {
      const home = fix.home_team
      const away = fix.away_team
      setEvents(prev => [...prev, {
        fixture_id: String(fix.id),
        fixture_name: `${home} vs ${away}`,
        match_time: fix.date,
        competition: fix.competition_name || '',
        event_type: 'MATCH_RESULT',
        options: [
          { label: `${home} Win`, energy_cost: 5 },
          { label: 'Draw',        energy_cost: 5 },
          { label: `${away} Win`, energy_cost: 5 },
        ],
      }])
    }
  }

  const updateEventType = (idx, type) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      const labels = DEFAULT_OPTIONS[type] || ['Option 1', 'Option 2']
      return {
        ...ev,
        event_type: type,
        options: labels.map(label => ({ label, energy_cost: 5 })),
      }
    }))
  }

  const updateOptionLabel = (evIdx, optIdx, label) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== evIdx) return ev
      const opts = ev.options.map((o, j) => j === optIdx ? { ...o, label } : o)
      return { ...ev, options: opts }
    }))
  }

  const removeEvent = (idx) => setEvents(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async (publish = false) => {
    if (events.length !== 15) { setErr('Exactly 15 events required'); return }
    setSaving(true); setErr('')
    try {
      const res = await addSprintGameweek(sprintId, {
        sprint_week: sprintWeek,
        lock_time: lockTime,
        events,
      })
      if (publish) {
        await publishGameweek(res.data.gameweek_id)
      }
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"

  return (
    <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Week {sprintWeek} — Gameweek Builder</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-white text-sm">✕ Cancel</button>
      </div>

      {err && <p className="text-red-400 text-xs bg-red-900/20 p-2 rounded-xl">{err}</p>}

      {/* Lock time + date range */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Lock time (picks deadline)</label>
          <input className={`w-full ${inputCls}`} type="datetime-local" value={lockTime}
            onChange={e => setLockTime(e.target.value)} />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Fixtures from</label>
          <input className={`w-full ${inputCls}`} type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Fixtures to</label>
          <input className={`w-full ${inputCls}`} type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <button onClick={loadFixtures}
        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">
        {loadingFix ? 'Loading…' : 'Load fixtures'}
      </button>

      {/* Fixture picker */}
      {fixtures.length > 0 && (
        <div>
          <p className="text-gray-400 text-xs mb-2">
            Available fixtures ({fixtures.length}) — select up to 15.{' '}
            <span className="text-indigo-400">Selected: {events.length}/15</span>
          </p>
          <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
            {fixtures.map(fix => {
              const sel = isSelected(fix.id)
              return (
                <button
                  key={fix.id}
                  onClick={() => toggleFixture(fix)}
                  disabled={!sel && events.length >= 15}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    sel ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' :
                    'bg-white/5 border border-transparent text-gray-400 hover:bg-white/10 disabled:opacity-40'
                  }`}
                >
                  <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] ${sel ? 'bg-indigo-500' : 'bg-white/10'}`}>
                    {sel ? '✓' : ''}
                  </span>
                  <span className="flex-1 font-medium">
                    {fix.home_team} <span className="text-gray-500">vs</span> {fix.away_team}
                  </span>
                  <span className="text-gray-600 flex-shrink-0">{fix.competition_name}</span>
                  <span className="text-gray-600 flex-shrink-0">
                    {new Date(fix.date).toLocaleDateString()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected events editor */}
      {events.length > 0 && (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs font-medium">Selected events ({events.length}/15)</p>
          {events.map((ev, evIdx) => (
            <div key={ev.fixture_id} className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-white text-xs font-medium">{ev.fixture_name}</p>
                <button onClick={() => removeEvent(evIdx)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ev.event_type}
                  onChange={e => updateEventType(evIdx, e.target.value)}
                  className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-gray-300 text-xs"
                >
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex gap-2 flex-1 flex-wrap">
                  {ev.options.map((opt, optIdx) => (
                    <input
                      key={optIdx}
                      value={opt.label}
                      onChange={e => updateOptionLabel(evIdx, optIdx, e.target.value)}
                      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-gray-300 text-xs w-28"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="flex-1 bg-white/5 rounded-full h-1.5">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(events.length / 15) * 100}%` }} />
        </div>
        {events.length}/15 events
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleSave(false)}
          disabled={saving || events.length !== 15}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || events.length !== 15}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
        >
          {saving ? 'Publishing…' : 'Save & publish'}
        </button>
      </div>
    </div>
  )
}

// ── Gameweek slot card ────────────────────────────────────────────────────────
function GameweekSlot({ week, gw, sprint, onBuild, onPublish, onRemove }) {
  if (!gw) {
    return (
      <div className="bg-[#0d1117] border border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <p className="text-gray-600 text-sm">Week {week} — empty</p>
        <button
          onClick={() => onBuild(week)}
          className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-xl text-sm transition-colors"
        >
          + Add gameweek
        </button>
      </div>
    )
  }

  const statusColors = {
    DRAFT:     'bg-gray-700/50 text-gray-400',
    PUBLISHED: 'bg-blue-900/40 text-blue-400',
    LOCKED:    'bg-yellow-900/40 text-yellow-400',
    FINISHED:  'bg-purple-900/40 text-purple-400',
  }

  return (
    <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs">Week {week}</p>
          <p className="text-white font-medium text-sm mt-0.5">Gameweek #{gw.sprint_week}</p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusColors[gw.status] || 'bg-gray-700 text-gray-400'}`}>
          {gw.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/5 rounded-xl p-2">
          <p className="text-gray-500">Events</p>
          <p className="text-white font-medium">{gw.event_count}/15</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2">
          <p className="text-gray-500">Entries</p>
          <p className="text-white font-medium">{gw.entry_count}</p>
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Lock: {new Date(gw.lock_time).toLocaleString()}
      </div>

      <div className="flex gap-2">
        {gw.status === 'DRAFT' && (
          <button
            onClick={() => onPublish(gw.id)}
            className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-xs transition-colors"
          >
            Publish
          </button>
        )}
        {gw.status === 'DRAFT' && (
          <button
            onClick={() => onRemove(gw.id)}
            className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-xs transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── Rankings tab ──────────────────────────────────────────────────────────────
function RankingsTab({ sprintId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRankings({ sprint_id: sprintId })
      .then(r => setRows(r.data.rows || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sprintId])

  if (loading) return <div className="text-center text-gray-500 py-8">Loading rankings…</div>
  if (!rows.length) return <div className="text-center text-gray-500 py-8">No participants yet</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-white/8">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">Player</th>
            <th className="text-left py-2 px-3">Division</th>
            <th className="text-right py-2 px-3">LP</th>
            <th className="text-right py-2 px-3">Correct</th>
            <th className="text-right py-2 px-3">Perfect</th>
            <th className="text-right py-2 px-3">GWs</th>
            <th className="text-left py-2 px-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className="border-b border-white/5 hover:bg-white/3">
              <td className="py-2 px-3 text-gray-400">{r.rank}</td>
              <td className="py-2 px-3 text-white">{r.display_name || r.email?.split('@')[0]}</td>
              <td className="py-2 px-3">
                <span className="text-xs">{r.division_icon} {r.division_name}</span>
              </td>
              <td className="py-2 px-3 text-right font-bold text-indigo-400">{r.total_league_points}</td>
              <td className="py-2 px-3 text-right text-gray-300">{r.total_correct_picks}</td>
              <td className="py-2 px-3 text-right text-yellow-400">{r.perfect_weeks}⭐</td>
              <td className="py-2 px-3 text-right text-gray-400">{r.gameweeks_participated}</td>
              <td className="py-2 px-3">
                {r.is_rookie ? (
                  <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Rookie</span>
                ) : r.sprint_outcome === 'promoted' ? (
                  <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">⬆ Promoted</span>
                ) : r.sprint_outcome === 'relegated' ? (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">⬇ Relegated</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SprintDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sprint, setSprint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('gameweeks')
  const [buildingWeek, setBuildingWeek] = useState(null)
  const [actionMsg, setActionMsg] = useState('')
  const [confirming, setConfirming] = useState(null)   // 'activate' | 'settle'

  const load = useCallback(() => {
    getSprint(id)
      .then(r => setSprint(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const gwByWeek = {}
  if (sprint?.gameweeks) {
    for (const gw of sprint.gameweeks) gwByWeek[gw.sprint_week] = gw
  }

  const handlePublish = async (gwId) => {
    try {
      await publishGameweek(gwId)
      setActionMsg('Gameweek published!')
      load()
    } catch (e) {
      setActionMsg('Error: ' + (e.response?.data?.message || 'publish failed'))
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleRemove = async (gwId) => {
    try {
      await removeSprintGameweek(id, gwId)
      setActionMsg('Gameweek removed from sprint')
      load()
    } catch {
      setActionMsg('Remove failed')
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleActivate = async () => {
    try {
      await activateSprint(id)
      setActionMsg('Sprint activated! Competition is live.')
      setConfirming(null)
      load()
    } catch (e) {
      setActionMsg('Error: ' + (e.response?.data?.message || 'activate failed'))
      setConfirming(null)
    }
    setTimeout(() => setActionMsg(''), 4000)
  }

  const handleSettle = async () => {
    try {
      const res = await settleSprint(id)
      setActionMsg(`Sprint settled! ${res.data.promotions}↑ promoted, ${res.data.relegations}↓ relegated, ${res.data.retentions} retained.`)
      setConfirming(null)
      load()
    } catch (e) {
      setActionMsg('Error: ' + (e.response?.data?.message || 'settlement failed'))
      setConfirming(null)
    }
    setTimeout(() => setActionMsg(''), 5000)
  }

  const handleStatusChange = async (status) => {
    try {
      await updateSprint(id, { status })
      load()
    } catch {}
  }

  if (loading) return <div className="text-center text-gray-500 py-16">Loading sprint…</div>
  if (!sprint) return <div className="text-center text-gray-400 py-16">Sprint not found</div>

  const tabs = ['gameweeks', 'rankings', 'settings']
  const gameweekCount = sprint.gameweek_count || 4

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/admin/sprints')}
            className="text-gray-500 hover:text-white text-sm mb-2 flex items-center gap-1">
            ← Back to Sprints
          </button>
          <h1 className="text-white text-xl font-bold">{sprint.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date(sprint.start_date).toLocaleDateString()} →{' '}
            {new Date(sprint.end_date).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-sm font-medium ${STATUS_COLORS[sprint.status] || 'text-gray-400'}`}>
          {sprint.status?.toUpperCase()}
        </span>
      </div>

      {/* Stats */}
      {sprint.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Participants', sprint.stats.participants],
            ['Total LP earned', sprint.stats.total_league_points],
            ['Perfect Weeks', sprint.stats.total_perfect_weeks],
            ['Promotions / Relegations', `${sprint.stats.promotions ?? 0} / ${sprint.stats.relegations ?? 0}`],
          ].map(([label, val]) => (
            <div key={label} className="bg-[#0d1117] border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="text-white font-bold text-lg mt-1">{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action message */}
      {actionMsg && (
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-indigo-300 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {sprint.status === 'draft' && (
          <button onClick={() => handleStatusChange('scheduled')}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-xl text-sm transition-colors">
            Mark as scheduled
          </button>
        )}
        {['draft','scheduled'].includes(sprint.status) && (
          <button onClick={() => setConfirming('activate')}
            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-xl text-sm transition-colors">
            Activate sprint (go live)
          </button>
        )}
        {sprint.status === 'live' && (
          <button onClick={() => setConfirming('settle')}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-xl text-sm transition-colors">
            Settle sprint (finalize)
          </button>
        )}
      </div>

      {/* Confirm dialogs */}
      {confirming === 'activate' && (
        <div className="bg-green-900/10 border border-green-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-green-300 text-sm font-medium">Activate "{sprint.name}"?</p>
          <p className="text-gray-400 text-xs">This will start the competition for all players. Make sure all gameweeks are published first.</p>
          <div className="flex gap-2">
            <button onClick={handleActivate} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm">Confirm — go live</button>
            <button onClick={() => setConfirming(null)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}
      {confirming === 'settle' && (
        <div className="bg-purple-900/10 border border-purple-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-purple-300 text-sm font-medium">Settle "{sprint.name}"?</p>
          <p className="text-gray-400 text-xs">This will calculate final LP totals, apply promotion/relegation rules, award badges, and mark the sprint as completed. This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleSettle} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm">Confirm — settle sprint</button>
            <button onClick={() => setConfirming(null)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/8">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-white border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Gameweeks tab */}
      {activeTab === 'gameweeks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: gameweekCount }, (_, i) => i + 1).map(week => (
              <div key={week}>
                {buildingWeek === week ? (
                  <GameweekBuilder
                    sprintId={id}
                    sprintWeek={week}
                    sprintStart={sprint.start_date}
                    sprintEnd={sprint.end_date}
                    onSaved={() => { setBuildingWeek(null); load() }}
                    onCancel={() => setBuildingWeek(null)}
                  />
                ) : (
                  <GameweekSlot
                    week={week}
                    gw={gwByWeek[week]}
                    sprint={sprint}
                    onBuild={(w) => setBuildingWeek(w)}
                    onPublish={handlePublish}
                    onRemove={handleRemove}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-300 space-y-1">
            <p className="font-medium">Admin workflow:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
              <li>Add and publish all {gameweekCount} gameweeks (15 events each)</li>
              <li>Activate the sprint to open competition for all players</li>
              <li>After all gameweeks finish and results are settled, settle the sprint to apply promotions/relegations</li>
            </ol>
          </div>
        </div>
      )}

      {/* Rankings tab */}
      {activeTab === 'rankings' && (
        <div className="bg-[#0d1117] border border-white/8 rounded-2xl overflow-hidden">
          <RankingsTab sprintId={id} />
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <SprintSettings sprint={sprint} onSaved={load} />
      )}
    </div>
  )
}

function SprintSettings({ sprint, onSaved }) {
  const [form, setForm] = useState({
    name: sprint.name,
    start_date: sprint.start_date?.slice(0, 16),
    end_date: sprint.end_date?.slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSprint(sprint.id, form)
      setMsg('Saved!')
      onSaved()
    } catch (e) {
      setMsg('Error: ' + (e.response?.data?.message || 'save failed'))
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-semibold text-sm">Sprint settings</h3>
      {msg && <p className="text-indigo-300 text-xs">{msg}</p>}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Name</label>
        <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Start</label>
          <input className={inputCls} type="datetime-local" value={form.start_date}
            onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">End</label>
          <input className={inputCls} type="datetime-local" value={form.end_date}
            onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
