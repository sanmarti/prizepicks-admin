import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getUsers, banUser, adjustEnergy, deleteUser, resetUserPassword } from '../../api/users'
import { useToast } from '../../hooks/useToast'
import DataTable from '../../components/admin/ui/DataTable'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import SearchInput from '../../components/admin/ui/SearchInput'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ActionButton from '../../components/admin/ui/ActionButton'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const FILTERS = ['All', 'admin', 'user', 'fake_user']

const TIER_MAP = [
  { min: 90, icon: '🥇', label: 'Gold',   color: 'text-yellow-400', bar: 'bg-gradient-to-r from-yellow-500 to-amber-300' },
  { min: 80, icon: '🥈', label: 'Silver', color: 'text-slate-300',  bar: 'bg-gradient-to-r from-slate-400 to-slate-200' },
  { min: 70, icon: '🥉', label: 'Bronze', color: 'text-orange-400', bar: 'bg-gradient-to-r from-orange-500 to-amber-400' },
]
function getAccuracyTier(pct) {
  if (!pct || pct < 70) return null
  return TIER_MAP.find(t => pct >= t.min) ?? null
}

function fmtRelative(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)   return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ActivityCell({ lastSeen, appOpens, lastLogin, loginCount }) {
  return (
    <div className="min-w-[130px]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] text-gray-500 w-12 shrink-0">Last seen</span>
        <span className={`text-xs font-medium ${lastSeen ? 'text-white' : 'text-gray-600'}`}>{fmtRelative(lastSeen)}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] text-gray-500 w-12 shrink-0">App opens</span>
        <span className="text-xs text-indigo-300 font-medium">{appOpens ?? 0}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-500 w-12 shrink-0">Last login</span>
        <span className={`text-xs ${lastLogin ? 'text-gray-400' : 'text-gray-600'}`}>{fmtRelative(lastLogin)}</span>
        {loginCount > 0 && <span className="text-[10px] text-gray-600">({loginCount}×)</span>}
      </div>
    </div>
  )
}

