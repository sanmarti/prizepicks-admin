import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getCompetitions, getCompetitionCalendar, updateCompetition } from '../../api/competitions'
import ActionButton from '../../components/admin/ui/ActionButton'

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

function FixtureRow({ fixture }) {
  const date    = fixture.date ? new Date(fixture.date) : null
  const dateStr = date ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
  const timeStr = date ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''

  const finished = ['FT', 'AET', 'PEN'].includes(fixture.status)
  const live     = ['1H', '2H', 'HT', 'ET', 'P'].includes(fixture.status)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors rounded-xl">
      <div className="w-24 text-right flex-shrink-0">
        <p className="text-xs text-gray-400">{dateStr}</p>
        <p className="text-[11px] text-gray-600">{timeStr}</p>
      </div>
      <div className="flex-1 flex items-center justify-end gap-2">
        {fixture.home_logo && <img src={fixture.home_logo} alt="" className="w-5 h-5 object-contain"/>}
        <span className="text-sm text-white text-right">{fixture.home}</span>
      </div>
      <div className="w-16 text-center flex-shrink-0">
        {finished ? (
          <span className="text-sm font-bold text-white tabular-nums">
            {fixture.home_goals ?? 0} — {fixture.away_goals ?? 0}
          </span>
        ) : live ? (
          <span className="text-xs font-semibold text-green-400 animate-pulse">LIVE</span>
        ) : (
          <span className="text-xs text-gray-600">vs</span>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-white">{fixture.away}</span>
        {fixture.away_logo && <img src={fixture.away_logo} alt="" className="w-5 h-5 object-contain"/>}
      </div>
      <div className="w-36 text-right flex-shrink-0 hidden lg:block">
        {fixture.venue && <p className="text-[11px] text-gray-600 truncate">{fixture.venue}</p>}
      </div>
    </div>
  )
}

function RoundSection({ round, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const played  = round.fixtures.filter(f => ['FT', 'AET', 'PEN'].includes(f.status)).length
  const total   = round.fixtures.length
  const displayName = round.name.replace(/^Regular Season\s*-\s*/i, 'Matchday ')

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">{displayName}</span>
          <span className="text-xs text-gray-500">{total} matches</span>
          {played > 0 && <span className="text-xs text-indigo-400">{played}/{total} played</span>}
        </div>
        <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="border-t border-white/8 divide-y divide-white/4">
          {round.fixtures.map(f => <FixtureRow key={f.id} fixture={f}/>)}
        </div>
      )}
    </div>
  )
}

export default function CompetitionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [comp, setComp]         = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [calLoading, setCalLoading] = useState(false)
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')

  // Inline API mapping setup
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason]     = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    async function loadComp() {
      setLoading(true)
      try {
        const res = await getCompetitions()
        const found = (res.data ?? []).find(c => c.id === id)
        setComp(found ?? null)
        if (found?.api_league_id) setLeagueId(found.api_league_id)
        if (found?.api_season)    setSeason(found.api_season)
        // If already configured, load calendar immediately
        if (found?.api_league_id && found?.api_season) {
          await loadCalendar()
        }
      } catch {
        setError('Failed to load competition')
      } finally { setLoading(false) }
    }
    loadComp()
  }, [id])

  async function loadCalendar() {
    setCalLoading(true)
    setError('')
    try {
      const res = await getCompetitionCalendar(id)
      setCalendar(res.data)
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to load calendar')
    } finally { setCalLoading(false) }
  }

  async function handleSaveAndLoad() {
    if (!leagueId || !season) return
    setSaving(true)
    try {
      await updateCompetition(id, { api_league_id: leagueId, api_season: season })
      setComp(c => ({ ...c, api_league_id: leagueId, api_season: season }))
      await loadCalendar()
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const rounds = calendar?.rounds ?? []
  const now    = Date.now()

  const filteredRounds = rounds
    .map(r => {
      let fixtures = r.fixtures
      if (filter === 'played')   fixtures = fixtures.filter(f => ['FT','AET','PEN'].includes(f.status))
      if (filter === 'upcoming') fixtures = fixtures.filter(f => !['FT','AET','PEN'].includes(f.status))
      if (search) {
        const q = search.toLowerCase()
        fixtures = fixtures.filter(f =>
          f.home.toLowerCase().includes(q) || f.away.toLowerCase().includes(q)
        )
      }
      return { ...r, fixtures }
    })
    .filter(r => r.fixtures.length > 0)

  const firstUpcomingIdx = rounds.findIndex(r =>
    r.fixtures.some(f => !['FT','AET','PEN'].includes(f.status) && new Date(f.date) > now)
  )

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">Loading…</div>
  )

  const isConfigured = comp?.api_league_id && comp?.api_season

  return (
    <div className="space-y-6">
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
              {isConfigured && (
                <p className="text-gray-500 text-xs mt-0.5">
                  {API_LEAGUES.find(l => l.id === comp.api_league_id)?.name ?? `League #${comp.api_league_id}`} · Season {comp.api_season}
                </p>
              )}
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

      {/* Setup panel — shown when API mapping not configured */}
      {!isConfigured && !calendar && (
        <div className="bg-[#111520] border border-indigo-500/30 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-base">Configure API-Football mapping</h2>
            <p className="text-gray-400 text-sm mt-1">
              Select the API-Football league and season to load the match calendar.
            </p>
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
                {API_SEASONS.map(s => (
                  <option key={s} value={s}>
                    {s}/{String(parseInt(s) + 1).slice(-2)} {parseInt(s) <= 2024 ? '✓ free' : '(paid)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {parseInt(season) >= 2025 && season && (
            <p className="text-yellow-400 text-xs">
              ⚠ Season {season} requires an API-Football paid plan. Free plan covers 2022–2024.
            </p>
          )}
          <ActionButton
            onClick={handleSaveAndLoad}
            loading={saving || calLoading}
            disabled={!leagueId || !season}
          >
            Save & Load Calendar
          </ActionButton>
        </div>
      )}

      {/* Reconfigure link when already configured */}
      {isConfigured && calendar && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {[
              { key: 'all',      label: 'All rounds' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'played',   label: 'Played' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search team…"
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-48"
          />
          <button onClick={loadCalendar}
            className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">
            ↻ Refresh
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {calLoading && (
        <div className="text-center py-20 text-gray-400 text-sm">Loading fixtures…</div>
      )}

      {!calLoading && filteredRounds.length === 0 && calendar && (
        <div className="text-center py-20 text-gray-500 text-sm">No matches found</div>
      )}

      <div className="space-y-3">
        {filteredRounds.map((round, i) => (
          <RoundSection
            key={round.name}
            round={round}
            defaultOpen={i === firstUpcomingIdx || (firstUpcomingIdx === -1 && i === 0)}
          />
        ))}
      </div>
    </div>
  )
}
