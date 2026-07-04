import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  getSprint, updateSprint, activateSprint,
  addSprintGameweek, removeSprintGameweek, updateGameweekDates, getRankings, getAvailableFixtures,
  importFixturesByRange,
} from '../../api/sprints'
import { publishGameweek, unlockGameweek } from '../../api/gameweeks'
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

const EVENT_TYPES = ['MATCH_RESULT', 'WHO_QUALIFIES', 'GOALS', 'BTTS', 'CLEAN_SHEET', 'CORNER_OVER', 'PLAYER_SCORE']
const EVENT_TYPE_LABELS = {
  MATCH_RESULT: 'Match Result', WHO_QUALIFIES: 'Who Qualifies?', GOALS: 'Goals O/U', BTTS: 'Both Teams Score',
  CLEAN_SHEET: 'Clean Sheet', CORNER_OVER: 'Corners O/U', PLAYER_SCORE: 'Player Scores',
}
const KNOCKOUT_ROUND_RE = /final|quarter|semi|round of|knockout|playoff|cup round|eliminat/i
const GOALS_THRESHOLDS    = ['0.5', '1.5', '2.5', '3.5', '4.5']
const CORNER_THRESHOLDS   = ['7.5', '8.5', '9.5', '10.5', '11.5']

function buildOptions(type, homeTeam, awayTeam, threshold, noDraw = false) {
  switch (type) {
    case 'MATCH_RESULT': return noDraw
      ? [
          { label: `${homeTeam} Win`, result_key: 'HOME_WIN',  energy_cost: 5 },
          { label: `${awayTeam} Win`, result_key: 'AWAY_WIN',  energy_cost: 5 },
        ]
      : [
          { label: `${homeTeam} Win`, result_key: 'HOME_WIN',  energy_cost: 4 },
          { label: 'Draw',            result_key: 'DRAW',       energy_cost: 2 },
          { label: `${awayTeam} Win`, result_key: 'AWAY_WIN',  energy_cost: 4 },
        ]
    case 'GOALS': { const t = threshold || '2.5'; return [
      { label: `Over ${t} Goals`,  result_key: `OVER_${t}`,  energy_cost: 5 },
      { label: `Under ${t} Goals`, result_key: `UNDER_${t}`, energy_cost: 5 },
    ]}
    case 'BTTS': return [
      { label: 'Both Teams Score',     result_key: 'BTTS_YES', energy_cost: 5 },
      { label: 'Not Both Teams Score', result_key: 'BTTS_NO',  energy_cost: 5 },
    ]
    case 'CLEAN_SHEET': return [
      { label: `${homeTeam} Clean Sheet`, result_key: 'HOME_CLEAN_SHEET', energy_cost: 5 },
      { label: `${awayTeam} Clean Sheet`, result_key: 'AWAY_CLEAN_SHEET', energy_cost: 5 },
    ]
    case 'CORNER_OVER': { const t = threshold || '9.5'; return [
      { label: `Over ${t} Corners`,  result_key: `CORNER_OVER_${t}`,  energy_cost: 5 },
      { label: `Under ${t} Corners`, result_key: `CORNER_UNDER_${t}`, energy_cost: 5 },
    ]}
    case 'WHO_QUALIFIES': return [
      { label: homeTeam, result_key: 'HOME_QUALIFIES', energy_cost: 5 },
      { label: awayTeam, result_key: 'AWAY_QUALIFIES', energy_cost: 5 },
    ]
    case 'PLAYER_SCORE': return [
      { label: 'Scores',         result_key: 'PLAYER_SCORES',   energy_cost: 5 },
      { label: 'Does not score', result_key: 'PLAYER_NO_SCORE', energy_cost: 5 },
    ]
    default: return []
  }
}

function knockoutFixtureName(home, away) {
  return `Who qualifies? ${home} vs ${away}`
}