function AccuracyBar({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-gray-600 text-xs">—</span>
  const tier  = getAccuracyTier(pct)
  const bar   = tier ? tier.bar : pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  const label = tier ? tier.textColor : 'text-gray-300'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium ${tier ? tier.color : 'text-gray-300'}`}>{pct}%</span>
      {tier && <span className="text-xs leading-none" title={`${tier.label} Predictor`}>{tier.icon}</span>}
    </div>
  )
}

export default function UsersPage() {
  const { data: users, loading, refetch } = useApi(getUsers)
  const { toasts, toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch]             = useState('')
  const [roleFilter, setRoleFilter]     = useState('All')
  const [banTarget, setBanTarget]         = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [resetTarget, setResetTarget]     = useState(null)
  const [resetResult, setResetResult]     = useState(null)
  const [energyTarget, setEnergyTarget]   = useState(null)
  const [energyAmount, setEnergyAmount]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      const matchSearch = !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.display_name?.toLowerCase().includes(search.toLowerCase())
      const matchRole   = roleFilter === 'All' || u.role === roleFilter
      return matchSearch && matchRole
    })
  }, [users, search, roleFilter])

  async function handleResetPassword() {
    setActionLoading(true)
    try {
      const res = await resetUserPassword(resetTarget.id)
      setResetResult({ email: res.data.email, password: res.data.password })
      setResetTarget(null)
      refetch()
    } catch (e) {
      toast(e.response?.data?.error || 'Reset failed', 'error')
      setResetTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    setActionLoading(true)
    try {
      await deleteUser(deleteTarget.id)
      toast(`User ${deleteTarget.email} deleted`)
      setDeleteTarget(null)
      refetch()
    } catch (e) {
      toast(e.response?.data?.error || 'Delete failed', 'error')
      setDeleteTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBan() {
    setActionLoading(true)
    try {
      await banUser(banTarget.id)
      toast(`User ${banTarget.email} banned`)
      refetch()
    } catch { toast('Action failed', 'error') }
    finally { setActionLoading(false); setBanTarget(null) }
  }

  async function handleAdjustEnergy() {
    if (!energyAmount) return
    setActionLoading(true)
    try {
      await adjustEnergy(energyTarget.id, parseInt(energyAmount), 'Admin adjustment')
      toast(`Energy adjusted for ${energyTarget.email}`)
      refetch()
    } catch { toast('Failed to adjust energy', 'error') }
    finally { setActionLoading(false); setEnergyTarget(null); setEnergyAmount('') }
  }

  const columns = [
    {
      key: 'display_name', label: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {u.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-white text-sm font-medium">{u.display_name ?? '—'}</p>
              {u.role === 'fake_user' && <span className="text-[9px] bg-orange-900/40 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full font-bold">TEST</span>}
              {u.temp_password && <span className="text-[9px] bg-yellow-900/40 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-bold" title={`Temp password: ${u.temp_password}`}>🔑 TEMP</span>}
            </div>
            <p className="text-gray-500 text-xs">{u.email}</p>
          </div>
        </div>
      )
    },
    { key: 'role', label: 'Role', render: (u) => <StatusBadge status={u.role}/> },
    {
      key: 'current_division', label: 'Division',
      render: (u) => u.current_division
        ? <span className="text-sm">{u.current_division.icon} <span className="text-gray-300">{u.current_division.name}</span></span>
        : <span className="text-gray-600 text-xs">—</span>
    },
    {
      key: 'current_gw_picks_submitted', label: 'GW Picks',
      render: (u) => {
        const v = u.current_gw_picks_submitted
        if (v === true)  return <span className="text-green-400 font-bold text-sm">✓</span>
        if (v === false) return <span className="text-red-400 font-bold text-sm">✗</span>
        return <span className="text-gray-600 text-xs">—</span>
      }
    },
    {
      key: 'sprints_played', label: 'Sprints',
      render: (u) => <span className="text-gray-300 text-sm font-medium">{u.sprints_played ?? 0}</span>
    },
    {
      key: 'matchweeks_played', label: 'Matchweeks',
      render: (u) => <span className="text-gray-300 text-sm font-medium">{u.matchweeks_played ?? 0}</span>
    },
    {
      key: 'accuracy_pct', label: 'Accuracy',
      render: (u) => <AccuracyBar pct={u.accuracy_pct} />
    },
    {
      key: 'energy_balance', label: 'Energy ⚡',
      render: (u) => {
        const bal = u.energy_balance ?? 0
        return bal > 0
          ? <span className="text-yellow-400 font-medium">{bal}</span>
          : <span className="text-gray-600 text-xs">—</span>
      }
    },
    {
      key: 'created_at', label: 'Joined',
      render: (u) => <span className="text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</span>
    },
    {
      key: 'last_seen_at', label: 'Activity',
      render: (u) => (
        <ActivityCell
          lastSeen={u.last_seen_at}
          appOpens={u.app_opens}
          lastLogin={u.last_login_at}
          loginCount={u.login_count}
        />
      )
    },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (u) => (
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>👁</ActionButton>
          <ActionButton size="sm" variant="secondary" onClick={() => setEnergyTarget(u)}>⚡</ActionButton>
          <ActionButton size="sm" variant="secondary" onClick={() => setResetTarget(u)} title="Reset password">🔑</ActionButton>
          <ActionButton size="sm" variant="danger" onClick={() => setBanTarget(u)}>🔒</ActionButton>
          <ActionButton size="sm" variant="danger" onClick={() => setDeleteTarget(u)}>🗑</ActionButton>
        </div>
      )
    }
  ]

  return (
    <>
      <ToastContainer toasts={toasts}/>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…"/>
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setRoleFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${roleFilter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {f}
              </button>
            ))}
          </div>
          <span className="text-gray-500 text-sm">{filtered.length} users</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading users…</div>
        ) : (
          <DataTable columns={columns} data={filtered} emptyMessage="No users found"/>
        )}
      </div>

      <ConfirmModal
        open={!!banTarget} danger
        title={`Ban ${banTarget?.email}?`}
        message="This will revoke the user's access. You can unban them later."
        confirmLabel="Ban User"
        onConfirm={handleBan}
        onCancel={() => setBanTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget} danger
        title={`Permanently delete ${deleteTarget?.email}?`}
        message="This will erase the account and all associated data — picks, energy, sprint history — forever. This cannot be undone."
        confirmLabel="Delete forever"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!resetTarget}
        title={`Reset password for ${resetTarget?.email}?`}
        message="A new random password will be generated. The user will need to use it to log in, then change it from their account settings."
        confirmLabel="Generate new password"
        onConfirm={handleResetPassword}
        onCancel={() => setResetTarget(null)}
      />

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1c2333] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-1">Password reset</h3>
            <p className="text-gray-400 text-sm mb-4">{resetResult.email}</p>
            <p className="text-gray-400 text-xs mb-2">New temporary password — share this with the user:</p>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 mb-2">
              <span className="text-green-400 font-mono text-sm font-bold flex-1 select-all">{resetResult.password}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(resetResult.password); toast('Copied!') }}
                className="text-gray-400 hover:text-white text-xs border border-white/10 rounded-lg px-2 py-1 transition-colors hover:bg-white/10">
                Copy
              </button>
            </div>
            <p className="text-gray-600 text-xs mb-4">Once the user logs in and changes their password, this will no longer be visible.</p>
            <div className="flex justify-end">
              <ActionButton onClick={() => setResetResult(null)}>Done</ActionButton>
            </div>
          </div>
        </div>
      )}

      {energyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1c2333] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Adjust Energy</h3>
            <p className="text-gray-400 text-sm mb-4">{energyTarget.email} · current: ⚡ {energyTarget.energy_balance ?? 0}</p>
            <input type="number" value={energyAmount} onChange={(e) => setEnergyAmount(e.target.value)}
              placeholder="Amount (negative to deduct)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4"/>
            <div className="flex gap-3 justify-end">
              <ActionButton variant="secondary" onClick={() => { setEnergyTarget(null); setEnergyAmount('') }}>Cancel</ActionButton>
              <ActionButton onClick={handleAdjustEnergy} loading={actionLoading}>Apply</ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
