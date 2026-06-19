import { useState, useEffect } from 'react'
import { getFixtures } from '../../../api/fixtures'
import ActionButton from '../ui/ActionButton'

// Mapping competition name → API-Football league ID + season
const COMPETITION_API_MAP = {
  'FIFA World Cup 2026':              { leagueId: '1',   season: '2026' },
  'Premier League 2026/27':           { leagueId: '39',  season: '2026' },
  'La Liga 2026/27':                  { leagueId: '140', season: '2026' },
  'UEFA Champions League 2026/27':    { leagueId: '2',   season: '2026' },
  'Premier League 2025/26':           { leagueId: '39',  season: '2025' },
  'La Liga 2025/26':                  { leagueId: '140', season: '2025' },
  'UEFA Champions League 2025/26':    { leagueId: '2',   season: '2025' },
  'Premier League 2024/25':           { leagueId: '39',  season: '2024' },
  'La Liga 2024/25':                  { leagueId: '140', season: '2024' },
  'UEFA Champions League 2024/25':    { leagueId: '2',   season: '2024' },
}

const LEAGUES = [
  { id: '39',  name: 'Premier League' },
  { id: '140', name: 'La Liga' },
  { id: '2',   name: 'Champions League' },
  { id: '135', name: 'Serie A' },
  { id: '61',  name: 'Ligue 1' },
  { id: '1',   name: 'World Cup' },
]

const SEASONS = [
  { value: '2024', label: '2024/25 ✓ (free)' },
  { value: '2023', label: '2023/24 ✓ (free)' },
  { value: '2022', label: '2022/23 ✓ (free)' },
  { value: '2025', label: '2025/26 (paid plan)' },
  { value: '2026', label: '2026/27 (paid plan)' },
]

export default function FixtureSelector({ selected, onSelect, competition }) {
  const [leagueId, setLeagueId] = useState('39')
  const [season, setSeason]     = useState('2024')
  const [round, setRound]       = useState('')
  const [fixtures, setFixtures] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [planWarn, setPlanWarn] = useState(false)

  // Auto-fill from selected competition
  useEffect(() => {
    if (!competition) return
    const mapped = COMPETITION_API_MAP[competition.name]
    if (mapped) {
      setLeagueId(mapped.leagueId)
      setSeason(mapped.season)
      setPlanWarn(parseInt(mapped.season) >= 2025)
    }
  }, [competition?.id])

  async function handleImport() {
    setLoading(true); setError(''); setFixtures([])
    try {
      const res = await getFixtures(leagueId, season, round || undefined)
      setFixtures(res.data ?? [])
      if ((res.data ?? []).length === 0) setError('No fixtures found for this competition/season.')
    } catch (e) {
      setError(e.response?.data?.error ?? 'Import failed')
    } finally { setLoading(false) }
  }

  function toggleFixture(fixture) {
    const exists = selected.find(f => f.id === fixture.id)
    if (exists) {
      onSelect(selected.filter(f => f.id !== fixture.id))
    } else {
      if (selected.length >= 6) return
      onSelect([...selected, fixture])
    }
  }

  return (
    <div className="space-y-4">
      {planWarn && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
          ⚠ Season {season} requires an <strong>API-Football paid plan</strong>. Fixture import will fail on the Free plan.
          Available seasons on Free plan: 2022, 2023, 2024.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Competition</label>
          <select value={leagueId} onChange={e => setLeagueId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            {LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Season</label>
          <select value={season} onChange={e => { setSeason(e.target.value); setPlanWarn(parseInt(e.target.value) >= 2025) }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Round (optional)</label>
          <input value={round} onChange={e => setRound(e.target.value)}
            placeholder="e.g. 38" type="number"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ActionButton onClick={handleImport} loading={loading}>
          📥 Import from API-Football
        </ActionButton>
        <span className="text-sm text-gray-400">{selected.length} / 6 selected</span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {fixtures.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          <p className="text-xs text-gray-500">{fixtures.length} fixtures found — select up to 6</p>
          {fixtures.map(f => {
            const isSelected = selected.some(s => s.id === f.id)
            const isDisabled = !isSelected && selected.length >= 6
            return (
              <label key={f.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/3 hover:border-white/20'
              } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <input type="checkbox" checked={isSelected} disabled={isDisabled}
                  onChange={() => !isDisabled && toggleFixture(f)}
                  className="accent-indigo-500"/>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{f.home} vs {f.away}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {f.competition} · {f.round} · {f.date ? new Date(f.date).toLocaleString() : '—'}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
