import { useApi } from '../../hooks/useApi'
import { getPrizePools, triggerPayout } from '../../api/payments'
import { getLeagues } from '../../api/leagues'
import { useToast } from '../../hooks/useToast'
import ActionButton from '../../components/admin/ui/ActionButton'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ToastContainer from '../../components/admin/ui/ToastContainer'

export default function PaymentsPage() {
  const { data: leagues }  = useApi(getLeagues)
  const { toasts, toast }  = useToast()

  const paidLeagues = (leagues ?? []).filter((l) => parseFloat(l.prize_pool ?? 0) > 0)
  const totalPool   = paidLeagues.reduce((s, l) => s + parseFloat(l.prize_pool ?? 0), 0)

  async function handlePayout(leagueId, name) {
    try {
      await triggerPayout(leagueId)
      toast(`Payout triggered for ${name}`)
    } catch { toast('Payout failed', 'error') }
  }

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Prize Pool', value: `€${totalPool.toFixed(2)}`, icon: '💰' },
            { label: 'Paid Leagues',     value: paidLeagues.length,          icon: '🏆' },
            { label: 'Pending Payouts',  value: paidLeagues.filter((l) => l.status === 'FINISHED').length, icon: '⏳' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-[#111520] border border-white/8 rounded-2xl p-5">
              <p className="text-2xl mb-2">{icon}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-gray-400 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Prize pools table */}
        <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-white font-semibold">Prize Pools</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                {['League', 'Competition', 'Entry Fee', 'Prize Pool', 'Teams', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paidLeagues.map((l) => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-indigo-400 text-xs">{l.competition}</td>
                  <td className="px-4 py-3 text-gray-300">€{l.entry_fee}</td>
                  <td className="px-4 py-3 text-yellow-400 font-medium">€{l.prize_pool}</td>
                  <td className="px-4 py-3 text-gray-400">{l.member_count}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status}/></td>
                  <td className="px-4 py-3">
                    {l.status === 'FINISHED' && (
                      <ActionButton size="sm" variant="success" onClick={() => handlePayout(l.id, l.name)}>
                        💰 Payout
                      </ActionButton>
                    )}
                  </td>
                </tr>
              ))}
              {paidLeagues.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No prize pool leagues yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
