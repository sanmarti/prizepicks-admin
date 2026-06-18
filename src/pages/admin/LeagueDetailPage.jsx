import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getLeague } from '../../api/leagues'
import StatusBadge from '../../components/admin/ui/StatusBadge'

const TABS = ['Standings', 'Members', 'Settings']

export default function LeagueDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Standings')
  const { data: league, loading } = useApi(() => getLeague(id), [id])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (!league) return <div className="text-center py-20 text-gray-400">League not found</div>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/leagues')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        ← Back to Leagues
      </button>

      {/* Header */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl">🏆</div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-white font-bold text-xl">{league.name}</h1>
            <StatusBadge status={league.status}/>
          </div>
          <p className="text-gray-400 text-sm">{league.competition} · Season {league.season}</p>
          <p className="text-gray-500 text-xs mt-1">Invite: <span className="font-mono text-indigo-400">{league.invite_code}</span></p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-white font-bold text-lg">€{league.prize_pool ?? 0}</p>
          <p className="text-gray-500 text-xs">prize pool</p>
          <p className="text-gray-400 text-sm">{league.member_count} / {league.max_teams} teams</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[#111520] border border-white/8 rounded-2xl p-6">
        {tab === 'Standings' && (
          <div className="space-y-2">
            {(league.standings ?? []).map((s, i) => (
              <div key={s.user_id ?? i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
                <span className="text-gray-500 w-6 text-sm text-right">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {s.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="flex-1 text-white text-sm">{s.display_name ?? 'Unknown'}</span>
                <span className="text-white font-bold text-sm">{s.points} pts</span>
                <span className="text-gray-500 text-xs">{s.wins}W {s.draws}D {s.losses}L</span>
                <span className="text-yellow-400 text-xs">⚡ {s.total_energy_used}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'Members' && (
          <div className="space-y-2">
            {(league.standings ?? []).map((m, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {m.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="flex-1 text-white text-sm">{m.display_name ?? 'Unknown'}</span>
                <StatusBadge status={'FREE'}/>
              </div>
            ))}
          </div>
        )}
        {tab === 'Settings' && (
          <div className="space-y-4 text-sm">
            {[
              ['Max Teams', league.max_teams],
              ['Entry Fee', `€${league.entry_fee}`],
              ['Missed Week Rule', league.missed_week_rule],
              ['Format', league.league_format],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
