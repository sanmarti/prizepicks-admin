import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getCompetitions } from '../../api/competitions'
import { publishGameweek } from '../../api/gameweeks'
import { listSprints, addSprintGameweek } from '../../api/sprints'
import { getOdds } from '../../api/fixtures'
import { useToast } from '../../hooks/useToast'
import FixtureSelector from '../../components/admin/gameweek/FixtureSelector'
import EnergyDistribution from '../../components/admin/gameweek/EnergyDistribution'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const STEPS = ['Basic Info', 'Import Fixtures', 'Build Events', 'Publish']
const EVENT_MIN = 6
const EVENT_MAX = 15
const THRESHOLDS = ['1.5', '2.5', '3.5', '4.5']

const EVENT_TYPE_META = {
  MATCH_RESULT:  { icon: '⚽', label: 'Match Result',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  GOALS:         { icon: '📊', label: 'Goals O/U',     color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  PLAYER_SCORE:  { icon: '👤', label: 'Player Goal',   color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  CLEAN_SHEET:   { icon: '🛡', label: 'Clean Sheet',   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(prob) { return prob != null ? `${(prob * 100).toFixed(1)}%` : '—' }

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-0 mb-8 flex-wrap gap-y-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            i === step ? 'bg-indigo-600 text-white' :
            i < step   ? 'bg-green-600/20 text-green-400' :
                         'bg-white/5 text-gray-500'
          }`}>
            <span>{i < step ? '✓' : i + 1}</span>
            <span>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`w-6 h-px mx-1 ${i < step ? 'bg-green-600' : 'bg-white/10'}`}/>}
        </div>
      ))}
    </div>
  )
}

function EventProgress({ count }) {
  const over = count > EVENT_MAX
  const ready = count >= EVENT_MIN
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#0d1117] border border-white/8 rounded-xl sticky top-0 z-10">
      <div className="flex gap-1">
        {Array.from({ length: EVENT_MAX }, (_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
            i < count
              ? over    ? 'bg-red-400'
                : ready ? 'bg-indigo-500'
                        : 'bg-yellow-500'
              : i < EVENT_MIN ? 'bg-white/20' : 'bg-white/8'
          }`}/>
        ))}
      </div>
      <span className={`text-sm font-bold ${over ? 'text-red-400' : ready ? 'text-green-400' : 'text-yellow-400'}`}>
        {count} / {EVENT_MAX}
      </span>
      <span className="text-gray-500 text-xs">
        {over   ? `${count - EVENT_MAX} over maximum` :
         ready  ? `✓ Ready to publish` :
                  `${EVENT_MIN - count} more needed (min ${EVENT_MIN})`}
      </span>
    </div>
  )
}

function OddsChip({ label, odd, prob, energy }) {
  if (energy === null || energy === undefined) return null
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 bg-white/5 rounded-lg min-w-[80px]">
      <span className="text-white text-xs font-medium truncate w-full text-center">{label}</span>
      <span className="text-gray-400 text-[10px]">{odd ? `${odd}` : '—'} · {pct(prob)}</span>
      <span className="text-indigo-400 text-[11px] font-bold">⚡{energy}</span>
    </div>
  )
}

