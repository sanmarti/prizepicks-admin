import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getCompetitions, getCompetitionCalendar } from '../../api/competitions'
import ActionButton from '../../components/admin/ui/ActionButton'

function FixtureRow({ fixture }) {
  const date    = fixture.date ? new Date(fixture.date) : null
  const dateStr = date ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
  const timeStr = date ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''

  const finished = ['FT', 'AET', 'PEN'].includes(fixture.status)
  const live     = ['1H', '2H', 'HT', 'ET', 'P'].includes(fixture.status)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors rounded-xl">
      {/* Date */}
      <div className="w-24 text-right flex-shrink-0">
        <p className="text-xs text-gray-400">{dateStr}</p>
        <p className="text-[11px] text-gray-600">{timeStr}</p>
      </div>

      {/* Home */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {fixture.home_logo && (
          <img src={fixture.home_logo} alt="" className="w-5 h-5 object-contain"/>
        )}
        <span className="text-sm text-white text-right">{fixture.home}</span>
      </div>

      {/* Score / status */}
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

      {/* Away */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-white">{fixture.away}</span>
        {fixture.away_logo && (
          <img src={fixture.away_logo} alt="" className="w-5 h-5 object-contain"/>
        )}
      </div>

      {/* Venue */}
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

  // Derive a short display name: "Regular Season - 12" → "Matchday 12"
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
          {played > 0 && (
            <span className="text-xs text-indigo-400">{played}/{total} played</span>
          )}
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
  const [error, setError]       = useState('')
  const [filter, setFilter]     = useState('all') // 'all' | 'upcoming' | 'played'
  const [search, setSearch]     = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [compsRes, calRes] = await Promise.all([
          getCompetitions(),
          getCompetitionCalendar(id),
        ])
        const found = (compsRes.data ?? []).find(c => c.id === id)
        setComp(found ?? null)
        setCalendar(calRes.data)
      } catch (e) {
        setError(e.response?.data?.error ?? 'Failed to load calendar')
      } finally { setLoading(false) }
    }
    load()
  }, [id])

  const rounds = calendar?.rounds ?? []

  const filteredRounds = rounds
    .map(r => {
      let fixtures = r.fixtures
      if (filter === 'played')   fixtures = fixtures.filter(f => ['FT','AET','PEN'].includes(f.status))
      if (filter === 'upcoming') fixtures = fixtures.filter(f => !['FT','AET','PEN'].includes(f.status))
      if (search) {
        const q = search.toLowerCase()
        fixtures = fixtures.filter(f => f.home.toLowerCase().includes(q) || f.away.toLowerCase().includes(q))
      }
      return { ...r, fixtures }
    })
    .filter(r => r.fixtures.length > 0)

  // Open the first upcoming round by default
  const now = Date.now()
  const firstUpcomingIdx = rounds.findIndex(r =>
    r.fixtures.some(f => !['FT','AET','PEN'].includes(f.status) && new Date(f.date) > now)
  )

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">Loading calendar…</div>
  )

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/admin/competitions')}
          className="mt-1 text-gray-400 hover:text-white text-sm transition-colors">
          ← Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {comp?.logo_url && (
              <img src={comp.logo_url} alt="" className="w-9 h-9 object-contain"/>
            )}
            <div>
              <h1 className="text-white font-bold text-xl">{comp?.name ?? 'Competition'}</h1>
              {comp?.api_league_id && (
                <p className="text-gray-500 text-xs mt-0.5">
                  API-Football league #{comp.api_league_id} · Season {comp.api_season}
                </p>
              )}
            </div>
          </div>
        </div>
        {calendar && (
          <div className="text-right">
            <p className="text-white font-bold text-lg">{calendar.total_fixtures}</p>
            <p className="text-gray-500 text-xs">fixtures · {rounds.length} rounds</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      {rounds.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {[
              { key: 'all',      label: 'All rounds' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'played',   label: 'Played' },
            ].map(({ key, label }) => (
              <button key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search team…"
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-48"
          />
        </div>
      )}

      {/* Calendar */}
      {filteredRounds.length === 0 && !loading && !error && (
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
