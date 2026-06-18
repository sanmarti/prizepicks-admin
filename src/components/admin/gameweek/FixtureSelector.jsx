import { useState } from 'react'
import { getFixtures } from '../../../api/fixtures'
import ActionButton from '../ui/ActionButton'

export default function FixtureSelector({ selected, onSelect }) {
  const [leagueId, setLeagueId]   = useState('39')
  const [season, setSeason]       = useState('2025')
  const [round, setRound]         = useState('')
  const [fixtures, setFixtures]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleImport() {
    setLoading(true); setError('')
    try {
      const res = await getFixtures(leagueId, season, round || undefined)
      setFixtures(res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.error ?? 'Import failed')
    } finally { setLoading(false) }
  }

  function toggleFixture(fixture) {
    const exists = selected.find((f) => f.id === fixture.id)
    if (exists) {
      onSelect(selected.filter((f) => f.id !== fixture.id))
    } else {
      if (selected.length >= 6) return
      onSelect([...selected, fixture])
    }
  }

  const LEAGUES = [
    { id: '39',  name: 'EPL' },
    { id: '140', name: 'La Liga' },
    { id: '2',   name: 'Champions League' },
    { id: '135', name: 'Serie A' },
    { id: '1',   name: 'World Cup' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Competition</label>
          <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            {LEAGUES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Season</label>
          <select value={season} onChange={(e) => setSeason(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="2025">2025/26</option>
            <option value="2024">2024/25</option>
            <option value="2026">World Cup 2026</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Round (optional)</label>
          <input value={round} onChange={(e) => setRound(e.target.value)}
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {fixtures.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {fixtures.map((f) => {
            const isSelected = selected.some((s) => s.id === f.id)
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
