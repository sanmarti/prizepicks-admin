import { useState, useEffect } from 'react'
import { getFixtures } from '../../../api/fixtures'
import ActionButton from '../ui/ActionButton'

export default function FixtureSelector({ selected, onSelect, competition, competitions = [] }) {
  // Default to the step-0 competition; user can switch to any other imported one
  const [activeComp, setActiveComp] = useState(null)
  const [round, setRound]           = useState('')
  const [fixtures, setFixtures]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  // Sync when step-0 competition changes
  useEffect(() => {
    if (!competition) return
    setActiveComp(competition)
  }, [competition?.id])

  // Also set on first render if competitions loaded
  useEffect(() => {
    if (!activeComp && competitions.length > 0) {
      setActiveComp(competition ?? competitions[0])
    }
  }, [competitions.length])

  const leagueId = activeComp?.api_league_id
  const season   = activeComp?.api_season
  const planWarn = season && parseInt(season) >= 2025

  async function handleImport() {
    if (!leagueId || !season) return
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
      {competitions.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
          No competitions imported yet. Go to <strong>Competitions</strong> and import at least one before building a gameweek.
        </div>
      )}

      {planWarn && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
          Season {season} requires an <strong>API-Football paid plan</strong>. Available free: 2022, 2023, 2024.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Competition</label>
          <select
            value={activeComp?.id ?? ''}
            onChange={e => {
              const found = competitions.find(c => c.id === e.target.value)
              if (found) { setActiveComp(found); setFixtures([]) }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select competition…</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {activeComp && (
            <p className="text-[10px] text-gray-600 mt-1">
              League ID {activeComp.api_league_id} · Season {activeComp.api_season}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Round (optional)</label>
          <input
            value={round} onChange={e => setRound(e.target.value)}
            placeholder="e.g. 38" type="number"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ActionButton onClick={handleImport} loading={loading} disabled={!leagueId}>
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
