import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getUserDetail, adjustEnergy, banUser } from '../../api/users'
import { useToast } from '../../hooks/useToast'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const TABS = ['Overview', 'Sprint History', 'Division History', 'Energy', 'Actions']

const OUTCOME_CFG = {
  promoted:  { label: '⬆ Promoted',  color: 'text-green-400',  bg: 'bg-green-900/30 border-green-500/30' },
  retained:  { label: '= Retained',  color: 'text-gray-400',   bg: 'bg-white/5 border-white/10' },
  relegated: { label: '⬇ Relegated', color: 'text-red-400',    bg: 'bg-red-900/30 border-red-500/30' },
  rookie:    { label: '🌱 Rookie',    color: 'text-indigo-400', bg: 'bg-indigo-900/30 border-indigo-500/30' },
  pending:   { label: '🔴 Live',      color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/20' },
}

function StatBox({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
      <p className={`text-2xl font-black ${color}`}>{value ?? '—'}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

function AccuracyRing({ pct }) {
  if (pct === null || pct === undefined) return (
    <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-center">
      <p className="text-2xl font-black text-gray-600">—</p>
      <p className="text-gray-500 text-xs mt-0.5">Accuracy</p>
    </div>
  )
  const color = pct >= 60 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'
  const barColor = pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
      <p className={`text-2xl font-black ${color}`}>{pct}%</p>
      <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 mb-1 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-gray-400 text-xs">Global accuracy</p>
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

  const { data: user, loading, refetch } = useApi(() => getUserDetail(id), [id])

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

  const { stats, current_division, sprint_history, division_history } = user

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="space-y-6">

        <button onClick={() => navigate('/admin/users')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
          ← Back to Users
        </button>

        {/* Header */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {user.email?.[0]?.toUpperCase()}
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
              </div>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Member since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-yellow-400 text-2xl font-bold">⚡ {user.energy_balance ?? 0}</p>
              <p className="text-gray-500 text-xs">energy</p>
            </div>
          </div>

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatBox label="Sprints played"    value={stats.sprints_played}    color="text-indigo-400"/>
            <StatBox label="Matchweeks played" value={stats.matchweeks_played} color="text-indigo-400"/>
            <StatBox
              label="Picks record"
              value={`${stats.total_correct}W / ${stats.total_incorrect}L`}
              color="text-white"
              sub={`${stats.total_correct + stats.total_incorrect} total picks`}
            />
            <AccuracyRing pct={stats.accuracy_pct}/>
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
              <div>
                <h3 className="text-white font-semibold text-sm mb-3">Activity summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Member since</p>
                    <p className="text-white text-sm">{new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Current division</p>
                    <p className="text-white text-sm">{current_division ? `${current_division.icon} ${current_division.name}` : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Sprints completed</p>
                    <p className="text-white text-sm font-bold">{stats.sprints_played}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Matchweeks played</p>
                    <p className="text-white text-sm font-bold">{stats.matchweeks_played}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Correct picks</p>
                    <p className="text-green-400 text-sm font-bold">{stats.total_correct}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">Wrong picks</p>
                    <p className="text-red-400 text-sm font-bold">{stats.total_incorrect}</p>
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
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div><p className="text-indigo-400 font-black text-lg">{s.total_league_points}</p><p className="text-gray-600 text-[10px]">LP</p></div>
                          <div><p className="text-green-400 font-black text-lg">{s.total_correct_picks}</p><p className="text-gray-600 text-[10px]">Correct</p></div>
                          <div><p className="text-red-400 font-black text-lg">{s.total_incorrect_picks}</p><p className="text-gray-600 text-[10px]">Wrong</p></div>
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
              <div className="flex items-center gap-3 mb-4">
                <p className="text-yellow-400 text-3xl font-black">⚡ {user.energy_balance ?? 0}</p>
                <p className="text-gray-500 text-sm">current balance</p>
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
