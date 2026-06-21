import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  getSprint, updateSprint, activateSprint, settleSprint,
  addSprintGameweek, removeSprintGameweek, getRankings, getAvailableFixtures,
  importFixturesByRange,
} from '../../api/sprints'
import { publishGameweek } from '../../api/gameweeks'
import { refreshFixtureResults } from '../../api/competitions'

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

const EVENT_TYPES = ['MATCH_RESULT', 'GOALS', 'BTTS', 'CLEAN_SHEET', 'CORNER_OVER', 'PLAYER_SCORE']
const EVENT_TYPE_LABELS = {
  MATCH_RESULT: 'Match Result', GOALS: 'Goals O/U', BTTS: 'Both Teams Score',
  CLEAN_SHEET: 'Clean Sheet', CORNER_OVER: 'Corners O/U', PLAYER_SCORE: 'Player Scores',
}
const GOALS_THRESHOLDS    = ['0.5', '1.5', '2.5', '3.5', '4.5']
const CORNER_THRESHOLDS   = ['7.5', '8.5', '9.5', '10.5', '11.5']

function buildOptions(type, homeTeam, awayTeam, threshold) {
  switch (type) {
    case 'MATCH_RESULT': return [
      { label: `${homeTeam} Win`, result_key: 'HOME_WIN',  energy_cost: 4 },
      { label: 'Draw',            result_key: 'DRAW',       energy_cost: 2 },
      { label: `${awayTeam} Win`, result_key: 'AWAY_WIN',  energy_cost: 4 },
    ]
    case 'GOALS': { const t = threshold || '2.5'; return [
      { label: `Over ${t} Goals`,  result_key: `OVER_${t}`,  energy_cost: ec },
      { label: `Under ${t} Goals`, result_key: `UNDER_${t}`, energy_cost: ec },
    ]}
    case 'BTTS': return [
      { label: 'Both Teams Score',     result_key: 'BTTS_YES', energy_cost: ec },
      { label: 'Not Both Teams Score', result_key: 'BTTS_NO',  energy_cost: ec },
    ]
    case 'CLEAN_SHEET': return [
      { label: `${homeTeam} Clean Sheet`, result_key: 'HOME_CLEAN_SHEET', energy_cost: ec },
      { label: `${awayTeam} Clean Sheet`, result_key: 'AWAY_CLEAN_SHEET', energy_cost: ec },
    ]
    case 'CORNER_OVER': { const t = threshold || '9.5'; return [
      { label: `Over ${t} Corners`,  result_key: `CORNER_OVER_${t}`,   energy_cost: ec },
      { label: `Under ${t} Corners`, result_key: `CORNER_UNDER_${t}`,  energy_cost: ec },
    ]}
    case 'PLAYER_SCORE': return [
      { label: 'Scores',         result_key: 'PLAYER_SCORES',   energy_cost: ec },
      { label: 'Does not score', result_key: 'PLAYER_NO_SCORE', energy_cost: ec },
    ]
    default: return []
  }
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
    return existingGw.events.map(ev => {
      // Derive home/away team from fixture_name "X vs Y" for re-editing
      const [homeTeam = '', awayTeam = ''] = (ev.fixture_name || '').split(' vs ')
      // Derive threshold from first option's result_key (e.g. OVER_2.5 → 2.5)
      const firstKey = ev.options?.[0]?.result_key || ''
      const thresholdMatch = firstKey.match(/_([\d.]+)$/)
      const threshold = thresholdMatch ? thresholdMatch[1] : '2.5'
      return {
        fixture_id:   ev.fixture_id,
        fixture_name: ev.fixture_name,
        home_team:    homeTeam.trim(),
        away_team:    awayTeam.trim(),
        match_time:   ev.match_time,
        competition:  ev.competition,
        event_type:   ev.event_type,
        player_name:  ev.player_name || '',
        threshold,
        options:      (ev.options || []).map(o => ({
          label:       o.label,
          result_key:  o.result_key,
          energy_cost: o.energy_cost,
        })),
      }
    })
  }, [existingGw])

  const [events, setEvents]       = useState(initEvents)
  const [lockTime, setLockTime]   = useState(existingGw?.lock_time?.slice(0, 16) || defaultLock)
  const [saving, setSaving]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [err, setErr]             = useState('')
  const [msg, setMsg]             = useState('')
  const [expanded, setExpanded]   = useState(true)

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

  // Auto-update lock time to 5 min before earliest fixture whenever events change
  useEffect(() => {
    if (existingGw?.lock_time) return  // don't override an already-saved lock
    if (events.length === 0) { setLockTime(defaultLock); return }
    const earliest = events.reduce((min, ev) =>
      ev.match_time && new Date(ev.match_time) < new Date(min) ? ev.match_time : min,
      events[0].match_time || defaultLock
    )
    const autoLock = new Date(new Date(earliest).getTime() - 5 * 60 * 1000)
    setLockTime(autoLock.toISOString().slice(0, 16))
  }, [events, existingGw?.lock_time, defaultLock])

  const isSelected = (id) => events.some(ev => ev.fixture_id === String(id))

  const toggleFixture = (fix) => {
    if (isSelected(fix.id)) {
      setEvents(prev => prev.filter(ev => ev.fixture_id !== String(fix.id)))
    } else if (events.length < 15) {
      setEvents(prev => [...prev, {
        fixture_id:   String(fix.id),
        fixture_name: `${fix.home_team} vs ${fix.away_team}`,
        home_team:    fix.home_team,
        away_team:    fix.away_team,
        match_time:   fix.date,
        competition:  fix.competition_name || '',
        event_type:   'MATCH_RESULT',
        threshold:    '2.5',
        options:      buildOptions('MATCH_RESULT', fix.home_team, fix.away_team),
      }])
    }
  }

  const updateEventType = (idx, type) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      return { ...ev, event_type: type, options: buildOptions(type, ev.home_team, ev.away_team, ev.threshold) }
    }))
  }

  const updateThreshold = (idx, threshold) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      return { ...ev, threshold, options: buildOptions(ev.event_type, ev.home_team, ev.away_team, threshold) }
    }))
  }

  const updatePlayerName = (idx, player_name) => {
    setEvents(prev => prev.map((ev, i) => i !== idx ? ev : { ...ev, player_name }))
  }

  const updateEnergyCost = (evIdx, optIdx, energy_cost) => {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== evIdx) return ev
      return { ...ev, options: ev.options.map((o, j) => j === optIdx ? { ...o, energy_cost: Number(energy_cost) } : o) }
    }))
  }

  const removeEvent = (idx) => setEvents(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async (andPublish = false) => {
    if (andPublish && events.length !== 15) { setErr('Need exactly 15 events to publish'); return }
    if (events.length === 0) { setErr('Add at least 1 event'); return }
    const badEvent = events.find(ev => ev.options.reduce((s, o) => s + Number(o.energy_cost || 0), 0) !== 10)
    if (badEvent) { setErr(`Energy costs for "${badEvent.fixture_name}" must sum to 10`); return }
    setSaving(true); setErr('')
    try {
      // If editing an already-published gameweek, always re-publish after saving
      const wasPublished = gwStatus === 'PUBLISHED'
      const shouldPublish = andPublish || wasPublished
      const res = await addSprintGameweek(sprintId, { sprint_week: week, lock_time: lockTime, events })
      if (shouldPublish) await publishGameweek(res.data.gameweek_id)
      setMsg(shouldPublish ? 'Gameweek published!' : 'Draft saved!')
      setEditing(false)
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
  const [editing, setEditing] = useState(false)
  const isEditing = !gwStatus || gwStatus === 'DRAFT' || (gwStatus === 'PUBLISHED' && editing)
  const canEdit   = !gwStatus || gwStatus === 'DRAFT' || gwStatus === 'PUBLISHED'

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
                disabled={!isEditing}
                className={`${inp} w-auto min-w-[220px]`}
              />
            </div>
            <div className="text-gray-600 text-xs">
              <p>After this time, no new picks can be submitted for this week.</p>
              <p className="mt-0.5">Typically set just before the first match of the week.</p>
            </div>
          </div>

          {/* Stats row + edit button for non-empty gameweeks */}
          {gwStatus && (
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-4 gap-2 flex-1">
                {[
                  ['Events', (existingGw.event_count ?? events.length) + '/15'],
                  ['Entries', existingGw.entry_count ?? 0],
                  ['Lock', new Date(existingGw.lock_time).toLocaleDateString()],
                  ['Status', gwStatus],
                ].map(([label, val]) => (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-gray-600 text-[10px]">{label}</p>
                    <p className="text-white font-bold text-xs mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
              {gwStatus === 'PUBLISHED' && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                >
                  Edit events
                </button>
              )}
              {gwStatus === 'PUBLISHED' && editing && (
                <button
                  onClick={() => { setEditing(false); setEvents(initEvents()) }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-xl text-xs transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Events list — always visible for non-empty gameweeks */}
          {!isEditing && events.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-semibold tracking-wider uppercase mb-3">
                Events ({events.length}/15)
              </p>
              <div className="space-y-2">
                {events.map((ev, i) => {
                  const hasResult = ev.options.some(o => o.result && o.result !== 'PENDING')
                  return (
                    <div key={i} className="bg-white/3 border border-white/8 rounded-2xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-white text-sm font-semibold">{ev.fixture_name}</p>
                          <p className="text-gray-600 text-[10px] mt-0.5">
                            {ev.event_type} · {ev.match_time ? fmtDate(ev.match_time) + ' ' + fmtTime(ev.match_time) : ''}
                          </p>
                        </div>
                        {hasResult && <span className="text-[10px] text-purple-400 bg-purple-900/20 border border-purple-500/20 rounded-full px-2 py-0.5 flex-shrink-0">Settled</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {ev.options.map((opt, j) => (
                          <div key={j} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                            opt.result === 'WON'  ? 'bg-green-900/25 border-green-500/30 text-green-300' :
                            opt.result === 'LOST' ? 'bg-white/3 border-white/8 text-gray-600 line-through' :
                            'bg-white/5 border-white/10 text-gray-300'
                          }`}>
                            {opt.result === 'WON' && <span className="text-green-400">✓</span>}
                            {opt.result === 'LOST' && <span className="text-red-500">✗</span>}
                            <span>{opt.label}</span>
                            <span className="text-gray-600 text-[10px]">⚡{opt.energy_cost}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fixture browser + event editor (DRAFT / editing PUBLISHED) */}
          {isEditing && (
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
                    title="Re-syncs fixtures from all imported competitions for this date range"
                  >
                    {importing
                      ? <><span className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />Syncing…</>
                      : <>↻ Sync fixtures</>
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
                      Go to <strong className="text-gray-500">Competitions</strong> to import competitions first, then click "Sync fixtures" above.
                    </p>
                  </div>
                )}

                {groupedFixtures.length > 0 && (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {groupedFixtures.map(([league, fixes]) => (
                      <div key={league}>
                        <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0d1117] py-1 z-10">
                          <div className="h-px flex-1 bg-white/8" />
                          <span className="text-gray-500 text-[11px] font-semibold tracking-wider uppercase flex-shrink-0">
                            {league} ({fixes.length})
                          </span>
                          <div className="h-px flex-1 bg-white/8" />
                        </div>
                        <div className="space-y-1.5">
                          {fixes.map(fix => (
                            <FixtureRow
                              key={fix.id}
                              fix={fix}
                              selected={isSelected(fix.id)}
                              disabled={!isSelected(fix.id) && events.length >= 15}
                              onToggle={toggleFixture}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected events editor */}
              {events.length > 0 && (
                <div>
                  <p className="text-white font-semibold mb-3">Selected events ({events.length}/15)</p>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {events.map((ev, evIdx) => (
                      <div key={ev.fixture_id || evIdx}
                        className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3">

                        {/* Header */}
                        <div className="flex items-start justify-between">
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
                          >✕</button>
                        </div>

                        {/* Event type selector */}
                        <div className="flex gap-1.5 flex-wrap">
                          {EVENT_TYPES.map(t => (
                            <button
                              key={t}
                              onClick={() => updateEventType(evIdx, t)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                ev.event_type === t
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white/6 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {EVENT_TYPE_LABELS[t]}
                            </button>
                          ))}
                        </div>

                        {/* Threshold selector for GOALS / CORNER_OVER */}
                        {(ev.event_type === 'GOALS' || ev.event_type === 'CORNER_OVER') && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-xs">Threshold:</span>
                            <div className="flex gap-1">
                              {(ev.event_type === 'GOALS' ? GOALS_THRESHOLDS : CORNER_THRESHOLDS).map(t => (
                                <button
                                  key={t}
                                  onClick={() => updateThreshold(evIdx, t)}
                                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                                    ev.threshold === t
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white/6 text-gray-500 hover:text-gray-300'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Player name for PLAYER_SCORE */}
                        {ev.event_type === 'PLAYER_SCORE' && (
                          <input
                            placeholder="Player name (e.g. Mbappé)"
                            value={ev.player_name || ''}
                            onChange={e => updatePlayerName(evIdx, e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-gray-700"
                          />
                        )}

                        {/* Options — labels auto-generated, only energy cost editable */}
                        {(() => {
                          const optSum = ev.options.reduce((s, o) => s + Number(o.energy_cost || 0), 0)
                          return (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {ev.options.map((opt, optIdx) => (
                                  <div key={optIdx}
                                    className="flex items-center justify-between bg-white/4 border border-white/8 rounded-xl px-3 py-2 gap-2">
                                    <div className="min-w-0">
                                      <p className="text-gray-200 text-xs font-medium truncate">{opt.label}</p>
                                      <p className="text-gray-700 text-[10px] font-mono">{opt.result_key}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-gray-600 text-[10px]">⚡</span>
                                      <input
                                        type="number"
                                        min="1" max="9"
                                        value={opt.energy_cost}
                                        onChange={e => updateEnergyCost(evIdx, optIdx, e.target.value)}
                                        className="w-8 bg-white/8 border border-white/10 rounded text-center text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className={`text-right text-[11px] font-mono font-semibold mt-1 ${
                                optSum === 10 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                ⚡ Sum: {optSum}/10 {optSum === 10 ? '✓' : '— must equal 10'}
                              </div>
                            </>
                          )
                        })()}
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
function RankingsTab({ sprintId, gwCount }) {
  const [activeWeek, setActiveWeek] = useState('overall')
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = { sprint_id: sprintId }
    if (activeWeek !== 'overall') params.week = activeWeek
    getRankings(params)
      .then(r => setRows(r.data.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [sprintId, activeWeek])

  const weeks = Array.from({ length: gwCount }, (_, i) => i + 1)
  const tabs  = ['overall', ...weeks]

  const isWeek = activeWeek !== 'overall'

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 p-4 border-b border-white/8 overflow-x-auto">
        {tabs.map(t => (
          <button key={t}
            onClick={() => setActiveWeek(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeWeek === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
            }`}
          >
            {t === 'overall' ? 'Overall' : `Week ${t}`}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-gray-500 py-12">Loading rankings…</div>}
      {!loading && !rows.length && <div className="text-center text-gray-500 py-12">No data yet for this {isWeek ? 'week' : 'sprint'}</div>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-white/8">
                {isWeek
                  ? ['#', 'Player', 'LP', 'Correct/6', 'Perfect'].map(h => (
                    <th key={h} className={`py-3 px-3 ${h === '#' || h === 'Player' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))
                  : ['#', 'Player', 'Division', 'LP', 'Correct', 'Perfect', 'GWs', 'Outcome'].map(h => (
                    <th key={h} className={`py-3 px-3 ${h === '#' || h === 'Player' || h === 'Division' || h === 'Outcome' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="py-2.5 px-3 text-gray-500 text-xs">{r.rank}</td>
                  <td className="py-2.5 px-3 text-white">{r.display_name || r.email?.split('@')[0]}</td>
                  {!isWeek && <td className="py-2.5 px-3 text-xs">{r.division_icon} {r.division_name}</td>}
                  <td className="py-2.5 px-3 text-right font-black text-indigo-400">{r.total_league_points}</td>
                  <td className="py-2.5 px-3 text-right text-gray-300">{r.total_correct_picks}{isWeek ? '/6' : ''}</td>
                  {isWeek
                    ? <td className="py-2.5 px-3 text-right">{r.is_perfect_week ? <span className="text-yellow-400">⭐</span> : <span className="text-gray-700">—</span>}</td>
                    : <>
                        <td className="py-2.5 px-3 text-right text-yellow-400">{r.perfect_weeks}⭐</td>
                        <td className="py-2.5 px-3 text-right text-gray-500">{r.gameweeks_participated}</td>
                        <td className="py-2.5 px-3">
                          {r.is_rookie
                            ? <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Rookie</span>
                            : r.sprint_outcome === 'promoted'
                              ? <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">⬆ Up</span>
                              : r.sprint_outcome === 'relegated'
                                ? <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">⬇ Down</span>
                                : <span className="text-xs text-gray-600">—</span>
                          }
                        </td>
                      </>
                  }
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  const gwCount = sprint.gameweek_count || 4
  const gwByWeek = {}
  for (const gw of (sprint.gameweeks || [])) gwByWeek[gw.sprint_week] = gw

  return (
    <div className="space-y-4">
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

      {/* Per-gameweek settings overview */}
      <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">Gameweek settings</h3>
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: gwCount }, (_, i) => i + 1).map(week => {
            const gw = gwByWeek[week]
            const statusInfo = gw ? GW_STATUS[gw.status] : null
            return (
              <div key={week} className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-2xl px-4 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 ${
                  !gw ? 'bg-white/5 border border-white/10 text-gray-600' :
                  gw.status === 'PUBLISHED' ? 'bg-blue-600/25 border border-blue-500/30 text-blue-300' :
                  gw.status === 'FINISHED'  ? 'bg-purple-600/25 border border-purple-500/30 text-purple-300' :
                  gw.status === 'LOCKED'    ? 'bg-yellow-600/25 border border-yellow-500/30 text-yellow-300' :
                  'bg-white/10 border border-white/15 text-white'
                }`}>
                  {week}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-semibold">Week {week}</span>
                    {statusInfo
                      ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusInfo.bg} ${statusInfo.color}`}>{gw.status}</span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-600">EMPTY</span>
                    }
                  </div>
                  {gw
                    ? <p className="text-gray-500 text-xs mt-0.5">
                        Lock: {new Date(gw.lock_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {gw.entry_count != null ? ` · ${gw.entry_count} entries` : ''}
                        {gw.event_count != null ? ` · ${gw.event_count}/15 events` : ''}
                      </p>
                    : <p className="text-gray-700 text-xs mt-0.5">No gameweek configured yet</p>
                  }
                </div>
                <div className="text-right flex-shrink-0">
                  {gw && (
                    <p className={`text-xs font-bold ${gw.event_count >= 15 ? 'text-green-400' : 'text-gray-600'}`}>
                      {gw.event_count ?? 0}/15
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-gray-600 text-xs">Lock times and events are managed from the Gameweeks tab.</p>
      </div>
    </div>
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

  const [fixtureErr, setFixtureErr]     = useState('')
  const [refreshing, setRefreshing]     = useState(false)

  const handleRefreshResults = async () => {
    if (!sprint?.start_date || !sprint?.end_date) return
    setRefreshing(true)
    try {
      const res = await refreshFixtureResults({
        date_from: sprint.start_date.slice(0, 10),
        date_to:   sprint.end_date.slice(0, 10),
      })
      flash(res.data.message || `Refreshed ${res.data.updated} fixture results`)
      loadFixtures()
    } catch (e) {
      flash('Refresh failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setRefreshing(false)
    }
  }

  const loadFixtures = useCallback(() => {
    if (!sprint?.start_date || !sprint?.end_date) return
    setLoadingFix(true)
    setFixtureErr('')
    getAvailableFixtures({
      date_from: sprint.start_date.slice(0, 10),
      date_to:   sprint.end_date.slice(0, 10),
    })
      .then(r => setAllFixtures(Array.isArray(r.data) ? r.data : []))
      .catch(e => setFixtureErr(e.response?.data?.error || e.message || 'Failed to load fixtures'))
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
        {['live', 'scheduled'].includes(sprint.status) && (
          <button
            onClick={handleRefreshResults}
            disabled={refreshing}
            className="px-4 py-2 bg-yellow-600/15 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/20 rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center gap-2"
            title="Re-fetches latest scores for all non-finished fixtures in this sprint"
          >
            {refreshing
              ? <><span className="w-3 h-3 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />Refreshing…</>
              : '↻ Refresh results'
            }
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
              Loading fixtures for this sprint period…
            </div>
          )}
          {fixtureErr && (
            <div className="bg-red-900/15 border border-red-500/20 rounded-xl px-4 py-2 text-red-400 text-xs">
              Fixture load error: {fixtureErr}
            </div>
          )}
          {!loadingFix && !fixtureErr && allFixtures.length === 0 && (
            <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl px-4 py-2 text-yellow-600 text-xs">
              No fixtures cached for this sprint period ({sprint.start_date?.slice(0,10)} → {sprint.end_date?.slice(0,10)}). Go to Competitions → Import a competition, then click "Sync fixtures" inside any week below.
            </div>
          )}
          {!loadingFix && allFixtures.length > 0 && (
            <div className="text-xs text-gray-600 px-1">
              {allFixtures.length} fixtures available across {sprint.gameweek_count || 4} weeks
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
          <RankingsTab sprintId={id} gwCount={gwCount} />
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <SprintSettings sprint={sprint} onSaved={load} />
      )}
    </div>
  )
}
