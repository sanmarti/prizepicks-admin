import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getGameweeks, getGameweek } from '../../api/gameweeks'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'

export default function OddsReviewPage() {
  const { data: gameweeks } = useApi(getGameweeks)
  const [selectedId, setSelectedId] = useState('')
  const { data: gw } = useApi(
    () => selectedId ? getGameweek(selectedId) : Promise.resolve({ data: null }),
    [selectedId]
  )

  const publishedGws = (gameweeks ?? []).filter((g) => g.status === 'PUBLISHED' || g.status === 'LOCKED')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="">Select a published gameweek…</option>
          {publishedGws.map((g) => (
            <option key={g.id} value={g.id}>Week {g.week_number} — {g.league_name ?? g.competition}</option>
          ))}
        </select>
        {selectedId && <ActionButton variant="secondary">🔄 Recalculate Energy</ActionButton>}
      </div>

      {gw && (
        <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                {['Fixture', 'Type', 'Option', 'Energy Cost', 'Result', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(gw.events ?? []).flatMap((ev) =>
                (ev.options ?? []).map((opt) => (
                  <tr key={opt.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-gray-200">{ev.fixture_name}</td>
                    <td className="px-4 py-3"><span className="text-xs text-indigo-400">{ev.event_type?.replace('_',' ')}</span></td>
                    <td className="px-4 py-3 text-gray-300">{opt.label}</td>
                    <td className="px-4 py-3">
                      <span className="text-yellow-400 font-medium">⚡ {opt.energy_cost}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={opt.result}/></td>
                    <td className="px-4 py-3">
                      <ActionButton size="sm" variant="ghost">✏️ Override</ActionButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!selectedId && <div className="text-center py-20 text-gray-500">Select a gameweek to review odds</div>}
    </div>
  )
}