function CreatedEventRow({ event, onRemove, onUpdateEnergy }) {
  const meta = EVENT_TYPE_META[event.event_type] ?? EVENT_TYPE_META.MATCH_RESULT
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${meta.bg}`}>
      <span className="text-lg mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${meta.color} mb-1.5`}>
          {meta.label}{event.player_name ? ` · ${event.player_name}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {event.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2 py-1">
              <span className="text-gray-200 text-xs">{opt.label}</span>
              <span className="text-gray-500 text-[10px]">
                {opt.prob ? `${pct(opt.prob)}` : ''}
              </span>
              <input
                type="number" min={1} max={9} value={opt.energy_cost ?? 5}
                onChange={e => onUpdateEnergy(event.id, i, parseInt(e.target.value))}
                className="w-8 bg-white/10 border border-white/10 rounded text-center text-xs text-indigo-300 focus:outline-none focus:border-indigo-400"
              />
              <span className="text-indigo-400 text-[10px]">⚡</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => onRemove(event.id)}
        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none mt-0.5 flex-shrink-0">
        ×
      </button>
    </div>
  )
}

function AddEventPanel({ fixture, odds, fixtureEvents, onAdd }) {
  const [addType, setAddType]           = useState(null)
  const [threshold, setThreshold]       = useState('2.5')
  const [playerName, setPlayerName]     = useState('')
  const [playerEnergy, setPlayerEnergy] = useState(5)
  const [csTeam, setCsTeam]             = useState('home')
  const [csEnergy, setCsEnergy]         = useState(6)

  const hasMatchResult = fixtureEvents.some(e => e.event_type === 'MATCH_RESULT')
  const usedThresholds = fixtureEvents
    .filter(e => e.event_type === 'GOALS')
    .map(e => e.options[0]?.label?.split(' ')[1])

  function doAddMatchResult() {
    const mw = (odds?.match_winner ?? []).filter(o => o.energy_cost !== null)
    const options = mw.length > 0
      ? mw.map(o => ({ label: o.label, energy_cost: o.energy_cost, prob: o.prob, odd: o.odd }))
      : [
          { label: 'Home Win', energy_cost: 6 },
          { label: 'Draw',     energy_cost: 3 },
          { label: 'Away Win', energy_cost: 2 },
        ]
    onAdd(fixture.id, 'MATCH_RESULT', options)
    setAddType(null)
  }

  function doAddGoals() {
    const ou = odds?.goals_ou ?? []
    const overOpt  = ou.find(o => o.label === `Over ${threshold}`)
    const underOpt = ou.find(o => o.label === `Under ${threshold}`)
    const options = [
      { label: `Over ${threshold}`,  energy_cost: (overOpt?.energy_cost ?? 5),  prob: overOpt?.prob,  odd: overOpt?.odd  },
      { label: `Under ${threshold}`, energy_cost: (underOpt?.energy_cost ?? 5), prob: underOpt?.prob, odd: underOpt?.odd },
    ]
    onAdd(fixture.id, 'GOALS', options)
    setAddType(null)
  }

  function doAddPlayerGoal() {
    if (!playerName.trim()) return
    onAdd(fixture.id, 'PLAYER_SCORE',
      [{ label: `${playerName.trim()} scores`, energy_cost: playerEnergy }],
      { player_name: playerName.trim() }
    )
    setPlayerName('')
    setAddType(null)
  }

  function doAddCleanSheet() {
    const team = csTeam === 'home' ? fixture.home : fixture.away
    onAdd(fixture.id, 'CLEAN_SHEET',
      [{ label: `${team} clean sheet`, energy_cost: csEnergy }]
    )
    setAddType(null)
  }

  // Goals O/U preview for selected threshold
  const ou = odds?.goals_ou ?? []
  const overPreview  = ou.find(o => o.label === `Over ${threshold}`)
  const underPreview = ou.find(o => o.label === `Under ${threshold}`)

  return (
    <div className="space-y-3 pt-2">
      {/* Type buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { type: 'MATCH_RESULT', disabled: hasMatchResult },
          { type: 'GOALS',        disabled: false },
          { type: 'PLAYER_SCORE', disabled: false },
          { type: 'CLEAN_SHEET',  disabled: false },
        ].map(({ type, disabled }) => {
          const meta = EVENT_TYPE_META[type]
          const isActive = addType === type
          return (
            <button key={type}
              disabled={disabled}
              onClick={() => setAddType(isActive ? null : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                disabled ? 'opacity-30 cursor-not-allowed bg-white/3 border-white/8 text-gray-500' :
                isActive  ? 'bg-indigo-600 border-indigo-500 text-white' :
                            'bg-white/5 border-white/10 text-gray-300 hover:border-white/25'
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              {disabled && type === 'MATCH_RESULT' && <span className="text-[10px] opacity-60">✓</span>}
            </button>
          )
        })}
      </div>

      {/* Inline forms */}
      {addType === 'MATCH_RESULT' && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400">Match Winner · odds from API-Football</p>
          <div className="flex gap-2 flex-wrap">
            {(odds?.match_winner ?? []).filter(o => o.energy_cost !== null).map(o => (
              <OddsChip key={o.label} {...o}/>
            ))}
            {!odds?.match_winner?.length && (
              <p className="text-gray-500 text-xs">No odds available — default energy costs will be used</p>
            )}
          </div>
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={doAddMatchResult}>Add Event</ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => setAddType(null)}>Cancel</ActionButton>
          </div>
        </div>
      )}

      {addType === 'GOALS' && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400">Goals Over/Under</p>
          <div className="flex gap-2">
            {THRESHOLDS.map(t => (
              <button key={t}
                onClick={() => setThreshold(t)}
                disabled={usedThresholds.includes(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  usedThresholds.includes(t) ? 'opacity-30 cursor-not-allowed bg-white/3 text-gray-500' :
                  threshold === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}>
                {t}
              </button>
            ))}
          </div>
          {/* Odds preview for selected threshold */}
          <div className="flex gap-3">
            {overPreview && overPreview.energy_cost !== null && <OddsChip {...overPreview} label={`Over ${threshold}`}/>}
            {underPreview && underPreview.energy_cost !== null && <OddsChip {...underPreview} label={`Under ${threshold}`}/>}
            {(!overPreview || !underPreview) && (
              <p className="text-gray-500 text-xs">No odds for this threshold — default ⚡5 will be used</p>
            )}
          </div>
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={doAddGoals}>Add Event</ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => setAddType(null)}>Cancel</ActionButton>
          </div>
        </div>
      )}

      {addType === 'PLAYER_SCORE' && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400">Player Goal — will the player score in this match?</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-1">Player Name</label>
              <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                placeholder="e.g. Salah, Mbappé…"
                onKeyDown={e => e.key === 'Enter' && doAddPlayerGoal()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"/>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Energy ⚡</label>
              <input type="number" min={1} max={9} value={playerEnergy}
                onChange={e => setPlayerEnergy(parseInt(e.target.value))}
                className="w-16 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"/>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={doAddPlayerGoal} disabled={!playerName.trim()}>Add Event</ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => setAddType(null)}>Cancel</ActionButton>
          </div>
        </div>
      )}

      {addType === 'CLEAN_SHEET' && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400">Clean Sheet — will a team concede zero goals?</p>
          <div className="flex gap-2">
            {[['home', fixture.home], ['away', fixture.away]].map(([side, name]) => (
              <button key={side} onClick={() => setCsTeam(side)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all ${
                  csTeam === side ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}>
                {name} <span className="text-xs opacity-60">({side})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-gray-500">Energy cost</label>
            <input type="number" min={1} max={9} value={csEnergy}
              onChange={e => setCsEnergy(parseInt(e.target.value))}
              className="w-16 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"/>
            <span className="text-indigo-400 text-sm">⚡</span>
          </div>
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={doAddCleanSheet}>Add Event</ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => setAddType(null)}>Cancel</ActionButton>
          </div>
        </div>
      )}
    </div>
  )
}

function FixtureEventPanel({ fixture, odds, fixtureEvents, onAdd, onRemove, onUpdateEnergy }) {
  const [open, setOpen] = useState(false)
  const count = fixtureEvents.length
  const matchTime = fixture.date ? new Date(fixture.date).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : '—'

  const eventTypesAdded = [...new Set(fixtureEvents.map(e => EVENT_TYPE_META[e.event_type]?.icon ?? '?'))]

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
      {/* Fixture header — clickable */}
      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-semibold">{fixture.home}</span>
            <span className="text-gray-500 text-xs">vs</span>
            <span className="text-white font-semibold">{fixture.away}</span>
          </div>
          <p className="text-gray-500 text-xs">
            {fixture.competition} · {matchTime}
            {count === 0 && <span className="ml-2 text-gray-600">· click to add picks</span>}
          </p>
        </div>

        {/* Odds preview (collapsed) */}
        {odds && !odds.loading && odds.match_winner?.length > 0 && (
          <div className="hidden sm:flex gap-3 text-xs text-gray-400">
            {odds.match_winner.filter(o => o.energy_cost !== null).map(o => (
              <span key={o.label}>
                <span className="text-gray-500">{o.label.split(' ').pop()}</span>{' '}
                <span className="text-white">{o.odd}</span>{' '}
                <span className="text-indigo-400">⚡{o.energy_cost}</span>
              </span>
            ))}
          </div>
        )}
        {odds?.loading && <span className="text-gray-600 text-xs">Loading odds…</span>}

        <div className="flex items-center gap-2 flex-shrink-0">
          {eventTypesAdded.length > 0 && (
            <span className="text-sm tracking-wide">{eventTypesAdded.join('')}</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            count === 0 ? 'bg-white/5 text-gray-500' : 'bg-indigo-600/20 text-indigo-400'
          }`}>
            {count} pick{count !== 1 ? 's' : ''}
          </span>
          <span className={`text-gray-500 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-3">
          {/* Full odds row */}
          {odds && !odds.loading && (
            <div className="bg-black/20 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Match Winner Odds (API-Football)</p>
              {odds.match_winner?.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {odds.match_winner.map(o => (
                    <OddsChip key={o.label} {...o}/>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-xs">No odds available for this fixture</p>
              )}
            </div>
          )}

          {/* Created events */}
          {fixtureEvents.length > 0 && (
            <div className="space-y-2">
              {fixtureEvents.map(ev => (
                <CreatedEventRow
                  key={ev.id} event={ev}
                  onRemove={onRemove}
                  onUpdateEnergy={onUpdateEnergy}
                />
              ))}
            </div>
          )}

          {/* Add event panel — multiple picks per fixture are allowed */}
          <div>
            <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">
              Add picks for this fixture — you can combine Match Result + Goals O/U + Player Goal + Clean Sheet
            </p>
            <AddEventPanel
              fixture={fixture}
              odds={odds}
              fixtureEvents={fixtureEvents}
              onAdd={onAdd}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GameweekBuilderPage() {
  const navigate = useNavigate()
  const { data: competitions } = useApi(getCompetitions)
  const { data: sprints }      = useApi(listSprints)
  const { toasts, toast } = useToast()

  const [step, setStep]         = useState(0)
  const [saving, setSaving]     = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)

  // Step 0
  const [sprintId, setSprintId]   = useState('')
  const [sprintWeek, setSprintWeek] = useState('')
  const [weekNumber, setWeekNumber] = useState('') // kept for display in publish modal
  const [lockTime, setLockTime]   = useState('')
  const [revealTime, setRevealTime] = useState('')
  // Competition kept only for fixture import context (not stored on gameweek)
  const [competitionId, setCompetitionId] = useState('')

  // Step 2
  const [selectedFixtures, setSelectedFixtures] = useState([])

  // Step 3
  const [events, setEvents]     = useState([])
  const [oddsMap, setOddsMap]   = useState({}) // fixtureId → {loading, match_winner, goals_ou}
  const [openFixtures, setOpenFixtures] = useState([]) // array of fixture IDs that are open

  const activeCompetitions  = competitions ?? []
  const selectedCompetition = activeCompetitions.find(c => c.id === competitionId)
  const activeSprints       = (sprints ?? []).filter(s => ['draft','scheduled','live'].includes(s.status))
  const selectedSprint      = activeSprints.find(s => s.id === sprintId)

  // Fetch odds when entering Step 3
  useEffect(() => {
    if (step !== 2) return
    // Auto-open first fixture
    if (selectedFixtures.length > 0) {
      setOpenFixtures([String(selectedFixtures[0].id)])
    }
    selectedFixtures.forEach(f => {
      const fid = String(f.id)
      if (oddsMap[fid]) return
      setOddsMap(prev => ({ ...prev, [fid]: { loading: true } }))
      getOdds(fid)
        .then(res => setOddsMap(prev => ({ ...prev, [fid]: { loading: false, ...res.data } })))
        .catch(() => setOddsMap(prev => ({ ...prev, [fid]: { loading: false, match_winner: [], goals_ou: [] } })))
    })
  }, [step])

  // Event management
  function addEvent(fixtureId, eventType, options, extra = {}) {
    const fid = String(fixtureId)
    const fixture = selectedFixtures.find(f => String(f.id) === fid)
    setEvents(prev => [...prev, {
      id: `${fid}-${eventType}-${Date.now()}`,
      fixture_id: fid,
      fixture_name: `${fixture.home} vs ${fixture.away}`,
      event_type: eventType,
      match_time: fixture.date,
      competition: fixture.competition,
      options,
      ...extra,
    }])
  }

  function removeEvent(eventId) {
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  function updateEnergy(eventId, optIdx, cost) {
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, options: e.options.map((o, i) => i === optIdx ? { ...o, energy_cost: cost } : o) }
        : e
    ))
  }

  // Quick fill: add Match Result + Goals 2.5 for all fixtures that don't have them
  function quickFill() {
    selectedFixtures.forEach(f => {
      const fid = String(f.id)
      const fixtureEvents = events.filter(e => e.fixture_id === fid)
      const odds = oddsMap[fid]

      if (!fixtureEvents.some(e => e.event_type === 'MATCH_RESULT')) {
        const mw = (odds?.match_winner ?? []).filter(o => o.energy_cost !== null)
        const options = mw.length > 0
          ? mw.map(o => ({ label: o.label, energy_cost: o.energy_cost, prob: o.prob, odd: o.odd }))
          : [{ label: 'Home Win', energy_cost: 6 }, { label: 'Draw', energy_cost: 3 }, { label: 'Away Win', energy_cost: 2 }]
        addEvent(fid, 'MATCH_RESULT', options)
      }
      if (!fixtureEvents.some(e => e.event_type === 'GOALS' && e.options[0]?.label?.includes('2.5'))) {
        const ou = odds?.goals_ou ?? []
        const over  = ou.find(o => o.label === 'Over 2.5')
        const under = ou.find(o => o.label === 'Under 2.5')
        addEvent(fid, 'GOALS', [
          { label: 'Over 2.5',  energy_cost: over?.energy_cost ?? 5,  prob: over?.prob,  odd: over?.odd },
          { label: 'Under 2.5', energy_cost: under?.energy_cost ?? 5, prob: under?.prob, odd: under?.odd },
        ])
      }
    })
  }

  function buildPayload() {
    return {
      sprint_week: parseInt(sprintWeek),
      lock_time:   lockTime,
      reveal_time: revealTime || lockTime,
      events: events.map(e => ({
        event_type:    e.event_type,
        fixture_id:    String(e.fixture_id),
        fixture_name:  e.fixture_name,
        player_name:   e.player_name ?? null,
        competition:   e.competition,
        match_time:    e.match_time,
        options:       e.options.map(o => ({ label: o.label, energy_cost: o.energy_cost })),
      })).filter(e => e.options.length > 0),
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await addSprintGameweek(sprintId, buildPayload())
      toast('Gameweek saved as draft')
      navigate(`/admin/sprints/${sprintId}`)
    } catch (e) {
      toast(e.response?.data?.error ?? 'Save failed', 'error')
    } finally { setSaving(false) }
  }

  async function handlePublish() {
    setConfirmPublish(false)
    setSaving(true)
    try {
      const { data } = await addSprintGameweek(sprintId, buildPayload())
      await publishGameweek(data.gameweek_id)
      toast(`MW${sprintWeek} published for ${selectedSprint?.name}!`, 'success')
      navigate(`/admin/sprints/${sprintId}`)
    } catch (e) {
      toast(e.response?.data?.error ?? 'Publish failed', 'error')
    } finally { setSaving(false) }
  }

  const allOptions = events.flatMap(e => e.options.map(o => ({ ...o, event_type: e.event_type })))

  const step1Missing = [
    !sprintId    && 'Sprint',
    !sprintWeek  && 'Sprint Week',
    !lockTime    && 'Lock Time',
  ].filter(Boolean)
  const canStep1 = step1Missing.length === 0
  const canStep2 = selectedFixtures.length >= 2

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <ConfirmModal
        open={confirmPublish}
        title="Publish Gameweek?"
        message={`This will publish MW${sprintWeek} for "${selectedSprint?.name ?? sprintId}". Users will immediately see the events and can start submitting picks. Continue?`}
        confirmLabel="Publish Now 🚀"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />

      <div className="max-w-3xl mx-auto space-y-6">
        <StepIndicator step={step}/>

        {/* ── STEP 0: Basic Info ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-semibold text-lg">Basic Information</h2>

            {/* Sprint — required */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Sprint <span className="text-red-400">*</span></label>
                <select value={sprintId} onChange={e => { setSprintId(e.target.value); setSprintWeek('') }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                  <option value="">Select sprint…</option>
                  {activeSprints.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                  ))}
                </select>
                {selectedSprint && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    {selectedSprint.start_date} → {selectedSprint.end_date}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Sprint Week (MW) <span className="text-red-400">*</span></label>
                <select value={sprintWeek} onChange={e => setSprintWeek(e.target.value)}
                  disabled={!sprintId}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                  <option value="">Select week…</option>
                  {[1, 2, 3, 4].slice(0, selectedSprint?.gameweek_count ?? 4).map(w => (
                    <option key={w} value={w}>MW{w} — Week {w}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lock / Reveal times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Lock Time <span className="text-red-400">*</span></label>
                <input type="datetime-local" value={lockTime}
                  onChange={e => { setLockTime(e.target.value); if (!revealTime) setRevealTime(e.target.value) }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  style={{ colorScheme: 'dark' }}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Reveal Time</label>
                <input type="datetime-local" value={revealTime} onChange={e => setRevealTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  style={{ colorScheme: 'dark' }}/>
              </div>
            </div>

            {/* Competition — optional, used only for fixture import context */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Competition <span className="text-gray-600">(optional — sets default for fixture import)</span>
              </label>
              <select value={competitionId} onChange={e => setCompetitionId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Any imported competition…</option>
                {activeCompetitions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3">
              {step1Missing.length > 0 && (
                <p className="text-xs text-gray-500">
                  Missing: <span className="text-yellow-400">{step1Missing.join(', ')}</span>
                </p>
              )}
              <ActionButton onClick={() => setStep(1)} disabled={!canStep1}>Next →</ActionButton>
            </div>
          </div>
        )}

        {/* ── STEP 1: Import Fixtures ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-semibold text-lg">Import Fixtures</h2>
            <FixtureSelector
              selected={selectedFixtures}
              onSelect={setSelectedFixtures}
              competition={selectedCompetition}
              competitions={activeCompetitions}
            />
            <div className="flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(0)}>← Back</ActionButton>
              <ActionButton onClick={() => setStep(2)} disabled={!canStep2}>
                Build Events → ({selectedFixtures.length} fixtures)
              </ActionButton>
            </div>
          </div>
        )}

        {/* ── STEP 2: Build Events ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <EventProgress count={events.length}/>

            {/* Quick fill */}
            <div className="flex items-center gap-3">
              <ActionButton variant="secondary" size="sm" onClick={quickFill}>
                ⚡ Quick Fill — Match Result + Goals 2.5 for all fixtures
              </ActionButton>
              {events.length > 0 && (
                <button onClick={() => setEvents([])} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {/* Fixture panels */}
            {selectedFixtures.map(fixture => (
              <FixtureEventPanel
                key={fixture.id}
                fixture={fixture}
                odds={oddsMap[String(fixture.id)]}
                fixtureEvents={events.filter(e => e.fixture_id === String(fixture.id))}
                onAdd={addEvent}
                onRemove={removeEvent}
                onUpdateEnergy={updateEnergy}
              />
            ))}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <ActionButton variant="secondary" onClick={() => setStep(1)}>← Back</ActionButton>
              <div className="flex items-center gap-3">
                {events.length < EVENT_MIN && (
                  <span className="text-yellow-400 text-xs">
                    ⚠ {EVENT_MIN - events.length} more event{EVENT_MIN - events.length !== 1 ? 's' : ''} needed (min {EVENT_MIN})
                  </span>
                )}
                {events.length > EVENT_MAX && (
                  <span className="text-red-400 text-xs">
                    ⚠ {events.length - EVENT_MAX} over maximum ({EVENT_MAX})
                  </span>
                )}
                <ActionButton onClick={() => setStep(3)} disabled={events.length < EVENT_MIN || events.length > EVENT_MAX}>
                  Review & Publish →
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Publish ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
              <h2 className="text-white font-semibold text-lg">Review & Publish</h2>

              {/* Summary grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Sprint',   selectedSprint?.name ?? sprintId],
                  ['MW',       sprintWeek ? `MW${sprintWeek}` : '—'],
                  ['Lock',     lockTime ? new Date(lockTime).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : '—'],
                  ['Fixtures', selectedFixtures.length],
                  ['Events',   events.length],
                  ['Options',  allOptions.length],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white/3 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-[10px] mb-1">{k.toUpperCase()}</p>
                    <p className="text-white font-bold">{v}</p>
                  </div>
                ))}
              </div>

              <EnergyDistribution options={allOptions}/>

              {/* Events list by fixture */}
              <div className="space-y-3">
                <p className="text-gray-400 text-xs uppercase tracking-wider">All Events ({events.length})</p>
                {selectedFixtures.map(f => {
                  const fEvents = events.filter(e => e.fixture_id === String(f.id))
                  if (!fEvents.length) return null
                  return (
                    <div key={f.id} className="space-y-1.5">
                      <p className="text-gray-400 text-xs font-medium">{f.home} vs {f.away}</p>
                      {fEvents.map(ev => {
                        const meta = EVENT_TYPE_META[ev.event_type]
                        return (
                          <div key={ev.id} className="flex items-center gap-3 px-3 py-2 bg-white/3 rounded-xl">
                            <span>{meta.icon}</span>
                            <span className="text-gray-300 text-sm flex-1">
                              {meta.label}{ev.player_name ? ` · ${ev.player_name}` : ''}
                            </span>
                            <div className="flex gap-1.5">
                              {ev.options.map((o, i) => (
                                <span key={i} className="text-xs bg-white/5 rounded-lg px-2 py-0.5 text-gray-300">
                                  {o.label} <span className="text-indigo-400">⚡{o.energy_cost}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(2)}>← Back</ActionButton>
              <div className="flex gap-3">
                <ActionButton variant="secondary" onClick={handleSaveDraft} loading={saving}>
                  Save as Draft
                </ActionButton>
                <ActionButton variant="success" onClick={() => setConfirmPublish(true)} loading={saving}>
                  Publish Now 🚀
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
