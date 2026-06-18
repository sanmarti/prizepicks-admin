import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getUsers, banUser, adjustEnergy } from '../../api/users'
import { useToast } from '../../hooks/useToast'
import DataTable from '../../components/admin/ui/DataTable'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import SearchInput from '../../components/admin/ui/SearchInput'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ActionButton from '../../components/admin/ui/ActionButton'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const FILTERS = ['All', 'admin', 'user']

export default function UsersPage() {
  const { data: users, loading, refetch } = useApi(getUsers)
  const { toasts, toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('All')
  const [banTarget, setBanTarget]     = useState(null)
  const [energyTarget, setEnergyTarget] = useState(null)
  const [energyAmount, setEnergyAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      const matchSearch = !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.display_name?.toLowerCase().includes(search.toLowerCase())
      const matchRole   = roleFilter === 'All' || u.role === roleFilter
      return matchSearch && matchRole
    })
  }, [users, search, roleFilter])

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
      key: 'display_name', label: 'Name',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {u.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-medium">{u.display_name ?? '—'}</p>
            <p className="text-gray-500 text-xs">{u.email}</p>
          </div>
        </div>
      )
    },
    { key: 'role', label: 'Role', render: (u) => <StatusBadge status={u.role}/> },
    {
      key: 'energy_balance', label: 'Energy',
      render: (u) => <span className="text-yellow-400 font-medium">⚡ {u.energy_balance ?? 0}</span>
    },
    {
      key: 'created_at', label: 'Joined',
      render: (u) => <span className="text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</span>
    },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (u) => (
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>👁</ActionButton>
          <ActionButton size="sm" variant="secondary" onClick={() => setEnergyTarget(u)}>⚡</ActionButton>
          <ActionButton size="sm" variant="danger" onClick={() => setBanTarget(u)}>🔒</ActionButton>
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

      {/* Ban confirm modal */}
      <ConfirmModal
        open={!!banTarget} danger
        title={`Ban ${banTarget?.email}?`}
        message="This will revoke the user's access. You can unban them later."
        confirmLabel="Ban User"
        onConfirm={handleBan}
        onCancel={() => setBanTarget(null)}
      />

      {/* Adjust energy modal */}
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
