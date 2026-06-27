import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getUserDetail, getUsers, adjustEnergy, banUser } from '../../api/users'
import { useToast } from '../../hooks/useToast'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const TABS = ['Overview', 'Sprint History', 'Matchweek History', 'Division History', 'Energy', 'Actions']

const OUTCOME_CFG = {
  promoted:  { label: '⬆ Promoted',  color: 'text-green-400',  bg: 'bg-green-900/30 border-green-500/30' },
  retained:  { label: '= Retained',  color: 'text-gray-400',   bg: 'bg-white/5 border-white/10' },
  relegated: { label: '⬇ Relegated', color: 'text-red-400',    bg: 'bg-red-900/30 border-red-500/30' },
  rookie:    { label: '🌱 Rookie',    color: 'text-indigo-400', bg: 'bg-indigo-900/30 border-indigo-500/30' },
  pending:   { label: '🔴 Live',      color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/20' },
}

const TIERS = [
  {
    min: 90, label: 'Gold Predictor', icon: '🥇',
    gradient: 'bg-gradient-to-br from-yellow-950 via-amber-900/40 to-[#111520]',
    border: 'border-yellow-500/40',
    glow: 'shadow-[0_0_30px_-6px_rgba(250,204,21,0.5)]',
    textColor: 'text-yellow-400',
    barColor: 'bg-gradient-to-r from-yellow-500 to-amber-300',
    desc: '90%+ accuracy',
  },
  {
    min: 80, label: 'Silver Predictor', icon: '🥈',
    gradient: 'bg-gradient-to-br from-slate-800 via-slate-700/40 to-[#111520]',
    border: 'border-slate-400/40',
    glow: 'shadow-[0_0_30px_-6px_rgba(148,163,184,0.5)]',
    textColor: 'text-slate-300',
    barColor: 'bg-gradient-to-r from-slate-400 to-slate-200',
    desc: '80%+ accuracy',
  },
  {
    min: 70, label: 'Bronze Predictor', icon: '🥉',
    gradient: 'bg-gradient-to-br from-orange-950 via-orange-900/40 to-[#111520]',
    border: 'border-orange-500/40',
    glow: 'shadow-[0_0_30px_-6px_rgba(249,115,22,0.5)]',
    textColor: 'text-orange-400',
    barColor: 'bg-gradient-to-r from-orange-500 to-amber-400',
    desc: '70%+ accuracy',
  },
]
function getAccuracyTier(pct) {
  if (!pct || pct < 70) return null
  return TIERS.find(t => pct >= t.min) ?? null
}

function StatCard({ label, value, icon, gradient, glow, border, textColor, sub }) {
  return (
    <div className={`relative rounded-xl overflow-hidden border ${gradient} ${glow} ${border}`}>
      <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl opacity-30 bg-white pointer-events-none" />
      <div className="relative p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-lg">{icon}</span>
        </div>
        <p className={`font-black text-2xl leading-none mb-1 ${textColor}`}>{value ?? '—'}</p>
        <p className="text-white/40 text-[11px] font-medium">{label}</p>
        {sub && <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AccuracyBar({ pct }) {
  const tier     = getAccuracyTier(pct)
  const hasValue = pct !== null && pct !== undefined
  const color    = !hasValue ? 'text-white/30'
    : tier ? tier.textColor
    : pct >= 60 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'
  const barClass = tier ? tier.barColor
    : pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className={`relative rounded-xl overflow-hidden border p-4 ${
      tier ? `${tier.gradient} ${tier.border} ${tier.glow}` : 'bg-white/4 border-white/8'
    }`}>
      {tier && <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl opacity-30 bg-white pointer-events-none" />}
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-lg">🎯</span>
          {tier && <span className="text-lg">{tier.icon}</span>}
        </div>
        <p className={`font-black text-2xl leading-none mb-1.5 ${color}`}>
          {hasValue ? `${pct}%` : '—'}
        </p>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
          <div className={`h-full rounded-full transition-all ${barClass}`}
            style={{ width: hasValue ? `${pct}%` : '0%' }} />
        </div>
        <p className="text-white/40 text-[11px] font-medium">
          {tier ? tier.label : 'Global accuracy'}
        </p>
      </div>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toasts, toast } = useToast()
  const [tab, setTab] = useState('Overview')
  const [energyAmount, setEnergyAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Try the rich detail endpoint first; fall back to list entry if not yet deployed
  const { data: detail, loading: loadingDetail } = useApi(() => getUserDetail(id).catch(() => null), [id])
  const { data: userList, loading: loadingList }  = useApi(() => detail ? Promise.resolve(null) : getUsers(), [detail])

  const loading = loadingDetail || loadingList
  const refetch = () => window.location.reload()

  // Merge: rich detail takes priority, otherwise synthesise from list entry
  const listUser = userList?.find(u => u.id === id)
  const user = detail ?? (listUser ? {
    ...listUser,
    stats: {
      sprints_played:    listUser.sprints_played    ?? 0,
      matchweeks_played: listUser.matchweeks_played ?? 0,
      total_correct:     listUser.total_correct     ?? 0,
      total_incorrect:   listUser.total_incorrect   ?? 0,
      accuracy_pct:      listUser.accuracy_pct      ?? null,
    },
    current_division:  listUser.current_division ?? null,
    sprint_history:    [],
    division_history:  [],
    matchweek_history: [],
  } : null)

  async function handleAdjustEnergy() {
    if (!energyAmount) return
    setActionLoading(true)
    try {
      await adjustEnergy(id, parseInt(energyAmount), 'Admin adjustment')
      toast('Energy adjusted')
      setEnergyAmount('')
      refetch()
    } catch { toast('Failed', 'error') }
    finally { setActionLoading(false) }
  }

  async function handleBan() {
    setActionLoading(true)
    try {
      await banUser(id)
      toast('User banned')
      refetch()
    } catch { toast('Failed', 'error') }
    finally { setActionLoading(false) }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (!user)   return <div className="text-center py-20 text-gray-400">User not found</div>

  const { stats, current_division, sprint_history, division_history, matchweek_history = [] } = user

  const lifetimeLP      = sprint_history.reduce((s, r) => s + (r.total_league_points ?? 0), 0)
  const totalPerfect    = sprint_history.reduce((s, r) => s + (r.perfect_weeks ?? 0), 0)
  const tier            = getAccuracyTier(stats.accuracy_pct)

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="space-y-6">

        <button onClick={() => navigate('/admin/users')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
          ← Back to Users
        </button>

        {/* Header */}
        <div className={`border rounded-2xl p-6 overflow-hidden relative transition-all ${
          tier ? `${tier.gradient} ${tier.border} ${tier.glow}` : 'bg-[#111520] border-white/8'
        }`}>
          {tier && <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-20 bg-white pointer-events-none" />}
          <div className="relative">
            <div className="flex items-start gap-5 flex-wrap">
              {/* Avatar */}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ${
                tier ? 'bg-white/10 border-2' : 'bg-indigo-600'
              }`} style={tier ? { borderColor: tier.border.replace('border-','').replace('/40',''), boxShadow: `0 0 18px -4px currentColor` } : {}}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : user.email?.[0]?.toUpperCase()
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-white font-bold text-xl">{user.display_name ?? 'No name'}</h1>
                  <StatusBadge status={user.role}/>
                  {current_division && (
                    <span className="text-sm text-gray-300 bg-white/6 border border-white/10 px-2.5 py-0.5 rounded-full">
                      {current_division.icon} {current_division.name}
                      {current_division.is_rookie && <span className="ml-1 text-indigo-400 text-[10px] font-bold">ROOKIE</span>}
                    </span>
                  )}
                  {tier && (
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${tier.border} ${tier.textColor}`}
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {tier.icon} {tier.label}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Member since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-yellow-400 text-2xl font-bold">⚡ {user.energy_balance ?? 0}</p>
                <p className="text-gray-500 text-xs">energy balance</p>
              </div>
            </div>

            {/* Stat cards — same style as ProfilePage */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              <StatCard
                label="League Points"
                value={lifetimeLP}
                icon="🏆"
                gradient="bg-gradient-to-br from-indigo-950 to-[#111520]"
                border="border-indigo-500/30"
                glow="shadow-[0_0_20px_-6px_rgba(99,102,241,0.4)]"
                textColor="text-indigo-400"
              />
              <StatCard
                label="Correct picks"
                value={stats.total_correct}
                icon="✅"
                gradient="bg-gradient-to-br from-green-950 to-[#111520]"
                border="border-green-500/30"
                glow="shadow-[0_0_20px_-6px_rgba(34,197,94,0.35)]"
                textColor="text-green-400"
              />
              <StatCard
                label="Wrong picks"
                value={stats.total_incorrect}
                icon="❌"
                gradient="bg-gradient-to-br from-red-950 to-[#111520]"
                border="border-red-500/20"
                glow=""
                textColor="text-red-400"
              />
              <StatCard
                label="Perfect weeks"
                value={totalPerfect}
                icon="⭐"
                gradient="bg-gradient-to-br from-yellow-950 to-[#111520]"
                border="border-yellow-500/25"
                glow="shadow-[0_0_20px_-6px_rgba(234,179,8,0.3)]"
                textColor="text-yellow-400"
              />
              <StatCard
                label="Sprints played"
                value={stats.sprints_played}
                icon="🏃"
                gradient="bg-gradient-to-br from-violet-950 to-[#111520]"
                border="border-violet-500/25"
                glow=""
                textColor="text-violet-400"
              />
              <AccuracyBar pct={stats.accuracy_pct} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/3 rounded-xl p-1 w-fit flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="bg-[#111520] border border-white/8 rounded-2xl p-6">

          {/* ── OVERVIEW ─────────────────────────────────────── */}
          {tab === 'Overview' && (
            <div className="space-y-6">

              {/* Accuracy tier card */}
              {tier ? (
                <div className={`relative rounded-xl overflow-hidden border p-5 ${tier.gradient} ${tier.border} ${tier.glow}`}>
                  <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl opacity-20 bg-white pointer-events-none" />
                  <div className="relative flex items-center gap-4">
                    <span className="text-5xl">{tier.icon}</span>
                    <div>
                      <p className={`text-xl font-black ${tier.textColor}`}>{tier.label}</p>
                      <p className="text-white/50 text-sm mt-0.5">{tier.desc} · {stats.accuracy_pct}% global accuracy</p>
                      <div className="w-48 h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${tier.barColor}`} style={{ width: `${stats.accuracy_pct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/4 border border-white/8 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-2xl text-gray-600">🎯</span>
                  <div>
                    <p className="text-gray-400 text-sm font-semibold">No predictor tier yet</p>
                    <p className="text-gray-600 text-xs">Reach 70%+ accuracy to earn a tier · current: {stats.accuracy_pct !== null ? `${stats.accuracy_pct}%` : 'no picks yet'}</p>
                  </div>
                </div>
              )}

              {/* Activity summary */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-3">Activity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                    <p className="text-gray-500 text-xs mb-1">Current division</p>
                    <p className="text-white text-sm font-semibold">{current_division ? `${current_division.icon} ${current_division.name}` : '—'}</p>
                    {current_division?.is_rookie && <p className="text-indigo-400 text-[10px] font-bold mt-0.5">ROOKIE</p>}
                  </div>
                  <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                    <p className="text-gray-500 text-xs mb-1">Matchweeks played</p>
                    <p className="text-white text-sm font-bold">{stats.matchweeks_played}</p>
                  </div>
                  <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                    <p className="text-gray-500 text-xs mb-1">Total picks</p>
                    <p className="text-white text-sm font-bold">{stats.total_correct + stats.total_incorrect}</p>
                    <p className="text-gray-600 text-[10px]"><span className="text-green-400">{stats.total_correct}✓</span> · <span className="text-red-400">{stats.total_incorrect}✗</span></p>
                  </div>
                  <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                    <p className="text-gray-500 text-xs mb-1">Lifetime LP</p>
                    <p className="text-indigo-400 text-sm font-bold">{lifetimeLP}</p>
                  </div>
                </div>
              </div>

              {/* Last sprint */}
              {sprint_history.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">Last sprint</h3>
                  {(() => {
                    const s = sprint_history[0]
                    const oc = OUTCOME_CFG[s.sprint_outcome] ?? OUTCOME_CFG.pending
                    const total = (s.total_correct_picks ?? 0) + (s.total_incorrect_picks ?? 0)
                    const acc = total > 0 ? Math.round((s.total_correct_picks / total) * 100) : null
                    return (
                      <div className={`border rounded-xl p-4 ${oc.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white font-semibold">{s.sprint_name}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${oc.bg} ${oc.color}`}>{oc.label}</span>
                        </div>
                        <p className="text-gray-500 text-xs mb-3">{s.division_icon} {s.division_name} · {new Date(s.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(s.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <div className="grid grid-cols-5 gap-2 text-center">
                          <div><p className="text-indigo-400 font-black text-lg">{s.total_league_points}</p><p className="text-gray-600 text-[10px]">LP</p></div>
                          <div><p className="text-green-400 font-black text-lg">{s.total_correct_picks}</p><p className="text-gray-600 text-[10px]">Correct</p></div>
                          <div><p className="text-red-400 font-black text-lg">{s.total_incorrect_picks}</p><p className="text-gray-600 text-[10px]">Wrong</p></div>
                          <div><p className="text-yellow-400 font-black text-lg">{s.perfect_weeks ?? 0}⭐</p><p className="text-gray-600 text-[10px]">Perfect</p></div>
                          <div><p className="text-white font-black text-lg">{acc !== null ? `${acc}%` : '—'}</p><p className="text-gray-600 text-[10px]">Accuracy</p></div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── SPRINT HISTORY ───────────────────────────────── */}
          {tab === 'Sprint History' && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-sm mb-4">All sprints ({sprint_history.length})</h3>
              {sprint_history.length === 0 && <p className="text-gray-500 text-sm">No sprints played yet.</p>}
              {sprint_history.map((s) => {
                const oc = OUTCOME_CFG[s.sprint_outcome] ?? OUTCOME_CFG.pending
                const total = (s.total_correct_picks ?? 0) + (s.total_incorrect_picks ?? 0)
                const acc = total > 0 ? Math.round((s.total_correct_picks / total) * 100) : null
                return (
                  <div key={s.sprint_id} className="border border-white/8 rounded-xl p-4 bg-white/2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-white font-semibold text-sm">{s.sprint_name}</p>
                        <p className="text-gray-500 text-xs">{s.division_icon} {s.division_name} · {new Date(s.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(s.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${oc.bg} ${oc.color}`}>{oc.label}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center mt-3 pt-3 border-t border-white/5">
                      <div><p className="text-indigo-400 font-bold text-base">{s.total_league_points}</p><p className="text-gray-600 text-[10px]">LP</p></div>
                      <div><p className="text-white font-bold text-base">{s.gameweeks_participated}/4</p><p className="text-gray-600 text-[10px]">Weeks</p></div>
                      <div><p className="text-green-400 font-bold text-base">{s.total_correct_picks}</p><p className="text-gray-600 text-[10px]">Correct</p></div>
                      <div><p className="text-red-400 font-bold text-base">{s.total_incorrect_picks}</p><p className="text-gray-600 text-[10px]">Wrong</p></div>
                      <div><p className="text-white font-bold text-base">{acc !== null ? `${acc}%` : '—'}</p><p className="text-gray-600 text-[10px]">Acc.</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── MATCHWEEK HISTORY ────────────────────────────── */}
          {tab === 'Matchweek History' && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-sm mb-4">Matchweek history ({matchweek_history.length})</h3>
              {matchweek_history.length === 0 && <p className="text-gray-500 text-sm">No matchweeks played yet.</p>}
              {matchweek_history.map((mw) => {
                const total = (mw.correct_picks ?? 0) + (mw.incorrect_picks ?? 0)
                const acc = total > 0 ? Math.round((mw.correct_picks / total) * 100) : null
                const isCompleted = mw.status === 'completed'
                const statusCfg = {
                  completed:  { label: 'Settled',   color: 'text-green-400',  bg: 'bg-green-900/20 border-green-500/25' },
                  settling:   { label: 'Settling',  color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/20' },
                  locked:     { label: 'Locked',    color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-500/20' },
                  open:       { label: 'Open',      color: 'text-gray-400',   bg: 'bg-white/4 border-white/8' },
                  void:       { label: 'Void',      color: 'text-gray-600',   bg: 'bg-white/2 border-white/5' },
                }[mw.status] ?? { label: mw.status, color: 'text-gray-400', bg: 'bg-white/4 border-white/8' }

                return (
                  <div key={mw.id} className={`border rounded-xl p-4 ${statusCfg.bg}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div>
                        <p className="text-white font-semibold text-sm">
                          {mw.sprint_name ?? '—'} · Week {mw.sprint_week ?? '?'}
                          {mw.is_perfect_week && <span className="ml-2 text-yellow-400 text-xs font-bold">⭐ Perfect</span>}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {mw.lock_time ? new Date(mw.lock_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center pt-3 border-t border-white/5">
                      <div>
                        <p className="text-indigo-400 font-bold text-base">{isCompleted ? (mw.league_points ?? 0) : '—'}</p>
                        <p className="text-gray-600 text-[10px]">LP</p>
                      </div>
                      <div>
                        <p className="text-white font-bold text-base">{mw.picks_submitted ?? 0}/6</p>
                        <p className="text-gray-600 text-[10px]">Picks</p>
                      </div>
                      <div>
                        <p className="text-green-400 font-bold text-base">{isCompleted ? (mw.correct_picks ?? 0) : '—'}</p>
                        <p className="text-gray-600 text-[10px]">Correct</p>
                      </div>
                      <div>
                        <p className="text-red-400 font-bold text-base">{isCompleted ? (mw.incorrect_picks ?? 0) : '—'}</p>
                        <p className="text-gray-600 text-[10px]">Wrong</p>
                      </div>
                      <div>
                        <p className="text-white font-bold text-base">{acc !== null ? `${acc}%` : '—'}</p>
                        <p className="text-gray-600 text-[10px]">Acc.</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── DIVISION HISTORY ─────────────────────────────── */}
          {tab === 'Division History' && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-4">Division history</h3>
              {division_history.length === 0 && <p className="text-gray-500 text-sm">No division changes yet.</p>}
              <div className="relative">
                {division_history.map((h, i) => {
                  const oc = OUTCOME_CFG[h.movement] ?? OUTCOME_CFG.retained
                  return (
                    <div key={i} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-3 h-3 rounded-full border-2 mt-1 ${h.movement === 'promoted' ? 'border-green-400 bg-green-400' : h.movement === 'relegated' ? 'border-red-400 bg-red-400' : 'border-gray-600 bg-gray-600'}`}/>
                        {i < division_history.length - 1 && <div className="w-px flex-1 bg-white/8 mt-1"/>}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-white text-sm font-semibold">{h.sprint_name}</p>
                            <p className="text-gray-500 text-xs">{new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${oc.bg} ${oc.color}`}>{oc.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-gray-400">{h.from_icon} {h.from_division ?? 'Start'}</span>
                          <span className="text-gray-600">→</span>
                          <span className="text-white font-semibold">{h.to_icon} {h.to_division}</span>
                          <span className="text-gray-600 text-xs ml-auto">{h.league_points} LP</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ENERGY ───────────────────────────────────────── */}
          {tab === 'Energy' && (
            <div className="space-y-4">
              <div className="flex items-center gap-6 mb-4 flex-wrap">
                <div>
                  <p className="text-yellow-400 text-3xl font-black">⚡ {user.energy_balance ?? 0}</p>
                  <p className="text-gray-500 text-xs mt-0.5">total balance (base 25 + purchased)</p>
                </div>
                <div>
                  <p className="text-yellow-300 text-2xl font-black">+{user.extra_energy ?? 0}</p>
                  <p className="text-gray-500 text-xs mt-0.5">purchased extra</p>
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">Adjust amount (negative to deduct)</label>
                  <input type="number" value={energyAmount} onChange={(e) => setEnergyAmount(e.target.value)}
                    placeholder="+10 or -5"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
                </div>
                <ActionButton onClick={handleAdjustEnergy} loading={actionLoading} disabled={!energyAmount}>Apply</ActionButton>
              </div>
            </div>
          )}

          {/* ── ACTIONS ──────────────────────────────────────── */}
          {tab === 'Actions' && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <ActionButton variant="danger" onClick={handleBan} loading={actionLoading}>🔒 Ban User</ActionButton>
                <ActionButton variant="secondary">🔄 Change Role</ActionButton>
              </div>
              <p className="text-gray-600 text-xs">Banning removes access immediately. Role changes require a backend call.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
