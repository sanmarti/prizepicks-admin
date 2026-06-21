import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  getSprint, updateSprint, activateSprint, settleSprint,
  addSprintGameweek, removeSprintGameweek, getRankings, getAvailableFixtures,
  importFixturesByRange,
} from '../../api/sprints'
import { publishGameweek } from '../../api/gameweeks'

const STATUS_DOT = {
  draft:     'bg-gray-500',
  scheduled: 'bg-blue-400',
  live:      'bg-green-400 animate-pulse',
  completed: 'bg-purple-400',
  archived:  'bg-gray-700',
}
const STATUS_TEXT = {
  draft: 'text-gray-400', scheduled: 'text-blue-400',
  live: 'text-green-400',  completed: 'text-purple-400',
}
const GW_STATUS = {
  DRAFT:     { color: 'text-gray-400',   bg: 'bg-gray-700/50' },
  PUBLISHED: { color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  LOCKED:    { color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  FINISHED:  { color: 'text-purple-400', bg: 'bg-purple-900/30' },
}

const EVENT_TYPES = ['MATCH_RESULT', 'GOALS', 'CLEAN_SHEET', 'PLAYER_SCORE', 'BTTS', 'CORNER_OVER']
const DEFAULT_OPTIONS = {
  MATCH_RESULT: ['Home Win', 'Draw', 'Away Win'],
  GOALS:        ['Over 2.5', 'Under 2.5'],
  CLEAN_SHEET:  ['Yes', 'No'],
  PLAYER_SCORE: ['Scores', 'Does not score'],
  BTTS:         ['Yes', 'No'],
  CORNER_OVER:  ['Over 9.5', 'Under 9.5'],
}

function getWeekBounds(sprintStart, week) {
  const base = new Date(sprintStart)
  const weekStart = new Date(base.getTime() + (week - 1) * 7 * 86400000)
  const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000)
  const lockDate  = new Date(weekEnd.getTime() - 86400000)
  lockDate.setUTCHours(19, 0, 0, 0)
  return { weekStart, weekEnd, defaultLock: lockDate.toISOString().slice(0, 16) }
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateFull(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Fixture row inside the browser ────────────────────────────────────────────
function FixtureRow({ fix, selected, disabled, onToggle }) {
  return (
    <button
      onClick={() => onToggle(fix)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
        selected
          ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
          : 'bg-white/3 border border-transparent text-gray-300 hover:bg-white/6 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
      }`}
    >
      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center text-[10px] transition-colors ${
        selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/20 bg-white/5'
      }`}>
        {selected && '✓'}
      </div>

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {fix.home_logo && <img src={fix.home_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
          <span className="font-medium text-sm truncate">{fix.home_team}</span>
          <span className="text-gray-600 text-xs">vs</span>
          {fix.away_logo && <img src={fix.away_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
          <span className="font-medium text-sm truncate">{fix.away_team}</span>
        </div>
      </div>

      {/* Date/time */}
      <div className="flex-shrink-0 text-right text-xs text-gray-500">
        <p>{fmtDate(fix.date)}</p>
        <p>{fmtTime(fix.date)}</p>
      </div>
    </button>
  )
}

// ── Gameweek section (one per week) ──────────────────────────────────────────
function GameweekSection({ week, sprintId, sprintStart, existingGw, weekFixtures, loadingFixtures, onSaved, onFixturesImported }) {
  const { weekStart, weekEnd, defaultLock } = getWeekBounds(sprintStart, week)

  const initEvents = useCallback(() => {
    if (!existingGw?.events?.length) return []
    return existingGw.events.map(ev => ({
      fixture_id:   ev.fixture_id,
      fixture_name: ev.fixture_name,
      match_time:   ev.match_time,
      competition:  ev.competition,
      event_type:   ev.event_type,
      options:      (ev.options || []).map(o => ({ label: o.label, energy_cost: o.energy_cost })),
    }))
  }, [existingGw])

  const [events, setEvents]       = useState(initEvents)
  const [lockTime, setLockTime]   = useState(existingGw?.lock_time?.slice(0, 16) || defaultLock)
  const [saving, setSaving]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [err, setErr]             = useState('')
  const [msg, setMsg]             = useState('')
  const [expanded, setExpanded]   = useState(true)
  const [leagueLimit, setLeagueLimit] = useState({})  // league → show all

  const handleImport = async () => {
    setImporting(true); setImportMsg('')
    try {
      const res = await importFixturesByRange({
        date_from: weekStart.toISOString().slice(0, 10),
        date_to:   new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10),
      })
      setImportMsg(res.data.message || `Imported ${res.data.imported} fixtures`)
      onFixturesImported()
    } catch (e) {
      setImportMsg(e.response?.data?.message || 'Import failed — API may have no fixtures for this period yet')
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(''), 5000)
    }
  }

  // Re-init when existingGw changes (after save/reload)
  useEffect(() => { setEvents(initEvents()) }, [initEvents])
  useEffect(() => {
    if (existingGw?.lock_time) setLockTime(existingGw.lock_time.slice(0, 16))
  }, [existingGw])

  const isSelected = (id) => events.some(ev => ev.fixture_id === String(id))

  const toggleFixture = (fix) => {
    if (isSelected(fix.id)) {
      setEvents(prev => prev.filter(ev => ev.fixture_id !== String(fix.id)))
    } else if (events.length < 15) {
      setEvents(prev => [...prev, {
        fixture_id:   String(fix.id),
        fixture_name: `${fix.home_team} vs ${fix.away_team}`,
        match_time:   fix.date,
        competition:  fix.competition_name || '',
        event_type:   'MATCH_RESULT',
        options: [
          { label: `${fix.home_team} Win`, energy_cost: 5 },
          { label: 'Draw',                  energy_cost: 5 },
          { label: `${fix.away_team} Win`,  energy_cost: 5 },
        ],
      }])
    }
  }

  const updateEventType = (idx, type) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      const labels = DEFAULT_OPTIONS[type] || ['Option 1', 'Option 2']
      return { ...ev, event_type: type, options: labels.map(l => ({ label: l, energy_cost: 5 })) }
    }))
  }

  const updateOptionLabel = (evIdx, optIdx, label) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== evIdx) return ev
      return { ...ev, options: ev.options.map((o, j) => j === optIdx ? { ...o, label } : o) }
    }))
  }

  const removeEvent = (idx) => setEvents(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async (andPublish = false) => {
    if (andPublish && events.length !== 15) { setErr('Need exactly 15 events to publish'); return }
    if (events.length === 0) { setErr('Add at least 1 event'); return }
    setSaving(true); setErr('')
    try {
      const res = await addSprintGameweek(sprintId, { sprint_week: week, lock_time: lockTime, events })
      if (andPublish) await publishGameweek(res.data.gameweek_id)
      setMsg(andPublish ? 'Gameweek published!' : 'Draft saved!')
      setTimeout(() => setMsg(''), 3000)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Group fixtures by league
  const groupedFixtures = useMemo(() => {
    const groups = {}
    for (const f of weekFixtures) {
      const league = f.competition_name || 'Other'
      if (!groups[league]) groups[league] = []
      groups[league].push(f)
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [weekFixtures])

  // Determine week status
  const gwStatus = existingGw?.status || null
  const gwStatusInfo = gwStatus ? GW_STATUS[gwStatus] : null
  const isReadOnly = gwStatus && gwStatus !== 'DRAFT'

  const pct = (events.length / 15) * 100
  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"

  return (
    <div className="bg-[#0d1117] border border-white/8 rounded-3xl overflow-hidden">
      {/* Section header — always visible */}
      <div
        className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/2 transition-colors select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 ${
            gwStatus === 'PUBLISHED' ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300' :
            gwStatus === 'FINISHED'  ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300' :
            gwStatus === 'LOCKED'    ? 'bg-yellow-600/30 border border-yellow-500/40 text-yellow-300' :
            gwStatus === 'DRAFT'     ? 'bg-white/10 border border-white/20 text-white' :
            'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
          }`}>
            {week}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-lg font-bold">Week {week}</p>
              {gwStatusInfo && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${gwStatusInfo.bg} ${gwStatusInfo.color}`}>
                  {gwStatus}
                </span>
              )}
              {!gwStatus && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-600">EMPTY</span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-0.5">{weekLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Mini progress */}
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-bold">{events.length}/15</p>
            <p className="text-gray-600 text-xs">events</p>
          </div>
          <div className="w-24 bg-white/5 rounded-full h-1.5 hidden sm:block">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-gray-600 text-lg">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/5 px-6 py-6 space-y-6">

          {err && <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{err}</div>}
          {msg && <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-indigo-300 text-sm">{msg}</div>}

          {/* Lock time */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <label className="text-gray-500 text-xs block mb-1">Picks lock time</label>
              <input
                type="datetime-local"
                value={lockTime}
                onChange={e => setLockTime(e.target.value)}
                disabled={isReadOnly}
                className={`${inp} w-auto min-w-[220px]`}
              />
            </div>
            <div className="text-gray-600 text-xs">
              <p>After this time, no new picks can be submitted for this week.</p>
              <p className="mt-0.5">Typically set just before the first match of the week.</p>
            </div>
          </div>

          {/* Published / Locked / Finished — read-only summary */}
          {isReadOnly && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Events', existingGw.event_count + '/15'],
                ['Entries', existingGw.entry_count],
                ['Lock', new Date(existingGw.lock_time).toLocaleDateString()],
                ['Status', gwStatus],
              ].map(([label, val]) => (
                <div key={label} className="bg-white/3 border border-white/5 rounded-2xl p-3 text-center">
                  <p className="text-gray-600 text-xs">{label}</p>
                  <p className="text-white font-bold text-sm mt-1">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Fixture browser + event editor (DRAFT / empty only) */}
          {!isReadOnly && (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-500">Selected events</span>
                  <span className={`font-bold ${events.length === 15 ? 'text-green-400' : 'text-indigo-400'}`}>
                    {events.length}/15 {events.length === 15 && '✓ Ready to publish'}
                  </span>
                </div>
                <div className="bg-white/5 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${events.length === 15 ? 'bg-green-500' : 'bg-indigo-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Fixture browser */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-semibold">
                    Available fixtures
                    {loadingFixtures && <span className="text-gray-600 text-sm font-normal ml-2">loading…</span>}
                    {!loadingFixtures && weekFixtures.length > 0 && (
                      <span className="text-gray-500 text-sm font-normal ml-2">({weekFixtures.length} matches)</span>
                    )}
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={importing || loadingFixtures}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                    title="Fetch from API-Football and cache in DB (uses 1 API call)"
                  >
                    {importing
                      ? <><span className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />Importing…</>
                      : <>↓ Import from API</>
                    }
                  </button>
                </div>

                {importMsg && (
                  <p className={`text-xs mb-3 ${importMsg.includes('failed') || importMsg.includes('no fixtures') ? 'text-yellow-400' : 'text-indigo-400'}`}>
                    {importMsg}
                  </p>
                )}

                {!loadingFixtures && weekFixtures.length === 0 && (
                  <div className="bg-white/3 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                    <p className="text-gray-500 text-sm">No fixtures cached for this week</p>
                    <p className="text-gray-700 text-xs mt-2">
                      Click "Import from API" above to fetch from API-Football and cache results in the DB.
                    </p>
                    <p className="text-gray-700 text-xs mt-1">
                      Note: league schedules for {weekStart.getFullYear()}/{weekStart.getFullYear()+1} may not be published yet.
                    </p>
                  </div>
                )}

                {groupedFixtures.length > 0 && (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {groupedFixtures.map(([league, fixes]) => {
                      const limit = leagueLimit[league]
                      const visible = limit ? fixes : fixes.slice(0, 8)
                      const hasMore = fixes.length > 8 && !limit
                      return (
                        <div key={league}>
                          <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0d1117] py-1 z-10">
                            <div className="h-px flex-1 bg-white/8" />
                            <span className="text-gray-500 text-[11px] font-semibold tracking-wider uppercase flex-shrink-0">
                              {league}
                            </span>
                            <div className="h-px flex-1 bg-white/8" />
                          </div>
                          <div className="space-y-1.5">
                            {visible.map(fix => (
                              <FixtureRow
                                key={fix.id}
                                fix={fix}
                                selected={isSelected(fix.id)}
                                disabled={!isSelected(fix.id) && events.length >= 15}
                                onToggle={toggleFixture}
                              />
                            ))}
                            {hasMore && (
                              <button
                                onClick={() => setLeagueLimit(l => ({ ...l, [league]: true }))}
                                className="w-full py-2 text-gray-600 hover:text-gray-400 text-xs transition-colors"
                              >
                                + {fixes.length - 8} more matches in {league}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Selected events editor */}
              {events.length > 0 && (
                <div>
                  <p className="text-white font-semibold mb-3">Selected events ({events.length}/15)</p>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {events.map((ev, evIdx) => (
                      <div key={ev.fixture_id || evIdx}
                        className="bg-white/3 border border-white/8 rounded-2xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-white text-sm font-semibold">{ev.fixture_name}</p>
                            {ev.match_time && (
                              <p className="text-gray-600 text-xs mt-0.5">
                                {fmtDate(ev.match_time)} · {fmtTime(ev.match_time)}
                                {ev.competition && ` · ${ev.competition}`}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeEvent(evIdx)}
                            className="text-gray-600 hover:text-red-400 text-sm ml-3 flex-shrink-0 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            value={ev.event_type}
                            onChange={e => updateEventType(evIdx, e.target.value)}
                            className="bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-indigo-500"
                          >
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <div className="flex gap-2 flex-wrap">
                            {ev.options.map((opt, optIdx) => (
                              <input
                                key={optIdx}
                                value={opt.label}
                                onChange={e => updateOptionLabel(evIdx, optIdx, e.target.value)}
                                className="bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-gray-200 text-xs w-32 focus:outline-none focus:border-indigo-500"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || events.length === 0}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving…' : `Save Draft (${events.length} events)`}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || events.length !== 15}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
                    events.length === 15
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {saving ? 'Publishing…' : `Publish ${events.length}/15`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
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

  if (loading) return <div className="text-center text-gray-500 py-12">Loading rankings…</div>
  if (!rows.length) return <div className="text-center text-gray-500 py-12">No participants yet</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-white/8">
            {['#','Player','Division','LP','Correct','Perfect','GWs','Outcome'].map(h => (
              <th key={h} className={`py-3 px-3 ${h === '#' ? 'text-left' : h === 'LP' || h === 'Correct' || h === 'Perfect' || h === 'GWs' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.user_id} className="border-b border-white/5 hover:bg-white/2">
              <td className="py-2.5 px-3 text-gray-500 text-xs">{r.rank}</td>
              <td className="py-2.5 px-3 text-white">{r.display_name || r.email?.split('@')[0]}</td>
              <td className="py-2.5 px-3 text-xs">{r.division_icon} {r.division_name}</td>
              <td className="py-2.5 px-3 text-right font-black text-indigo-400">{r.total_league_points}</td>
              <td className="py-2.5 px-3 text-right text-gray-300">{r.total_correct_picks}</td>
              <td className="py-2.5 px-3 text-right text-yellow-400">{r.perfect_weeks}⭐</td>
              <td className="py-2.5 px-3 text-right text-gray-500">{r.gameweeks_participated}</td>
              <td className="py-2.5 px-3">
                {r.is_rookie ? (
                  <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Rookie</span>
                ) : r.sprint_outcome === 'promoted' ? (
                  <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">⬆ Up</span>
                ) : r.sprint_outcome === 'relegated' ? (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">⬇ Down</span>
                ) : <span className="text-xs text-gray-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Sprint settings ───────────────────────────────────────────────────────────
function SprintSettings({ sprint, onSaved }) {
  const [form, setForm] = useState({
    name:       sprint.name,
    start_date: sprint.start_date?.slice(0, 16),
    end_date:   sprint.end_date?.slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await updateSprint(sprint.id, form)
      setMsg('Saved!'); onSaved()
    } catch (e) {
      setMsg('Error: ' + (e.response?.data?.message || 'save failed'))
    } finally {
      setSaving(false); setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-semibold">Sprint settings</h3>
      {msg && <p className="text-indigo-300 text-xs">{msg}</p>}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Name</label>
        <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Start</label>
          <input className={inp} type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">End</label>
          <input className={inp} type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SprintDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [sprint, setSprint]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [allFixtures, setAllFixtures] = useState([])
  const [loadingFix, setLoadingFix]   = useState(false)
  const [activeTab, setActiveTab]   = useState('gameweeks')
  const [actionMsg, setActionMsg]   = useState('')
  const [confirming, setConfirming] = useState(null)

  const load = useCallback(() => {
    getSprint(id)
      .then(r => setSprint(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const loadFixtures = useCallback(() => {
    if (!sprint?.start_date || !sprint?.end_date) return
    setLoadingFix(true)
    getAvailableFixtures({
      date_from: sprint.start_date.slice(0, 10) + 'T00:00:00',
      date_to:   sprint.end_date.slice(0, 10)   + 'T23:59:59',
    })
      .then(r => setAllFixtures(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingFix(false))
  }, [sprint?.id, sprint?.start_date, sprint?.end_date])

  // Load fixtures for the full sprint period when sprint data arrives
  useEffect(() => { loadFixtures() }, [loadFixtures])

  // Build a map of week → gameweek record
  const gwByWeek = useMemo(() => {
    const map = {}
    if (sprint?.gameweeks) {
      for (const gw of sprint.gameweeks) map[gw.sprint_week] = gw
    }
    return map
  }, [sprint?.gameweeks])

  // Split all fixtures into per-week buckets
  const fixturesByWeek = useMemo(() => {
    if (!sprint?.start_date) return {}
    const result = {}
    for (let w = 1; w <= (sprint.gameweek_count || 4); w++) {
      const { weekStart, weekEnd } = getWeekBounds(sprint.start_date, w)
      result[w] = allFixtures.filter(f => {
        const d = new Date(f.date)
        return d >= weekStart && d < weekEnd
      })
    }
    return result
  }, [allFixtures, sprint?.start_date, sprint?.gameweek_count])

  const flash = (msg, ms = 4000) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), ms)
  }

  const handleActivate = async () => {
    try {
      await activateSprint(id)
      flash('Sprint activated! Competition is now live.')
      setConfirming(null); load()
    } catch (e) {
      flash('Error: ' + (e.response?.data?.message || 'activate failed'))
      setConfirming(null)
    }
  }

  const handleSettle = async () => {
    try {
      const res = await settleSprint(id)
      flash(`Settled! ${res.data.promotions}↑ promoted, ${res.data.relegations}↓ relegated.`, 6000)
      setConfirming(null); load()
    } catch (e) {
      flash('Error: ' + (e.response?.data?.message || 'settlement failed'))
      setConfirming(null)
    }
  }

  if (loading) return <div className="text-center text-gray-500 py-20">Loading sprint…</div>
  if (!sprint) return <div className="text-center text-gray-400 py-20">Sprint not found</div>

  const gwCount = sprint.gameweek_count || 4

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <button onClick={() => navigate('/admin/sprints')}
          className="text-gray-500 hover:text-white text-sm mb-3 flex items-center gap-1 transition-colors">
          ← Sprints
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-2xl font-black">{sprint.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {fmtDateFull(sprint.start_date)} → {fmtDateFull(sprint.end_date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[sprint.status] || 'bg-gray-600'}`}/>
            <span className={`text-sm font-semibold ${STATUS_TEXT[sprint.status] || 'text-gray-400'}`}>
              {sprint.status?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {sprint.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Players',    sprint.stats.participants, '#6366f1'],
            ['Total LP',   sprint.stats.total_league_points, '#f59e0b'],
            ['Perfect Weeks', sprint.stats.total_perfect_weeks, '#f59e0b'],
            ['⬆ / ⬇',    `${sprint.stats.promotions ?? 0} / ${sprint.stats.relegations ?? 0}`, '#10b981'],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-[#0d1117] border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-gray-600 text-xs">{label}</p>
              <p className="font-black text-xl mt-1" style={{ color }}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action message */}
      {actionMsg && (
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl px-5 py-3 text-indigo-300 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {sprint.status === 'draft' && (
          <button onClick={async () => { await updateSprint(id, { status: 'scheduled' }); load() }}
            className="px-4 py-2 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded-xl text-sm transition-colors">
            Mark scheduled
          </button>
        )}
        {['draft','scheduled'].includes(sprint.status) && (
          <button onClick={() => setConfirming('activate')}
            className="px-4 py-2 bg-green-600/15 hover:bg-green-600/30 text-green-400 border border-green-500/20 rounded-xl text-sm transition-colors">
            Activate (go live)
          </button>
        )}
        {sprint.status === 'live' && (
          <button onClick={() => setConfirming('settle')}
            className="px-4 py-2 bg-purple-600/15 hover:bg-purple-600/30 text-purple-400 border border-purple-500/20 rounded-xl text-sm transition-colors">
            Settle sprint
          </button>
        )}
      </div>

      {/* Confirm dialogs */}
      {confirming === 'activate' && (
        <div className="bg-green-900/10 border border-green-500/30 rounded-2xl p-5 space-y-3">
          <p className="text-green-300 font-semibold">Activate "{sprint.name}"?</p>
          <p className="text-gray-400 text-sm">This starts the competition for all players. Make sure all gameweeks are published first.</p>
          <div className="flex gap-2">
            <button onClick={handleActivate} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm">Confirm — go live</button>
            <button onClick={() => setConfirming(null)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}
      {confirming === 'settle' && (
        <div className="bg-purple-900/10 border border-purple-500/30 rounded-2xl p-5 space-y-3">
          <p className="text-purple-300 font-semibold">Settle "{sprint.name}"?</p>
          <p className="text-gray-400 text-sm">Calculates final LP, applies promotion/relegation, awards badges. Cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleSettle} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm">Confirm — settle</button>
            <button onClick={() => setConfirming(null)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/8">
        <div className="flex gap-0">
          {['gameweeks','rankings','settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-white border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}>
              {tab === 'gameweeks'
                ? `Gameweeks (${sprint.gameweeks?.length || 0}/${gwCount})`
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Gameweeks tab — 4 large sections */}
      {activeTab === 'gameweeks' && (
        <div className="space-y-4">
          {loadingFix && (
            <div className="flex items-center gap-2 text-gray-600 text-xs">
              <div className="w-3 h-3 border border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
              Fetching available fixtures for this sprint period…
            </div>
          )}
          {Array.from({ length: gwCount }, (_, i) => i + 1).map(week => (
            <GameweekSection
              key={week}
              week={week}
              sprintId={id}
              sprintStart={sprint.start_date}
              sprintEnd={sprint.end_date}
              existingGw={gwByWeek[week] || null}
              weekFixtures={fixturesByWeek[week] || []}
              loadingFixtures={loadingFix}
              onSaved={load}
              onFixturesImported={loadFixtures}
            />
          ))}

          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 text-xs text-gray-600 space-y-1">
            <p className="text-gray-400 font-medium">Workflow</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Select 15 fixtures per week and publish each gameweek</li>
              <li>Activate the sprint to open competition for all players</li>
              <li>After all matches finish and scores are settled → Settle sprint to apply promotions/relegations</li>
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