function getWeekBounds(sprintStart, week, existingGw) {
  // Use stored start_date if available (respects custom window), but always span a full 7 days.
  // end_date is a settlement deadline, not a fixture-browser upper bound.
  const base = new Date(sprintStart)
  const computedStart = new Date(base.getTime() + (week - 1) * 7 * 86400000)
  computedStart.setUTCHours(0, 0, 0, 0)
  const weekStart = existingGw?.start_date ? new Date(existingGw.start_date) : computedStart
  const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000 - 1000)
  return { weekStart, weekEnd }
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
function FixtureRow({ fix, pickCount, disabled, onToggle }) {
  const selected = pickCount > 0
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
      {/* Pick count badge */}
      <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors ${
        selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/20 bg-white/5'
      }`}>
        {selected ? pickCount : '+'}
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

// ── Gameweek section (one per week, always expanded) ─────────────────────────
function GameweekSection({ week, sprintId, sprintStart, existingGw, weekFixtures, loadingFixtures, onSaved, onFixturesImported, onFlash }) {
  const { weekStart, weekEnd } = getWeekBounds(sprintStart, week, existingGw)

  const initEvents = useCallback(() => {
    if (!existingGw?.events?.length) return []
    return existingGw.events.map(ev => {
      // Derive home/away team from options for WHO_QUALIFIES, otherwise from fixture_name
      let homeTeam = '', awayTeam = ''
      if (ev.event_type === 'WHO_QUALIFIES') {
        homeTeam = (ev.options || []).find(o => o.result_key === 'HOME_QUALIFIES')?.label || ''
        awayTeam = (ev.options || []).find(o => o.result_key === 'AWAY_QUALIFIES')?.label || ''
      } else {
        ;[homeTeam = '', awayTeam = ''] = (ev.fixture_name || '').split(' vs ')
      }
      // Derive threshold from first option's result_key (e.g. OVER_2.5 → 2.5)
      const firstKey = ev.options?.[0]?.result_key || ''
      const thresholdMatch = firstKey.match(/_([\d.]+)$/)
      const threshold = thresholdMatch ? thresholdMatch[1] : '2.5'
      const no_draw = ev.event_type === 'MATCH_RESULT' && !(ev.options || []).some(o => o.result_key === 'DRAW')
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
        no_draw,
        options:      (ev.options || []).map(o => ({
          label:       o.label,
          result_key:  o.result_key,
          energy_cost: o.energy_cost,
        })),
      }
    })
  }, [existingGw])

  const [events, setEvents]       = useState(initEvents)
  const [baseEnergy, setBaseEnergy] = useState(existingGw?.base_energy ?? 30)
  const [saving, setSaving]       = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [err, setErr]             = useState('')
  const [msg, setMsg]             = useState('')
  const isDirty = useRef(false)

  // Sync baseEnergy when existingGw loads/changes (don't override user edits)
  useEffect(() => {
    if (!isDirty.current && existingGw?.base_energy != null) {
      setBaseEnergy(existingGw.base_energy)
    }
  }, [existingGw])

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

  // Re-init when existingGw changes (after save/reload), but not while user has unsaved edits
  useEffect(() => { if (!isDirty.current) setEvents(initEvents()) }, [initEvents])

  // Computed lock time: 1h before earliest match_time in events (auto-managed by backend)
  const computedLockTime = useMemo(() => {
    const times = events
      .map(e => e.match_time ? new Date(e.match_time).getTime() : null)
      .filter(t => t !== null && !isNaN(t))
    if (!times.length) return null
    return new Date(Math.min(...times) - 60 * 60 * 1000)
  }, [events])

  const pickCount = (id) => events.filter(ev => ev.fixture_id === String(id)).length

  const toggleFixture = (fix) => {
    if (events.length >= 15) return
    isDirty.current = true
    const isKnockout = KNOCKOUT_ROUND_RE.test(fix.round || '')
    const defaultType = isKnockout ? 'WHO_QUALIFIES' : 'MATCH_RESULT'
    setEvents(prev => [...prev, {
      fixture_id:   String(fix.id),
      fixture_name: isKnockout
        ? knockoutFixtureName(fix.home_team, fix.away_team)
        : `${fix.home_team} vs ${fix.away_team}`,
      home_team:    fix.home_team,
      away_team:    fix.away_team,
      match_time:   fix.date,
      competition:  fix.competition_name || '',
      event_type:   defaultType,
      threshold:    '2.5',
      no_draw:      false,
      options:      buildOptions(defaultType, fix.home_team, fix.away_team, '2.5', false),
    }])
  }

  const updateEventType = (idx, type) => {
    isDirty.current = true
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      const no_draw = type === 'MATCH_RESULT' ? ev.no_draw : false
      const fixture_name = type === 'WHO_QUALIFIES'
        ? knockoutFixtureName(ev.home_team, ev.away_team)
        : `${ev.home_team} vs ${ev.away_team}`
      return { ...ev, event_type: type, no_draw, fixture_name, options: buildOptions(type, ev.home_team, ev.away_team, ev.threshold, no_draw) }
    }))
  }

  const updateNoDraw = (idx, no_draw) => {
    isDirty.current = true
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      return { ...ev, no_draw, options: buildOptions(ev.event_type, ev.home_team, ev.away_team, ev.threshold, no_draw) }
    }))
  }

  const updateThreshold = (idx, threshold) => {
    isDirty.current = true
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      return { ...ev, threshold, options: buildOptions(ev.event_type, ev.home_team, ev.away_team, threshold, ev.no_draw) }
    }))
  }

  const updatePlayerName = (idx, player_name) => {
    isDirty.current = true
    setEvents(prev => prev.map((ev, i) => i !== idx ? ev : { ...ev, player_name }))
  }

  const updateEnergyCost = (evIdx, optIdx, energy_cost) => {
    isDirty.current = true
    setEvents(prev => prev.map((ev, i) => {
      if (i !== evIdx) return ev
      return { ...ev, options: ev.options.map((o, j) => j === optIdx ? { ...o, energy_cost: Number(energy_cost) } : o) }
    }))
  }

  const removeEvent = (idx) => { isDirty.current = true; setEvents(prev => prev.filter((_, i) => i !== idx)) }

  const handleSave = async (andPublish = false) => {
    if (andPublish && events.length !== 15) { setErr('Need exactly 15 events to publish'); return }
    if (events.length === 0) { setErr('Add at least 1 event'); return }
    if (andPublish) {
      const badEvent = events.find(ev => ev.options.reduce((s, o) => s + Number(o.energy_cost || 0), 0) !== 10)
      if (badEvent) { setErr(`Energy costs for "${badEvent.fixture_name}" must sum to 10`); return }
    }
    setSaving(true); setErr('')
    try {
      // If editing an already-published gameweek, always re-publish after saving
      const wasPublished = gwStatus === 'PUBLISHED'
      const shouldPublish = andPublish || wasPublished
      const res = await addSprintGameweek(sprintId, { sprint_week: week, events, base_energy: baseEnergy })
      if (shouldPublish) await publishGameweek(res.data.gameweek_id)
      setMsg(shouldPublish ? 'Gameweek published!' : 'Draft saved!')
      setEditing(false)
      isDirty.current = false
      setTimeout(() => setMsg(''), 3000)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.error || e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUnlock = async () => {
    if (!existingGw?.id) return
    if (!window.confirm('Reopen picks? This will recalculate lock time from events and unlock the pick window.')) return
    setUnlocking(true)
    try {
      const res = await unlockGameweek(existingGw.id)
      onFlash?.(`Pick window reopened — new lock: ${res.data?.lock_time ? new Date(res.data.lock_time).toLocaleString('en-GB') : 'auto-calculated'}`)
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.message || 'Unlock failed')
    } finally { setUnlocking(false) }
  }

  const [filterLeague, setFilterLeague] = useState('')

  // Group fixtures by league
  const allLeagues = useMemo(() => {
    const seen = new Set()
    for (const f of weekFixtures) seen.add(f.competition_name || 'Other')
    return [...seen].sort()
  }, [weekFixtures])

  const filteredFixtures = useMemo(() =>
    filterLeague ? weekFixtures.filter(f => (f.competition_name || 'Other') === filterLeague) : weekFixtures,
    [weekFixtures, filterLeague]
  )

  const groupedFixtures = useMemo(() => {
    const groups = {}
    for (const f of filteredFixtures) {
      const league = f.competition_name || 'Other'
      if (!groups[league]) groups[league] = []
      groups[league].push(f)
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredFixtures])

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
    <div className="space-y-6">
      {/* Status + progress header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-gray-400 text-sm">{weekLabel}</p>
            {gwStatusInfo
              ? <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${gwStatusInfo.bg} ${gwStatusInfo.color}`}>{gwStatus}</span>
              : <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 text-gray-600">EMPTY — not configured yet</span>
            }
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 rounded-full h-2">
              <div className={`h-full rounded-full transition-all ${events.length === 15 ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-sm font-bold flex-shrink-0 ${events.length === 15 ? 'text-green-400' : 'text-indigo-400'}`}>
              {events.length}/15 {events.length === 15 && '✓'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">

          {err && <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{err}</div>}
          {msg && <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl px-4 py-3 text-indigo-300 text-sm">{msg}</div>}

          {/* Lock time — auto-calculated, shown as info only */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/3 border border-white/8 rounded-xl">
            <span className="text-lg">🔒</span>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Auto-locks</p>
              <p className="text-white text-sm font-medium">
                {(isEditing ? computedLockTime : existingGw?.lock_time ? new Date(existingGw.lock_time) : computedLockTime)
                  ? `${fmtDate(isEditing ? computedLockTime : existingGw?.lock_time || computedLockTime)} at ${fmtTime(isEditing ? computedLockTime : existingGw?.lock_time || computedLockTime)}`
                  : events.length === 0 ? 'Add events to calculate' : '1h before first kick-off'}
              </p>
            </div>
            <p className="text-gray-700 text-xs ml-auto">1h before first kick-off · auto-managed</p>
          </div>

          {/* Base energy */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/3 border border-white/8 rounded-xl">
            <span className="text-lg">⚡</span>
            <div className="flex-1">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Base energy per user</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  {[25, 30, 35, 40].map(v => (
                    <button
                      key={v}
                      onClick={() => { isDirty.current = true; setBaseEnergy(v) }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        baseEnergy === v
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-indigo-500/50'
                      }`}
                    >{v}</button>
                  ))}
                  <input
                    type="number"
                    min={10} max={60}
                    value={baseEnergy}
                    onChange={e => { isDirty.current = true; setBaseEnergy(Number(e.target.value)) }}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <p className="text-white text-sm font-medium">{baseEnergy} units</p>
              )}
            </div>
            <p className="text-gray-700 text-xs ml-auto">free user budget</p>
          </div>

          {/* Stats row + action buttons for non-empty gameweeks */}
          {gwStatus && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {[
                  ['Events',   (existingGw.event_count ?? events.length) + '/15'],
                  ['Picks in', existingGw.entry_count ?? 0],
                  ['Locks',    existingGw.lock_time ? new Date(existingGw.lock_time).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'],
                  ['Closes',   existingGw.end_date  ? new Date(existingGw.end_date).toLocaleDateString('en-GB',  { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'],
                  ['Status',   gwStatus],
                ].map(([label, val]) => (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-gray-600 text-[10px]">{label}</p>
                    <p className={`font-bold text-xs mt-0.5 ${
                      label === 'Status'
                        ? gwStatus === 'PUBLISHED' ? 'text-blue-400'
                        : gwStatus === 'LOCKED'    ? 'text-yellow-400'
                        : gwStatus === 'FINISHED'  ? 'text-purple-400'
                        : 'text-white'
                        : 'text-white'
                    }`}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {gwStatus === 'PUBLISHED' && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Edit events
                  </button>
                )}
                {gwStatus === 'PUBLISHED' && editing && (
                  <button
                    onClick={() => { setEditing(false); isDirty.current = false; setEvents(initEvents()) }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                )}
                {gwStatus === 'LOCKED' && (
                  <>
                    <button
                      onClick={handleUnlock}
                      disabled={unlocking}
                      className="px-3 py-1.5 bg-orange-600/15 hover:bg-orange-600/30 text-orange-400 border border-orange-500/20 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      title="Reopen pick window — recalculates lock time from events"
                    >
                      {unlocking
                        ? <><span className="w-3 h-3 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin"/>Unlocking…</>
                        : '🔓 Reopen picks'
                      }
                    </button>
                  </>
                )}
              </div>
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

                {/* Competition filter pills */}
                {allLeagues.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      onClick={() => setFilterLeague('')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        !filterLeague ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      All ({weekFixtures.length})
                    </button>
                    {allLeagues.map(l => (
                      <button
                        key={l}
                        onClick={() => setFilterLeague(l === filterLeague ? '' : l)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          filterLeague === l ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {l} ({weekFixtures.filter(f => (f.competition_name || 'Other') === l).length})
                      </button>
                    ))}
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
                              pickCount={pickCount(fix.id)}
                              disabled={events.length >= 15}
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
                      <div key={evIdx}
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
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Player name</label>
                            <input
                              placeholder="e.g. Haaland, Mbappe, Vinicius Junior"
                              value={ev.player_name || ''}
                              onChange={e => updatePlayerName(evIdx, e.target.value)}
                              className="w-full bg-indigo-950/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400 placeholder-gray-700 font-medium"
                            />
                            <p className="text-[10px] text-gray-600 leading-snug">
                              Enter the player's last name or full name. Accents (é→e), abbreviations (K. Kane→Kane) and minor typos are matched automatically.
                            </p>
                          </div>
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

// ── Gameweek date editor row ──────────────────────────────────────────────────
function GameweekDateRow({ week, gw, sprintId, sprintStart, onSaved }) {
  const computed = getWeekBounds(sprintStart, week)
  const storedStart = gw?.start_date ? gw.start_date.slice(0, 16) : computed.weekStart.toISOString().slice(0, 16)
  const storedEnd   = gw?.end_date   ? gw.end_date.slice(0, 16)   : computed.weekEnd.toISOString().slice(0, 16)

  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ start_date: storedStart, end_date: storedEnd })
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"

  const statusInfo = gw ? GW_STATUS[gw.status] : null

  const handleSave = async () => {
    if (!gw) return
    setSaving(true)
    try {
      await updateGameweekDates(sprintId, gw.id, form)
      setMsg('Saved!')
      setEditing(false)
      onSaved()
    } catch (e) {
      setMsg(e.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <div className="bg-white/3 border border-white/8 rounded-2xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
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
          {!editing && (
            <p className="text-gray-500 text-xs mt-0.5">
              {new Date(form.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' → '}
              {new Date(form.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {gw && gw.event_count != null && (
            <span className={`text-xs font-bold ${gw.event_count >= 15 ? 'text-green-400' : 'text-gray-600'}`}>
              {gw.event_count}/15
            </span>
          )}
          {gw && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
            >
              Edit dates
            </button>
          )}
        </div>
      </div>

      {/* Lock & settle time pills — shown when not editing */}
      {!editing && (gw?.lock_time || form.end_date) && (
        <div className="flex gap-2 flex-wrap">
          {gw?.lock_time && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-900/15 border border-yellow-500/20 rounded-lg">
              <span className="text-yellow-400 text-[11px]">🔒</span>
              <div>
                <p className="text-yellow-500/70 text-[9px] uppercase tracking-wider font-semibold leading-none mb-0.5">Locks</p>
                <p className="text-yellow-300 text-[11px] font-medium leading-none">
                  {new Date(gw.lock_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}
                  {new Date(gw.lock_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )}
          {form.end_date && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-900/15 border border-purple-500/20 rounded-lg">
              <span className="text-purple-400 text-[11px]">⚙️</span>
              <div>
                <p className="text-purple-500/70 text-[9px] uppercase tracking-wider font-semibold leading-none mb-0.5">Closes (fallback)</p>
                <p className="text-purple-300 text-[11px] font-medium leading-none">
                  {new Date(form.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}
                  {new Date(form.end_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="pt-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Start (Mon)</label>
              <input className={inp} type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">End / Settles (Sun)</label>
              <input className={inp} type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          {msg && <p className="text-indigo-300 text-xs">{msg}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save dates'}
            </button>
            <button
              onClick={() => { setEditing(false); setForm({ start_date: storedStart, end_date: storedEnd }) }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sprint settings ───────────────────────────────────────────────────────────
function SprintSettings({ sprint, onSaved }) {
  const gwCount  = sprint.gameweek_count || 4
  const gwByWeek = {}
  for (const gw of (sprint.gameweeks || [])) gwByWeek[gw.sprint_week] = gw

  // Find the last gameweek (highest sprint_week among existing ones)
  const lastGw = (sprint.gameweeks || []).reduce(
    (best, gw) => (!best || gw.sprint_week > best.sprint_week) ? gw : best, null
  )

  // Compute the suggested sprint end:
  // 1. Last gameweek's end_date (set to last fixture + 2h when fixtures are synced)
  // 2. Fallback: Sunday 23:59 UTC of the last matchweek
  const computedEnd = (() => {
    if (lastGw?.end_date) return lastGw.end_date.slice(0, 16)
    if (sprint.start_date) {
      const base = new Date(sprint.start_date)
      // Monday of last week = base + (gwCount-1)*7 days, clamped to Monday
      const day = base.getUTCDay()
      const toMon = day === 0 ? 1 : day === 1 ? 0 : 8 - day
      const lastMon = new Date(base.getTime() + ((gwCount - 1) * 7 + toMon) * 86400000)
      lastMon.setUTCHours(0, 0, 0, 0)
      // Sunday 23:59 of that week
      const sunday = new Date(lastMon.getTime() + 6 * 86400000)
      sunday.setUTCHours(23, 59, 0, 0)
      return sunday.toISOString().slice(0, 16)
    }
    return sprint.end_date?.slice(0, 16) ?? ''
  })()

  const [form, setForm] = useState({
    name:       sprint.name,
    start_date: sprint.start_date?.slice(0, 16),
    end_date:   sprint.end_date?.slice(0, 16) ?? computedEnd,
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
      setMsg('Error: ' + (e.response?.data?.error || e.response?.data?.message || 'save failed'))
    } finally {
      setSaving(false); setTimeout(() => setMsg(''), 3000)
    }
  }

  const endMatchesComputed = form.end_date === computedEnd
  const endSource = lastGw?.end_date ? 'last fixture of last matchweek' : 'Sun 23:59 of last matchweek'

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold">Sprint settings</h3>
        {msg && <p className={`text-xs ${msg.startsWith('Error') ? 'text-red-400' : 'text-indigo-300'}`}>{msg}</p>}
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
            <label className="text-gray-400 text-xs mb-1 block">End (auto-settles here)</label>
            <input
              className={inp}
              type="datetime-local"
              value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
            />
            <div className="flex items-center justify-between mt-1 gap-2">
              <p className={`text-[10px] ${endMatchesComputed ? 'text-green-600' : 'text-yellow-600'}`}>
                {endMatchesComputed ? `✓ Computed from ${endSource}` : `⚠ Differs from computed (${endSource})`}
              </p>
              {!endMatchesComputed && computedEnd && (
                <button
                  type="button"
                  onClick={() => set('end_date', computedEnd)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline flex-shrink-0"
                >
                  Use computed
                </button>
              )}
            </div>
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Per-gameweek date settings */}
      <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-white font-semibold">Gameweek date windows</h3>
          <p className="text-gray-600 text-xs mt-0.5">Default: Monday 00:00 → Sunday 23:59 based on sprint start. Override per week if needed.</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: gwCount }, (_, i) => i + 1).map(week => (
            <GameweekDateRow
              key={week}
              week={week}
              gw={gwByWeek[week] || null}
              sprintId={sprint.id}
              sprintStart={sprint.start_date}
              onSaved={onSaved}
            />
          ))}
        </div>
        <p className="text-gray-600 text-xs">Changing dates affects which fixtures appear in the gameweek builder. Lock times are set automatically from match kick-offs.</p>
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
  const [activeGwWeek, setActiveGwWeek] = useState(1)
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

  // Auto-refresh sprint data every 30s when sprint is live or has locked gameweeks
  useEffect(() => {
    if (!sprint) return
    const isActive = sprint.status === 'live' || sprint.status === 'scheduled'
    const hasLockedGw = sprint.gameweeks?.some(g => g.status === 'LOCKED')
    if (!isActive && !hasLockedGw) return
    const interval = setInterval(() => { load() }, 30000)
    return () => clearInterval(interval)
  }, [sprint?.status, sprint?.gameweeks, load])

  // Build a map of week → gameweek record
  const gwByWeek = useMemo(() => {
    const map = {}
    if (sprint?.gameweeks) {
      for (const gw of sprint.gameweeks) map[gw.sprint_week] = gw
    }
    return map
  }, [sprint?.gameweeks])

  // Split all fixtures into per-week buckets using stored dates when available
  const fixturesByWeek = useMemo(() => {
    if (!sprint?.start_date) return {}
    const result = {}
    for (let w = 1; w <= (sprint.gameweek_count || 4); w++) {
      const gw = gwByWeek[w]
      const { weekStart, weekEnd } = getWeekBounds(sprint.start_date, w, gw)
      result[w] = allFixtures.filter(f => {
        const d = new Date(f.date)
        return d >= weekStart && d < weekEnd
      })
    }
    return result
  }, [allFixtures, sprint?.start_date, sprint?.gameweek_count, gwByWeek])

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
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[sprint.status] || 'bg-gray-600'}`}/>
              <span className={`text-sm font-semibold ${STATUS_TEXT[sprint.status] || 'text-gray-400'}`}>
                {sprint.status?.toUpperCase()}
              </span>
            </div>
            {(sprint.status === 'live' || sprint.gameweeks?.some(g => g.status === 'LOCKED')) && (
              <span className="flex items-center gap-1.5 text-[10px] text-gray-600 bg-white/3 border border-white/8 rounded-lg px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                Auto-refresh 30s
              </span>
            )}
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

      {/* Auto-settlement info banner */}
      {sprint.status === 'live' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
          <span className="text-xl flex-shrink-0">⚙️</span>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-0.5">Auto-settles</p>
            <p className="text-white text-sm font-medium">
              When the last fixture of the last week resolves
            </p>
            {sprint.end_date && (
              <p className="text-gray-600 text-xs mt-0.5">
                Fallback: {new Date(sprint.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(sprint.end_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <p className="text-gray-600 text-xs text-right flex-shrink-0">Promotions & relegations<br/>applied automatically</p>
        </div>
      )}
      {sprint.status === 'completed' && sprint.settled_at && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
          <span className="text-xl flex-shrink-0">✅</span>
          <div>
            <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-0.5">Settled</p>
            <p className="text-white text-sm font-medium">
              {new Date(sprint.settled_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' at '}
              {new Date(sprint.settled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
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

      {/* Gameweeks tab — sub-tabs W1/W2/W3/W4 */}
      {activeTab === 'gameweeks' && (
        <div className="space-y-6">
          {/* Fixture load feedback */}
          {fixtureErr && (
            <div className="bg-red-900/15 border border-red-500/20 rounded-xl px-4 py-2 text-red-400 text-xs">
              Fixture load error: {fixtureErr}
            </div>
          )}
          {!loadingFix && !fixtureErr && allFixtures.length === 0 && (
            <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl px-4 py-2 text-yellow-600 text-xs">
              No fixtures cached for this sprint period. Go to <strong className="text-yellow-500">Competitions</strong> → import a competition, then use "Sync fixtures" inside each week.
            </div>
          )}

          {/* Week sub-tabs */}
          <div className="flex gap-2">
            {Array.from({ length: gwCount }, (_, i) => i + 1).map(w => {
              const gw        = gwByWeek[w]
              const evCount   = gw ? (gw.event_count ?? 0) : 0
              const isActive  = w === activeGwWeek
              const statusInfo = gw ? GW_STATUS[gw.status] : null
              return (
                <button
                  key={w}
                  onClick={() => setActiveGwWeek(w)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                      : 'bg-[#0d1117] border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/15'
                  }`}
                >
                  <span className={`text-base font-black ${isActive ? 'text-white' : 'text-gray-400'}`}>W{w}</span>
                  {gw ? (
                    <>
                      <span className={`text-[10px] font-bold ${evCount >= 15 ? 'text-green-400' : isActive ? 'text-indigo-300' : 'text-gray-600'}`}>
                        {evCount}/15
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusInfo?.bg} ${statusInfo?.color}`}>
                        {gw.status}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-700">EMPTY</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active week section */}
          <div className="bg-[#0d1117] border border-white/8 rounded-3xl px-6 py-6">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${
                gwByWeek[activeGwWeek]?.status === 'PUBLISHED' ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300' :
                gwByWeek[activeGwWeek]?.status === 'FINISHED'  ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300' :
                gwByWeek[activeGwWeek]?.status === 'LOCKED'    ? 'bg-yellow-600/30 border border-yellow-500/40 text-yellow-300' :
                gwByWeek[activeGwWeek]?.status === 'DRAFT'     ? 'bg-white/10 border border-white/20 text-white' :
                'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
              }`}>
                {activeGwWeek}
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Gameweek {activeGwWeek}</h3>
                {loadingFix && <p className="text-gray-600 text-xs mt-0.5">Loading fixtures…</p>}
                {!loadingFix && (fixturesByWeek[activeGwWeek] || []).length > 0 && (
                  <p className="text-gray-500 text-xs mt-0.5">{(fixturesByWeek[activeGwWeek] || []).length} fixtures available this week</p>
                )}
              </div>
            </div>
            <GameweekSection
              key={activeGwWeek}
              week={activeGwWeek}
              sprintId={id}
              sprintStart={sprint.start_date}
              sprintEnd={sprint.end_date}
              existingGw={gwByWeek[activeGwWeek] || null}
              weekFixtures={fixturesByWeek[activeGwWeek] || []}
              loadingFixtures={loadingFix}
              onSaved={load}
              onFixturesImported={loadFixtures}
              onFlash={flash}
            />
          </div>

          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4 text-xs text-gray-600 space-y-1">
            <p className="text-gray-400 font-medium">Workflow</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Configure and publish each gameweek before activating</li>
              <li>Activate the sprint to open competition for all players</li>
              <li>Each gameweek locks automatically at kick-off and settles at its end date</li>
              <li>Sprint settles automatically at its end date — promotions & relegations applied</li>
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
