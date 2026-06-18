import { useApi } from '../../hooks/useApi'
import { getUsers } from '../../api/users'
import { getLeagues } from '../../api/leagues'
import { getGameweeks } from '../../api/gameweeks'
import StatusBadge from '../../components/admin/ui/StatusBadge'

function KpiCard({ icon, label, value, sub, color = 'indigo' }) {
  const colors = { indigo: 'text-indigo-400', green: 'text-green-400', purple: 'text-purple-400', yellow: 'text-yellow-400' }
  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium ${colors[color]}`}>{sub}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  )
}

function fmt(n) { return n?.toLocaleString() ?? '—' }

export default function DashboardPage() {
  const { data: users }     = useApi(getUsers)
  const { data: leagues }   = useApi(getLeagues)
  const { data: gameweeks } = useApi(getGameweeks)

  const activeLeagues   = leagues?.filter((l) => l.status === 'ACTIVE') ?? []
  const publishedGws    = gameweeks?.filter((g) => g.status === 'PUBLISHED') ?? []
  const totalPrizePool  = activeLeagues.reduce((s, l) => s + parseFloat(l.prize_pool ?? 0), 0)
  const recentLeagues   = [...(leagues ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
  const upcomingLocks   = [...publishedGws].sort((a, b) => new Date(a.lock_time) - new Date(b.lock_time)).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="👥" label="Total Users"      value={fmt(users?.length)}       sub="all time"   color="indigo"/>
        <KpiCard icon="🏆" label="Active Leagues"   value={fmt(activeLeagues.length)} sub="this week"  color="green"/>
        <KpiCard icon="📅" label="Gameweeks Live"   value={fmt(publishedGws.length)}  sub="published"  color="purple"/>
        <KpiCard icon="💰" label="Prize Pool"       value={`€${totalPrizePool.toFixed(2)}`} sub="active" color="yellow"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leagues */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">Recent Leagues</h2>
          <div className="space-y-2">
            {recentLeagues.length === 0 && <p className="text-gray-500 text-sm">No leagues yet</p>}
            {recentLeagues.map((l) => (
              <div key={l.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{l.name}</p>
                  <p className="text-gray-500 text-xs">{l.competition} · {l.member_count ?? 0} members</p>
                </div>
                <StatusBadge status={l.status}/>
                <span className="text-gray-400 text-xs">€{l.prize_pool ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Locks */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">Upcoming Locks</h2>
          <div className="space-y-2">
            {upcomingLocks.length === 0 && <p className="text-gray-500 text-sm">No published gameweeks</p>}
            {upcomingLocks.map((g) => {
              const lock = new Date(g.lock_time)
              const diff = lock - Date.now()
              const hours = Math.floor(diff / 36e5)
              const mins  = Math.floor((diff % 36e5) / 6e4)
              const countdown = diff > 0 ? `${hours}h ${mins}m` : 'LOCKED'
              return (
                <div key={g.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">Week {g.week_number}</p>
                    <p className="text-gray-500 text-xs">{g.league_name ?? g.competition}</p>
                  </div>
                  <span className={`text-xs font-mono font-medium ${diff > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {countdown}
                  </span>
                  <StatusBadge status={g.status}/>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
