import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getLeagues, updateLeagueStatus } from '../../api/leagues'
import { triggerPayout } from '../../api/payments'
import { useToast } from '../../hooks/useToast'
import DataTable from '../../components/admin/ui/DataTable'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import SearchInput from '../../components/admin/ui/SearchInput'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const COMP_COLORS = { EPL: 'text-green-400', CHAMPIONS: 'text-blue-400', LALIGA: 'text-red-400', SERIEA: 'text-blue-300', WORLDCUP: 'text-yellow-400' }
const STATUS_FLOW = { DRAFT: 'ACTIVE', ACTIVE: 'FINISHED', FINISHED: null }
const STATUS_FILTERS = ['All', 'DRAFT', 'ACTIVE', 'FINISHED']

export default function LeaguesPage() {
  const { data: leagues, loading, refetch } = useApi(getLeagues)
  const { toasts, toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [payoutTarget, setPayoutTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const filtered = useMemo(() => {
    if (!leagues) return []
    return leagues.filter((l) => {
      const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' || l.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [leagues, search, statusFilter])

  async function handleStatusChange(league) {
    const next = STATUS_FLOW[league.status]
    if (!next) return
    try {
      await updateLeagueStatus(league.id, next)
      toast(`League moved to ${next}`)
      refetch()
    } catch { toast('Status update failed', 'error') }
  }

  async function handlePayout() {
    setActionLoading(true)
    try {
      await triggerPayout(payoutTarget.id)
      toast(`Payout triggered for ${payoutTarget.name}`)
      refetch()
    } catch { toast('Payout failed', 'error') }
    finally { setActionLoading(false); setPayoutTarget(null) }
  }

  const columns = [
    {
      key: 'name', label: 'League',
      render: (l) => (
        <div>
          <p className="text-white font-medium">{l.name}</p>
          <p className="text-gray-500 text-xs">{l.creator_name ?? l.creator_email}</p>
        </div>
      )
    },
    {
      key: 'competition', label: 'Competition',
      render: (l) => <span className={`text-sm font-medium ${COMP_COLORS[l.competition] ?? 'text-gray-400'}`}>{l.competition}</span>
    },
    { key: 'member_count', label: 'Teams',      render: (l) => `${l.member_count ?? 0} / ${l.max_teams}` },
    { key: 'entry_fee',   label: 'Entry Fee',   render: (l) => `€${l.entry_fee ?? 0}` },
    { key: 'prize_pool',  label: 'Prize Pool',  render: (l) => <span className="text-yellow-400">€{l.prize_pool ?? 0}</span> },
    { key: 'status',      label: 'Status',      render: (l) => <StatusBadge status={l.status}/> },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (l) => (
        <div className="flex items-center gap-2">
          <ActionButton size="sm" variant="ghost" onClick={() => navigate(`/admin/leagues/${l.id}`)}>👁</ActionButton>
          {STATUS_FLOW[l.status] && (
            <ActionButton size="sm" variant="secondary" onClick={() => handleStatusChange(l)}>
              → {STATUS_FLOW[l.status]}
            </ActionButton>
          )}
          {l.status === 'FINISHED' && (
            <ActionButton size="sm" variant="success" onClick={() => setPayoutTarget(l)}>💰</ActionButton>
          )}
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search leagues…"/>
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${statusFilter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {f}
              </button>
            ))}
          </div>
          <span className="text-gray-500 text-sm">{filtered.length} leagues</span>
        </div>
        {loading ? <div className="text-center py-20 text-gray-400">Loading…</div>
                 : <DataTable columns={columns} data={filtered} emptyMessage="No leagues found"/>}
      </div>

      <ConfirmModal
        open={!!payoutTarget}
        title={`Trigger payout for ${payoutTarget?.name}?`}
        message={`This will distribute €${payoutTarget?.prize_pool ?? 0} to league winners.`}
        confirmLabel="Trigger Payout"
        onConfirm={handlePayout}
        onCancel={() => setPayoutTarget(null)}
      />
    </>
  )
}
