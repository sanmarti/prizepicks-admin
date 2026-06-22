import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  getCompetitions, getCompetitionCalendar, getCompetitionGameweeks,
  getCompetitionStandings, updateCompetition,
} from '../../api/competitions'
import { createGameweek, getGameweekDetail, updateGameweek, publishGameweek } from '../../api/gameweeks'
import { getOdds, getFixtureDetails } from '../../api/fixtures'
import { useToast } from '../../hooks/useToast'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

// ── tiny helpers ──────────────────────────────────────────────────────────────
const API_LEAGUES = [
  { id: '39',  name: 'Premier League' },
  { id: '140', name: 'La Liga' },
  { id: '2',   name: 'UEFA Champions League' },
  { id: '135', name: 'Serie A' },
  { id: '61',  name: 'Ligue 1' },
  { id: '78',  name: 'Bundesliga' },
  { id: '1',   name: 'FIFA World Cup' },
  { id: '4',   name: 'UEFA Euro' },
]
const API_SEASONS = ['2022', '2023', '2024', '2025', '2026']

const STATUS_GW = {
  DRAFT:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  PUBLISHED: 'bg-green-500/15 text-green-400 border-green-500/20',
  LOCKED:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  FINISHED:  'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

function Badge({ status, label }) {
  const cls = STATUS_GW[status] ?? STATUS_GW.DRAFT
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {label ?? status}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDT(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Calendar: event type icons ────────────────────────────────────────────────
const EVENT_ICONS = {
  Goal: '⚽', 'Own Goal': '🔴', 'Penalty': '⚽', 'Missed Penalty': '❌',
  'Yellow Card': '🟨', 'Red Card': '🟥', 'Yellow Red Card': '🟧',
  subst: '🔄', Var: '📺',
}

function FixtureEventLine({ ev }) {
  const icon = EVENT_ICONS[ev.detail] ?? EVENT_ICONS[ev.type] ?? '•'
  const isHome = false // determined by caller
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
      <span className="text-gray-500 w-6 text-right tabular-nums">{ev.elapsed}'</span>
      <span>{icon}</span>
      <span className="text-white">{ev.player}</span>
      {ev.assist && <span className="text-gray-600">({ev.assist})</span>}
      <span className="text-gray-600 ml-1">{ev.detail}</span>
    </div>
  )
}

function StatBar({ label, homeVal, awayVal }) {
  const h = parseFloat(homeVal) || 0
  const a = parseFloat(awayVal) || 0
  const total = h + a || 1
  const homePct = Math.round((h / total) * 100)
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-white font-medium w-10 tabular-nums">{homeVal ?? '—'}</span>
        <span className="text-gray-500 flex-1 text-center truncate px-2">{label}</span>
        <span className="text-white font-medium w-10 text-right tabular-nums">{awayVal ?? '—'}</span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden bg-white/5">
        <div className="bg-indigo-500 rounded-full" style={{ width: `${homePct}%` }}/>
        <div className="bg-orange-400 rounded-full flex-1"/>
      </div>
    </div>
  )
}

// ── Calendar: fixture row ─────────────────────────────────────────────────────
function FixtureRow({ fixture }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailTab, setDetailTab] = useState('events')

  const date = fixture.date ? new Date(fixture.date) : null
  const dateStr = date ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
  const timeStr = date ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
  const finished = ['FT', 'AET', 'PEN'].includes(fixture.status_short)
  const live     = ['1H', '2H', 'HT', 'ET', 'P'].includes(fixture.status_short)

  async function handleToggle() {
    if (!open && !details && finished) {
      setLoadingDetails(true)
      try {
        const res = await getFixtureDetails(fixture.id)
        setDetails(res.data)
      } catch { /* no details available */ }
      finally { setLoadingDetails(false) }
    }
    setOpen(o => !o)
  }

  const homeEvents = details?.events?.filter(e => e.team === fixture.home) ?? []
  const awayEvents = details?.events?.filter(e => e.team === fixture.away) ?? []
  const homeStats  = details?.statistics?.find(t => t.team === fixture.home)?.stats ?? []
  const awayStats  = details?.statistics?.find(t => t.team === fixture.away)?.stats ?? []
  const homeLineup = details?.lineups?.find(t => t.team === fixture.home)
  const awayLineup = details?.lineups?.find(t => t.team === fixture.away)

  return (
    <div>
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${finished ? 'cursor-pointer hover:bg-white/3' : ''}`}
        onClick={finished ? handleToggle : undefined}
      >
        <div className="w-24 text-right flex-shrink-0">
          <p className="text-xs text-gray-400">{dateStr}</p>
          <p className="text-[11px] text-gray-600">{timeStr}</p>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          {fixture.home_logo && <img src={fixture.home_logo} alt="" className="w-5 h-5 object-contain"/>}
          <span className={`text-sm text-right truncate max-w-[140px] ${fixture.home_winner ? 'text-white font-semibold' : 'text-gray-300'}`}>{fixture.home}</span>
        </div>
        <div className="w-20 text-center flex-shrink-0">
          {finished ? (
            <div>
              <span className="text-sm font-bold text-white tabular-nums">{fixture.home_goals ?? 0} — {fixture.away_goals ?? 0}</span>
              {fixture.ht_home != null && (
                <p className="text-[10px] text-gray-600">HT {fixture.ht_home}–{fixture.ht_away}</p>
              )}
              {fixture.pen_home != null && (
                <p className="text-[10px] text-orange-400">PSO {fixture.pen_home}–{fixture.pen_away}</p>
              )}
            </div>
          ) : live ? (
            <div>
              <span className="text-xs font-semibold text-green-400 animate-pulse">LIVE</span>
              {fixture.status_elapsed && <p className="text-[10px] text-green-600">{fixture.status_elapsed}'</p>}
            </div>
          ) : (
            <span className="text-xs text-gray-600">vs</span>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-sm truncate max-w-[140px] ${fixture.away_winner ? 'text-white font-semibold' : 'text-gray-300'}`}>{fixture.away}</span>
          {fixture.away_logo && <img src={fixture.away_logo} alt="" className="w-5 h-5 object-contain"/>}
        </div>
        <div className="w-36 text-right flex-shrink-0 hidden lg:block">
          {fixture.venue_name && <p className="text-[11px] text-gray-600 truncate">{fixture.venue_name}{fixture.venue_city ? `, ${fixture.venue_city}` : ''}</p>}
          {fixture.referee && <p className="text-[10px] text-gray-700 truncate">{fixture.referee}</p>}
        </div>
        {finished && (
          <span className="text-gray-600 text-xs ml-1">{open ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Expanded details panel */}
      {open && (
        <div className="border-t border-white/5 bg-white/2 px-4 py-3">
          {loadingDetails ? (
            <p className="text-xs text-gray-500 text-center py-2">Loading details…</p>
          ) : !details ? (
            <p className="text-xs text-gray-600 text-center py-2">No details available</p>
          ) : (
            <>
              {/* Sub-tabs */}
              <div className="flex gap-1 mb-3">
                {['events', 'stats', 'lineups'].map(t => (
                  <button key={t}
                    onClick={() => setDetailTab(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${detailTab === t ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                  >{t}</button>
                ))}
              </div>

              {/* Events */}
              {detailTab === 'events' && (
                details.events.length === 0
                ? <p className="text-xs text-gray-600 text-center py-2">No events recorded</p>
                : <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                    <div className="space-y-0.5">
                      {homeEvents.map((e, i) => <FixtureEventLine key={i} ev={e}/>)}
                    </div>
                    <div className="space-y-0.5">
                      {awayEvents.map((e, i) => <FixtureEventLine key={i} ev={e}/>)}
                    </div>
                  </div>
              )}

              {/* Stats */}
              {detailTab === 'stats' && (
                homeStats.length === 0
                ? <p className="text-xs text-gray-600 text-center py-2">No statistics available</p>
                : <div className="space-y-2 max-w-md mx-auto">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1 px-1">
                      <span className="text-indigo-400 font-medium">{fixture.home}</span>
                      <span className="text-orange-400 font-medium">{fixture.away}</span>
                    </div>
                    {homeStats.map((s, i) => (
                      <StatBar
                        key={i}
                        label={s.type}
                        homeVal={s.value}
                        awayVal={awayStats[i]?.value}
                      />
                    ))}
                  </div>
              )}

              {/* Lineups */}
              {detailTab === 'lineups' && (
                !homeLineup
                ? <p className="text-xs text-gray-600 text-center py-2">No lineup data available</p>
                : <div className="grid grid-cols-2 gap-6">
                    {[homeLineup, awayLineup].filter(Boolean).map((t, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2 mb-2">
                          {t.team_logo && <img src={t.team_logo} alt="" className="w-4 h-4 object-contain"/>}
                          <span className="text-xs font-semibold text-white">{t.team}</span>
                          {t.formation && <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{t.formation}</span>}
                        </div>
                        {t.coach && <p className="text-[10px] text-gray-600 mb-1.5">Coach: {t.coach}</p>}
                        <div className="space-y-0.5">
                          {t.startXI.map((p, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-gray-600 w-4 text-right">{p.number}</span>
                              <span className="text-white">{p.name}</span>
                              <span className="text-gray-600">{p.pos}</span>
                            </div>
                          ))}
                        </div>
                        {t.substitutes.length > 0 && (
                          <>
                            <p className="text-[10px] text-gray-600 mt-2 mb-1">Bench</p>
                            <div className="space-y-0.5">
                              {t.substitutes.map((p, j) => (
                                <div key={j} className="flex items-center gap-1.5 text-[11px] opacity-60">
                                  <span className="text-gray-600 w-4 text-right">{p.number}</span>
                                  <span className="text-gray-400">{p.name}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Calendar: round section ───────────────────────────────────────────────────
function RoundSection({ round, defaultOpen, onBuildGameweek, gameweeks }) {
  const [open, setOpen] = useState(defaultOpen)
  const played = round.fixtures.filter(f => ['FT', 'AET', 'PEN'].includes(f.status_short)).length
  const displayName = round.name.replace(/^Regular Season\s*-\s*/i, 'Matchday ')
  const hasGameweek = gameweeks?.some(gw => gw.round_name === round.name)

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
      <div className="flex items-center px-5 py-3.5 hover:bg-white/3 transition-colors">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-3 text-left">
          <span className="text-white font-semibold text-sm">{displayName}</span>
          <span className="text-xs text-gray-500">{round.fixtures.length} matches</span>
          {played > 0 && <span className="text-xs text-indigo-400">{played}/{round.fixtures.length} played</span>}
          {hasGameweek && <Badge status="PUBLISHED" label="Gameweek created" />}
          <span className={`text-gray-400 text-xs ml-auto transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        <button
          onClick={() => onBuildGameweek(round)}
          className="ml-3 flex-shrink-0 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs rounded-xl hover:bg-indigo-600/40 transition-colors font-medium"
        >
          + Build Gameweek
        </button>
      </div>
      {open && (
        <div className="border-t border-white/8 divide-y divide-white/4">
          {round.fixtures.map(f => <FixtureRow key={f.id} fixture={f} />)}
        </div>
      )}
    </div>
  )
}

// ── Gameweek list ─────────────────────────────────────────────────────────────
function GameweekList({ gameweeks, loading, onPublish, onEdit }) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading gameweeks…</div>
  if (!gameweeks?.length) return (
    <div className="text-center py-16">
      <p className="text-gray-400 text-base mb-1">No gameweeks yet</p>
      <p className="text-gray-600 text-sm">Go to the Calendar tab and click "Build Gameweek" on a round.</p>
    </div>
  )
  return (
    <div className="space-y-3">
      {gameweeks.map(gw => (
        <div key={gw.id} className="bg-[#111520] border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
            {gw.week_number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-white font-medium text-sm">Week {gw.week_number}</span>
              <Badge status={gw.status} />
            </div>
            <p className="text-gray-500 text-xs">
              Lock: {fmtDT(gw.lock_time)} · {gw.event_count} events · {gw.matchup_count} matchups
            </p>
          </div>
          {gw.status === 'DRAFT' && (
            <div className="flex gap-2">
              <ActionButton size="sm" variant="secondary" onClick={() => onEdit(gw)}>
                ✏️ Edit
              </ActionButton>
              <ActionButton size="sm" onClick={() => onPublish(gw)}>
                🚀 Publish
              </ActionButton>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Inline gameweek builder ───────────────────────────────────────────────────
const EVENT_TYPE_META = {
  MATCH_RESULT: { icon: '⚽', label: 'Match Result' },
  GOALS:        { icon: '📊', label: 'Goals O/U' },
  PLAYER_SCORE: { icon: '👤', label: 'Player Goal' },
  CLEAN_SHEET:  { icon: '🛡', label: 'Clean Sheet' },
}
const THRESHOLDS = ['1.5', '2.5', '3.5', '4.5']

function probToEnergyCost(p) {
  if (p <= 0.1) return 1; if (p <= 0.2) return 2; if (p <= 0.3) return 3
  if (p <= 0.4) return 4; if (p <= 0.5) return 5; if (p <= 0.6) return 6
  if (p <= 0.7) return 7; if (p <= 0.8) return 8; if (p <= 0.9) return 9
  return null
}

function OddsPanel({ fixture, odds, onAddEvent }) {
  if (!odds) return null
  const mw = odds.match_winner ?? []
  const ou = odds.goals_ou ?? []

  return (
    <div className="mt-3 space-y-3 pl-2">
      {/* Match Result */}
      {mw.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-gray-500 font-medium">MATCH RESULT</p>
            <button
              onClick={() => onAddEvent('MATCH_RESULT', mw.filter(o => o.energy_cost).map(o => ({ label: o.label, energy_cost: o.energy_cost })))}
              className="text-[10px] text-indigo-400 hover:text-indigo-300"
            >+ Add event</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {mw.map(o => (
              <div key={o.label} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
                <span className="text-white text-xs font-medium">{o.label}</span>
                <span className="text-gray-500 text-[10px]">{o.odd}x</span>
                {o.energy_cost && (
                  <span className="text-yellow-400 text-[10px] font-bold">⚡{o.energy_cost}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals O/U */}
      {THRESHOLDS.map(threshold => {
        const over  = ou.find(o => o.label === `Over ${threshold}`)
        const under = ou.find(o => o.label === `Under ${threshold}`)
        if (!over && !under) return null
        return (
          <div key={threshold}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-gray-500 font-medium">GOALS {threshold}</p>
              <button
                onClick={() => {
                  const opts = [over, under].filter(Boolean).map(o => ({ label: o.label, energy_cost: o.energy_cost }))
                  onAddEvent('GOALS', opts)
                }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >+ Add event</button>
            </div>
            <div className="flex gap-2">
              {[over, under].filter(Boolean).map(o => (
                <div key={o.label} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
                  <span className="text-white text-xs">{o.label}</span>
                  <span className="text-gray-500 text-[10px]">{o.odd}x</span>
                  {o.energy_cost && <span className="text-yellow-400 text-[10px] font-bold">⚡{o.energy_cost}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {mw.length === 0 && ou.length === 0 && (
        <p className="text-gray-600 text-xs">No odds available for this fixture.</p>
      )}
    </div>
  )
}

function FixtureEventPanel({ fixture, odds, events, onAdd, onRemove, onUpdateEnergy, onUpdateLabel, onToggleOpen, isOpen }) {
  const fixtureEvents = events.filter(e => e.fixture_id === String(fixture.id))

  function addEvent(type, options) {
    onAdd(String(fixture.id), type, options, { fixture_name: `${fixture.home} vs ${fixture.away}`, match_time: fixture.date, competition: fixture.competition })
  }

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-medium">{fixture.home} vs {fixture.away}</span>
          <span className="text-gray-500 text-xs">{fixture.date ? new Date(fixture.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
          {fixtureEvents.length > 0 && (
            <span className="text-indigo-400 text-xs">{fixtureEvents.length} event{fixtureEvents.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="border-t border-white/8 px-4 py-3 space-y-4">
          {/* Odds */}
          {odds?.loading
            ? <p className="text-gray-500 text-xs">Loading odds…</p>
            : <OddsPanel fixture={fixture} odds={odds} onAddEvent={(type, opts) => addEvent(type, opts)} />
          }

          {/* Manual add buttons */}
          <div className="flex gap-2 flex-wrap pt-1">
            {Object.entries(EVENT_TYPE_META).map(([type, meta]) => {
              function defaultOptions() {
                if (type === 'MATCH_RESULT') return [
                  { label: `${fixture.home} Win`, energy_cost: 5 },
                  { label: 'Draw', energy_cost: 3 },
                  { label: `${fixture.away} Win`, energy_cost: 5 },
                ]
                if (type === 'GOALS') return [
                  { label: 'Over 2.5', energy_cost: 5 },
                  { label: 'Under 2.5', energy_cost: 5 },
                ]
                if (type === 'CLEAN_SHEET') return [
                  { label: fixture.home, energy_cost: 5 },
                  { label: fixture.away, energy_cost: 5 },
                ]
                if (type === 'PLAYER_SCORE') return [
                  { label: `${fixture.home} scorer`, energy_cost: 5 },
                  { label: `${fixture.away} scorer`, energy_cost: 5 },
                ]
                return [{ label: 'Option 1', energy_cost: 5 }, { label: 'Option 2', energy_cost: 5 }]
              }
              return (
                <button key={type} onClick={() => addEvent(type, defaultOptions())}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  {meta.icon} {meta.label}
                </button>
              )
            })}
          </div>

          {/* Created events */}
          {fixtureEvents.length > 0 && (
            <div className="space-y-2 pt-1">
              {fixtureEvents.map(ev => (
                <div key={ev.id} className="bg-white/3 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-300 font-medium">
                      {EVENT_TYPE_META[ev.event_type]?.icon} {EVENT_TYPE_META[ev.event_type]?.label}
                    </span>
                    <button onClick={() => onRemove(ev.id)} className="text-red-400/60 hover:text-red-300 text-xs">✕</button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {ev.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                        <input
                          type="text" value={opt.label}
                          onChange={e => onUpdateLabel(ev.id, idx, e.target.value)}
                          className="bg-transparent text-white text-xs focus:outline-none min-w-0 w-32 border-b border-transparent focus:border-white/30"
                        />
                        <input
                          type="number" min={1} max={9} value={opt.energy_cost ?? ''}
                          onChange={e => onUpdateEnergy(ev.id, idx, parseInt(e.target.value) || null)}
                          className="w-8 bg-transparent border border-white/20 rounded text-yellow-400 text-xs text-center focus:outline-none focus:border-yellow-400"
                        />
                        <span className="text-yellow-400 text-[10px]">⚡</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GameweekBuilder({ competitionId, round, onDone, onCancel, nextWeekNumber, allRounds, existingId }) {
  const { toasts, toast } = useToast()
  const isEdit = !!existingId

  const [weekNumber, setWeekNumber] = useState(String(nextWeekNumber))
  const [lockTime, setLockTime]     = useState('')
  const [revealTime, setRevealTime] = useState('')
  const [step, setStep]             = useState(0)
  const [saving, setSaving]         = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const [confirmPublish, setConfirmPublish] = useState(false)

  const isCustom = !round?.fixtures?.length
  const [selectedFixtures, setSelectedFixtures] = useState(round?.fixtures ?? [])
  const [pickerRound, setPickerRound] = useState(null)

  // Load existing gameweek data when editing
  useEffect(() => {
    if (!existingId) return
    setLoadingEdit(true)
    getGameweekDetail(existingId).then(res => {
      const gw = res.data
      setWeekNumber(String(gw.week_number))
      setLockTime(gw.lock_time ? gw.lock_time.slice(0, 16) : '')
      setRevealTime(gw.reveal_time ? gw.reveal_time.slice(0, 16) : '')

      // Reconstruct fixture list from events (deduplicated)
      const fixtureMap = {}
      for (const ev of gw.events) {
        if (!fixtureMap[ev.fixture_id]) {
          fixtureMap[ev.fixture_id] = {
            id: parseInt(ev.fixture_id), date: ev.match_time,
            home: ev.fixture_name?.split(' vs ')?.[0] ?? ev.fixture_name,
            away: ev.fixture_name?.split(' vs ')?.[1] ?? '',
            home_logo: null, away_logo: null,
          }
        }
      }
      setSelectedFixtures(Object.values(fixtureMap))

      // Pre-populate events
      setEvents(gw.events.map(ev => ({
        id: `${ev.fixture_id}-${ev.event_type}-${ev.id}`,
        fixture_id: ev.fixture_id,
        event_type: ev.event_type,
        fixture_name: ev.fixture_name,
        match_time: ev.match_time,
        competition: ev.competition,
        options: ev.options,
      })))
    }).catch(() => toast('Failed to load gameweek', 'error'))
    .finally(() => setLoadingEdit(false))
  }, [existingId])
  const [events, setEvents]                     = useState([])
  const [oddsMap, setOddsMap]                   = useState({})
  const [openFixtures, setOpenFixtures]         = useState([])

  // Load odds when entering step 1 (events)
  useEffect(() => {
    if (step !== 1) return
    if (selectedFixtures.length > 0) setOpenFixtures([String(selectedFixtures[0].id)])
    selectedFixtures.forEach(f => {
      const fid = String(f.id)
      if (oddsMap[fid]) return
      setOddsMap(prev => ({ ...prev, [fid]: { loading: true } }))
      getOdds(fid)
        .then(res => setOddsMap(prev => ({ ...prev, [fid]: { loading: false, ...res.data } })))
        .catch(() => setOddsMap(prev => ({ ...prev, [fid]: { loading: false, match_winner: [], goals_ou: [] } })))
    })
  }, [step])

  function addEvent(fixtureId, type, options, extra = {}) {
    setEvents(prev => [...prev, { id: `${fixtureId}-${type}-${Date.now()}`, fixture_id: fixtureId, event_type: type, options, ...extra }])
  }
  function removeEvent(id) { setEvents(prev => prev.filter(e => e.id !== id)) }
  function updateEnergy(eventId, optIdx, cost) {
    setEvents(prev => prev.map(e => e.id !== eventId ? e : {
      ...e, options: e.options.map((o, i) => i === optIdx ? { ...o, energy_cost: cost } : o)
    }))
  }
  function updateLabel(eventId, optIdx, label) {
    setEvents(prev => prev.map(e => e.id !== eventId ? e : {
      ...e, options: e.options.map((o, i) => i === optIdx ? { ...o, label } : o)
    }))
  }
  function toggleFixture(fid) {
    setOpenFixtures(prev => prev.includes(fid) ? prev.filter(x => x !== fid) : [...prev, fid])
  }

  function quickFill() {
    selectedFixtures.forEach(f => {
      const fid = String(f.id)
      const odds = oddsMap[fid]
      const existing = events.filter(e => e.fixture_id === fid)
      if (!existing.some(e => e.event_type === 'MATCH_RESULT')) {
        const mw = (odds?.match_winner ?? []).filter(o => o.energy_cost)
        addEvent(fid, 'MATCH_RESULT',
          mw.length ? mw.map(o => ({ label: o.label, energy_cost: o.energy_cost }))
                    : [{ label: 'Home Win', energy_cost: 6 }, { label: 'Draw', energy_cost: 3 }, { label: 'Away Win', energy_cost: 2 }],
          { fixture_name: `${f.home} vs ${f.away}`, match_time: f.date, competition: f.competition }
        )
      }
      if (!existing.some(e => e.event_type === 'GOALS' && e.options[0]?.label?.includes('2.5'))) {
        const ou = odds?.goals_ou ?? []
        const over = ou.find(o => o.label === 'Over 2.5'); const under = ou.find(o => o.label === 'Under 2.5')
        addEvent(fid, 'GOALS',
          [{ label: 'Over 2.5', energy_cost: over?.energy_cost ?? 5 }, { label: 'Under 2.5', energy_cost: under?.energy_cost ?? 5 }],
          { fixture_name: `${f.home} vs ${f.away}`, match_time: f.date, competition: f.competition }
        )
      }
    })
  }

  function buildPayload() {
    return {
      competition_id: competitionId,
      week_number: parseInt(weekNumber),
      lock_time: lockTime,
      reveal_time: revealTime || lockTime,
      events: events.map(e => ({
        event_type: e.event_type, fixture_id: String(e.fixture_id),
        fixture_name: e.fixture_name, match_time: e.match_time, competition: e.competition,
        options: e.options.filter(o => o.energy_cost).map(o => ({ label: o.label, energy_cost: o.energy_cost })),
      })).filter(e => e.options.length > 0),
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      if (isEdit) {
        await updateGameweek(existingId, buildPayload())
        toast('Gameweek updated ✓', 'success')
      } else {
        await createGameweek(buildPayload())
        toast('Gameweek saved as draft ✓', 'success')
      }
      onDone()
    } catch (e) { toast(e.response?.data?.error ?? 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  async function handlePublish() {
    setConfirmPublish(false)
    setSaving(true)
    try {
      let gwId = existingId
      if (!gwId) {
        const { data } = await createGameweek(buildPayload())
        gwId = data.gameweekId
      } else {
        await updateGameweek(existingId, buildPayload())
      }
      await publishGameweek(gwId)
      toast(`Week ${weekNumber} published! 🚀`, 'success')
      onDone()
    } catch (e) { toast(e.response?.data?.error ?? 'Publish failed', 'error') }
    finally { setSaving(false) }
  }

  const canStep1 = weekNumber && lockTime && selectedFixtures.length > 0
  const displayRoundName = round?.name?.replace(/^Regular Season\s*-\s*/i, 'Matchday ') ?? 'Custom'

  return (
    <>
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        open={confirmPublish}
        title="Publish Gameweek?"
        message={`Publish Week ${weekNumber} (${displayRoundName}) for this competition? Matchups will be generated for all active leagues.`}
        confirmLabel="Publish 🚀"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />

      {loadingEdit && (
        <div className="text-center py-20 text-gray-400 text-sm">Loading gameweek…</div>
      )}
      {!loadingEdit && <div className="bg-[#111520] border border-indigo-500/30 rounded-2xl overflow-hidden">
        {/* Builder header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-white font-semibold">
              {isEdit ? `Editing: Week ${weekNumber}` : `Building: ${displayRoundName}`}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">{selectedFixtures.length} fixtures</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-white text-sm transition-colors">✕ Cancel</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 0: basic info */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Week Number</label>
                  <input type="number" min={1} value={weekNumber} onChange={e => setWeekNumber(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Lock Time</label>
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

              {/* Fixture selection */}
              {isCustom ? (
                <div className="space-y-3">
                  {(allRounds ?? []).length === 0 ? (
                    <p className="text-gray-500 text-xs">No calendar loaded. Configure the API-Football mapping in the Calendar tab first.</p>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Select Matchday</label>
                        <select
                          value={pickerRound?.name ?? ''}
                          onChange={e => {
                            const r = (allRounds ?? []).find(r => r.name === e.target.value) ?? null
                            setPickerRound(r)
                            if (r) setSelectedFixtures(r.fixtures)
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">— Choose a matchday —</option>
                          {(allRounds ?? []).map(r => (
                            <option key={r.name} value={r.name}>
                              {r.name.replace(/^Regular Season\s*-\s*/i, 'Matchday ')} ({r.fixtures.length} matches)
                            </option>
                          ))}
                        </select>
                      </div>

                      {pickerRound && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-gray-400">{selectedFixtures.length} of {pickerRound.fixtures.length} selected</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setSelectedFixtures(pickerRound.fixtures)}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300">Select all</button>
                              <button type="button" onClick={() => setSelectedFixtures([])}
                                className="text-[11px] text-gray-500 hover:text-gray-300">Clear</button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                            {pickerRound.fixtures.map(f => {
                              const checked = selectedFixtures.some(s => s.id === f.id)
                              return (
                                <label key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/8 bg-white/3 cursor-pointer hover:border-white/20 transition-colors">
                                  <input type="checkbox" checked={checked} className="accent-indigo-500 flex-shrink-0"
                                    onChange={() => setSelectedFixtures(prev =>
                                      checked ? prev.filter(s => s.id !== f.id) : [...prev, f]
                                    )}/>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {f.home_logo && <img src={f.home_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0"/>}
                                    <span className="text-sm text-white truncate">{f.home}</span>
                                    <span className="text-xs text-gray-600">vs</span>
                                    <span className="text-sm text-white truncate">{f.away}</span>
                                    {f.away_logo && <img src={f.away_logo} alt="" className="w-4 h-4 object-contain flex-shrink-0"/>}
                                  </div>
                                  <span className="text-xs text-gray-500 flex-shrink-0">{f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Fixtures included — click to deselect:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedFixtures.map(f => (
                      <label key={f.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-white/10 bg-white/3 cursor-pointer hover:border-white/20">
                        <input type="checkbox" checked className="accent-indigo-500"
                          onChange={() => setSelectedFixtures(prev => prev.filter(x => x.id !== f.id))}/>
                        <span className="text-sm text-white">{f.home} vs {f.away}</span>
                        <span className="text-xs text-gray-500 ml-auto">{f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!canStep1 && (
                <p className="text-xs text-gray-500 text-right">
                  Missing:{' '}
                  <span className="text-yellow-400">
                    {[!weekNumber && 'Week Number', !lockTime && 'Lock Time', selectedFixtures.length === 0 && 'Fixtures'].filter(Boolean).join(', ')}
                  </span>
                </p>
              )}
              <div className="flex justify-end">
                <ActionButton onClick={() => setStep(1)} disabled={!canStep1}>
                  Build Events →
                </ActionButton>
              </div>
            </div>
          )}

          {/* Step 1: events */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ActionButton variant="secondary" onClick={quickFill} size="sm">
                  ⚡ Quick Fill — Match Result + Goals 2.5
                </ActionButton>
                {events.length > 0 && (
                  <button onClick={() => setEvents([])} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
                )}
                <span className="ml-auto text-xs text-gray-500">{events.length} events</span>
              </div>

              {selectedFixtures.map(f => (
                <FixtureEventPanel
                  key={f.id}
                  fixture={f}
                  odds={oddsMap[String(f.id)]}
                  events={events}
                  onAdd={addEvent}
                  onRemove={removeEvent}
                  onUpdateEnergy={updateEnergy}
                  onUpdateLabel={updateLabel}
                  isOpen={openFixtures.includes(String(f.id))}
                  onToggleOpen={() => toggleFixture(String(f.id))}
                />
              ))}

              <div className="flex justify-between">
                <ActionButton variant="secondary" onClick={() => setStep(0)}>← Back</ActionButton>
                <div className="flex gap-2">
                  <ActionButton variant="secondary" onClick={handleSaveDraft} loading={saving} disabled={events.length === 0}>
                    Save Draft
                  </ActionButton>
                  <ActionButton onClick={() => setConfirmPublish(true)} loading={saving} disabled={events.length === 0}>
                    🚀 Publish
                  </ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = ['Calendar', 'Standings', 'Gameweeks', 'Edit']

const FORM_COLORS = { W: 'bg-green-500', D: 'bg-gray-500', L: 'bg-red-500' }

function StandingsTable({ groups }) {
  if (!groups?.length) return (
    <div className="text-center py-16 text-gray-500 text-sm">No standings available</div>
  )
  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi} className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
          {groups.length > 1 && group.name && (
            <div className="px-4 py-3 border-b border-white/8">
              <span className="text-white font-semibold text-sm">{group.name}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-600 border-b border-white/5">
                  <th className="px-4 py-2.5 text-left w-8">#</th>
                  <th className="px-2 py-2.5 text-left">Team</th>
                  <th className="px-2 py-2.5 text-center w-8">P</th>
                  <th className="px-2 py-2.5 text-center w-8">W</th>
                  <th className="px-2 py-2.5 text-center w-8">D</th>
                  <th className="px-2 py-2.5 text-center w-8">L</th>
                  <th className="px-2 py-2.5 text-center w-10">GF</th>
                  <th className="px-2 py-2.5 text-center w-10">GA</th>
                  <th className="px-2 py-2.5 text-center w-10">GD</th>
                  <th className="px-2 py-2.5 text-center w-10 font-bold text-gray-400">Pts</th>
                  <th className="px-4 py-2.5 text-right hidden sm:table-cell">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {group.rows.map((row, i) => {
                  const descLower = row.description?.toLowerCase() ?? ''
                  const highlight =
                    descLower.includes('champions league') ? 'border-l-2 border-blue-500' :
                    descLower.includes('europa league')    ? 'border-l-2 border-orange-500' :
                    descLower.includes('relegation')       ? 'border-l-2 border-red-500' : ''
                  return (
                    <tr key={i} className={`hover:bg-white/3 transition-colors ${highlight}`}>
                      <td className="px-4 py-2.5 text-gray-500 tabular-nums">{row.rank}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          {row.team_logo && <img src={row.team_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                          <span className="text-white font-medium truncate max-w-[140px]">{row.team}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">{row.played}</td>
                      <td className="px-2 py-2.5 text-center text-green-400 tabular-nums">{row.win}</td>
                      <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">{row.draw}</td>
                      <td className="px-2 py-2.5 text-center text-red-400 tabular-nums">{row.lose}</td>
                      <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">{row.gf}</td>
                      <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">{row.ga}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">
                        <span className={row.gd > 0 ? 'text-green-400' : row.gd < 0 ? 'text-red-400' : 'text-gray-500'}>
                          {row.gd > 0 ? '+' : ''}{row.gd}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center font-bold text-white tabular-nums">{row.points}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {row.form && (
                          <div className="flex gap-0.5 justify-end">
                            {row.form.split('').map((r, j) => (
                              <span key={j} className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold text-white ${FORM_COLORS[r] ?? 'bg-gray-700'}`}>
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function EditForm({ comp, onSaved }) {
  const [form, setForm] = useState({
    name:          comp?.name          ?? '',
    description:   comp?.description   ?? '',
    logo_url:      comp?.logo_url      ?? '',
    cover_url:     comp?.cover_url     ?? '',
    start_date:    comp?.start_date?.split('T')[0] ?? '',
    end_date:      comp?.end_date?.split('T')[0]   ?? '',
    num_weeks:     comp?.num_weeks     ?? '',
    api_league_id: comp?.api_league_id ?? '',
    api_season:    comp?.api_season    ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }
  const isValid = form.name && form.start_date && form.end_date && form.num_weeks

  async function handleSave() {
    setSaving(true)
    try {
      await updateCompetition(comp.id, form)
      setSaved(true)
      onSaved(form)
    } catch { /* error handled by caller */ }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
      {/* Logo + cover preview */}
      {(form.logo_url || form.cover_url) && (
        <div className="flex items-center gap-4 p-4 bg-white/3 rounded-xl border border-white/8">
          {form.logo_url && (
            <img src={form.logo_url} alt="" className="w-12 h-12 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }} onError={e => e.target.style.display='none'}/>
          )}
          {form.cover_url && (
            <img src={form.cover_url} alt="" className="h-12 w-24 object-cover rounded-lg opacity-60"
              onError={e => e.target.style.display='none'}/>
          )}
          {!form.logo_url && !form.cover_url && null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Competition Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Start Date *</label>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            style={{ colorScheme: 'dark' }}/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">End Date *</label>
          <input type="date" value={form.end_date} min={form.start_date} onChange={e => set('end_date', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            style={{ colorScheme: 'dark' }}/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Number of Weeks *</label>
          <input type="number" min={1} max={52} value={form.num_weeks} onChange={e => set('num_weeks', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Logo URL</label>
          <input value={form.logo_url} onChange={e => set('logo_url', e.target.value)}
            placeholder="https://… (square image)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Cover URL</label>
          <input value={form.cover_url} onChange={e => set('cover_url', e.target.value)}
            placeholder="https://… (wide banner image)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div className="col-span-2 border-t border-white/8 pt-4">
          <p className="text-xs text-gray-500 mb-3">API-Football mapping — required for the match calendar</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">League</label>
              <select value={form.api_league_id} onChange={e => set('api_league_id', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">— not set —</option>
                {API_LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name} (#{l.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Season</label>
              <select value={form.api_season} onChange={e => set('api_season', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">— not set —</option>
                {API_SEASONS.map(s => (
                  <option key={s} value={s}>{s}/{parseInt(s)+1-2000} {parseInt(s)<=2024?'✓ free':'(paid)'}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end pt-2">
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
        <ActionButton onClick={handleSave} loading={saving} disabled={!isValid}>
          Save Changes
        </ActionButton>
      </div>
    </div>
  )
}

export default function CompetitionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  const [comp, setComp]           = useState(null)
  const [calendar, setCalendar]     = useState(null)
  const [standings, setStandings]   = useState(null)
  const [gameweeks, setGameweeks]   = useState([])
  const [tab, setTab]               = useState(0)
  const [loading, setLoading]       = useState(true)
  const [calLoading, setCalLoading]   = useState(false)
  const [standLoading, setStandLoading] = useState(false)
  const [gwLoading, setGwLoading]   = useState(false)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')

  // Builder state
  const [builderRound, setBuilderRound] = useState(null)
  const [editingGameweekId, setEditingGameweekId] = useState(null)

  // API mapping config
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason]     = useState('')
  const [savingCfg, setSavingCfg] = useState(false)

  // Publish confirm
  const [publishTarget, setPublishTarget] = useState(null)

  const loadComp = useCallback(async () => {
    try {
      const res = await getCompetitions()
      const found = (res.data ?? []).find(c => c.id === id)
      setComp(found ?? null)
      if (found?.api_league_id) setLeagueId(found.api_league_id)
      if (found?.api_season)    setSeason(found.api_season)
      return found
    } catch { setError('Failed to load competition') }
  }, [id])

  const loadCalendar = useCallback(async () => {
    setCalLoading(true); setError('')
    try {
      const res = await getCompetitionCalendar(id)
      setCalendar(res.data)
    } catch (e) { setError(e.response?.data?.error ?? 'Failed to load calendar') }
    finally { setCalLoading(false) }
  }, [id])

  const loadStandings = useCallback(async () => {
    setStandLoading(true)
    try {
      const res = await getCompetitionStandings(id)
      setStandings(res.data)
    } catch { /* noop */ }
    finally { setStandLoading(false) }
  }, [id])

  const loadGameweeks = useCallback(async () => {
    setGwLoading(true)
    try {
      const res = await getCompetitionGameweeks(id)
      setGameweeks(res.data ?? [])
    } catch { /* noop */ }
    finally { setGwLoading(false) }
  }, [id])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const found = await loadComp()
      if (found?.api_league_id && found?.api_season) {
        await Promise.all([loadCalendar(), loadStandings()])
      }
      await loadGameweeks()
      setLoading(false)
    }
    init()
  }, [id])

  async function handleSaveApiConfig() {
    if (!leagueId || !season) return
    setSavingCfg(true)
    try {
      await updateCompetition(id, { api_league_id: leagueId, api_season: season })
      setComp(c => ({ ...c, api_league_id: leagueId, api_season: season }))
      await Promise.all([loadCalendar(), loadStandings()])
    } catch (e) { setError(e.response?.data?.error ?? 'Save failed') }
    finally { setSavingCfg(false) }
  }

  async function handlePublish(gw) {
    try {
      await publishGameweek(gw.id)
      toast(`Week ${gw.week_number} published! 🚀`, 'success')
      setPublishTarget(null)
      await loadGameweeks()
    } catch (e) { toast(e.response?.data?.error ?? 'Publish failed', 'error') }
  }

  const isConfigured = comp?.api_league_id && comp?.api_season
  const rounds = calendar?.rounds ?? []
  const now = Date.now()

  const filteredRounds = rounds.map(r => {
    let fx = r.fixtures
    if (filter === 'played')   fx = fx.filter(f => ['FT','AET','PEN'].includes(f.status_short))
    if (filter === 'upcoming') fx = fx.filter(f => !['FT','AET','PEN'].includes(f.status_short))
    if (search) { const q = search.toLowerCase(); fx = fx.filter(f => f.home.toLowerCase().includes(q) || f.away.toLowerCase().includes(q)) }
    return { ...r, fixtures: fx }
  }).filter(r => r.fixtures.length > 0)

  const firstUpcomingIdx = rounds.findIndex(r =>
    r.fixtures.some(f => !['FT','AET','PEN'].includes(f.status_short) && new Date(f.date) > now)
  )

  const nextWeekNumber = (gameweeks.length > 0 ? Math.max(...gameweeks.map(g => g.week_number)) + 1 : 1)

  if (loading) return <div className="flex items-center justify-center py-32 text-gray-400">Loading…</div>

  return (
    <>
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        open={!!publishTarget}
        title={`Publish Week ${publishTarget?.week_number}?`}
        message="Matchups will be generated for all active leagues in this competition."
        confirmLabel="Publish 🚀"
        onConfirm={() => handlePublish(publishTarget)}
        onCancel={() => setPublishTarget(null)}
      />

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/admin/competitions')}
            className="mt-1 text-gray-400 hover:text-white text-sm transition-colors flex-shrink-0">
            ← Back
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {comp?.logo_url && <img src={comp.logo_url} alt="" className="w-9 h-9 object-contain"/>}
              <div>
                <h1 className="text-white font-bold text-xl">{comp?.name ?? 'Competition'}</h1>
                <p className="text-gray-500 text-xs mt-0.5">
                  {fmtDate(comp?.start_date)} → {fmtDate(comp?.end_date)} · {comp?.num_weeks} weeks
                </p>
              </div>
            </div>
          </div>
          {calendar && (
            <div className="text-right flex-shrink-0">
              <p className="text-white font-bold text-lg">{calendar.total_fixtures}</p>
              <p className="text-gray-500 text-xs">fixtures · {rounds.length} rounds</p>
            </div>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

        {/* Builder — shown full-width when active, replaces tab content */}
        {(builderRound || editingGameweekId) ? (
          <GameweekBuilder
            competitionId={id}
            round={builderRound ?? { name: '', fixtures: [] }}
            nextWeekNumber={nextWeekNumber}
            allRounds={rounds}
            existingId={editingGameweekId}
            onDone={async () => { setBuilderRound(null); setEditingGameweekId(null); await loadGameweeks(); setTab(2) }}
            onCancel={() => { setBuilderRound(null); setEditingGameweekId(null) }}
          />
        ) : (
          <>
            {/* Tabs — always visible */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
              {TABS.map((t, i) => (
                <button key={t} onClick={() => setTab(i)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === i ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>
                  {t}
                  {i === 2 && gameweeks.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{gameweeks.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Calendar tab */}
            {tab === 0 && (
              <div className="space-y-4">
                {/* Setup form if not configured */}
                {!isConfigured && (
                  <div className="bg-[#111520] border border-indigo-500/20 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-white font-semibold text-base">Configure API-Football mapping</h2>
                      <p className="text-gray-400 text-sm mt-1">Select the league and season to load the match calendar.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">League</label>
                        <select value={leagueId} onChange={e => setLeagueId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                          <option value="">Select league…</option>
                          {API_LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Season</label>
                        <select value={season} onChange={e => setSeason(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                          <option value="">Select season…</option>
                          {API_SEASONS.map(s => <option key={s} value={s}>{s}/{String(parseInt(s)+1).slice(-2)} {parseInt(s)<=2024?'✓ free':'(paid)'}</option>)}
                        </select>
                      </div>
                    </div>
                    {parseInt(season) >= 2025 && season && (
                      <p className="text-yellow-400 text-xs">⚠ Season {season} requires a paid API-Football plan.</p>
                    )}
                    <ActionButton onClick={handleSaveApiConfig} loading={savingCfg} disabled={!leagueId || !season}>
                      Save & Load Calendar
                    </ActionButton>
                  </div>
                )}

                {/* Calendar filters */}
                {isConfigured && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                      {[{ key: 'all', label: 'All' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'played', label: 'Played' }].map(({ key, label }) => (
                        <button key={key} onClick={() => setFilter(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team…"
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-44"/>
                    <button onClick={loadCalendar} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">↻ Refresh</button>
                  </div>
                )}

                {calLoading && <div className="text-center py-16 text-gray-400 text-sm">Loading fixtures…</div>}

                {isConfigured && !calLoading && (
                  <div className="space-y-3">
                    {filteredRounds.map((round, i) => (
                      <RoundSection
                        key={round.name}
                        round={round}
                        gameweeks={gameweeks}
                        defaultOpen={i === firstUpcomingIdx || (firstUpcomingIdx === -1 && i === 0)}
                        onBuildGameweek={r => { setBuilderRound(r); window.scrollTo(0, 0) }}
                      />
                    ))}
                    {filteredRounds.length === 0 && <div className="text-center py-16 text-gray-500 text-sm">No matches found</div>}
                  </div>
                )}
              </div>
            )}

            {/* Standings tab */}
            {tab === 1 && (
              <div>
                {!isConfigured ? (
                  <div className="text-center py-16 text-gray-500 text-sm">Configure API-Football mapping in the Calendar tab first.</div>
                ) : standLoading ? (
                  <div className="text-center py-16 text-gray-400 text-sm">Loading standings…</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button onClick={loadStandings} className="text-xs text-gray-500 hover:text-white transition-colors">↻ Refresh</button>
                    </div>
                    <StandingsTable groups={standings?.groups ?? []}/>
                  </div>
                )}
              </div>
            )}

            {/* Gameweeks tab */}
            {tab === 2 && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <ActionButton onClick={() => setBuilderRound({ name: 'Custom Gameweek', fixtures: [] })}>
                    + New Gameweek
                  </ActionButton>
                </div>
                <GameweekList
                  gameweeks={gameweeks}
                  loading={gwLoading}
                  onPublish={setPublishTarget}
                  onEdit={gw => { setEditingGameweekId(gw.id); window.scrollTo(0, 0) }}
                />
              </div>
            )}

            {/* Edit tab */}
            {tab === 3 && comp && (
              <EditForm
                comp={comp}
                onSaved={updates => setComp(c => ({ ...c, ...updates }))}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
