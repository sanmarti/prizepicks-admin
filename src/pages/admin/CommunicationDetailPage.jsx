import { useNavigate, useSearchParams } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getCommunicationDetail } from '../../api/users'

const TYPE_LABELS = {
  picks_open:    { label: 'Picks Open',    color: 'bg-green-900/40 text-green-400' },
  lock_reminder: { label: 'Lock Reminder', color: 'bg-amber-900/40 text-amber-400' },
}

export default function CommunicationDetailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const subject = params.get('subject') ?? ''
  const sentAt  = params.get('sent_at') ?? ''

  const { data, loading } = useApi(
    () => getCommunicationDetail(subject, sentAt),
    [subject, sentAt]
  )

  const rawRecipients = data?.recipients ?? []
  const recipients = [...rawRecipients].sort((a, b) => {
    if (a.opened_at && !b.opened_at) return -1
    if (!a.opened_at && b.opened_at) return 1
    return 0
  })
  const total  = recipients.length
  const opened = recipients.filter(r => r.opened_at).length
  const openRate = total ? Math.round(opened * 100 / total) : 0

  const type = recipients[0]?.type
  const cfg  = TYPE_LABELS[type] ?? { label: type ?? '—', color: 'bg-white/8 text-gray-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/admin/communications')}
          className="mt-1 text-gray-500 hover:text-white transition-colors text-lg">←</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            <span className="text-gray-600 text-xs">
              {sentAt ? new Date(sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
          <h1 className="text-white text-xl font-bold truncate">{subject}</h1>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Sent',      value: total,           color: 'text-white' },
          { label: 'Opened',    value: opened,          color: 'text-green-400' },
          { label: 'Open rate', value: `${openRate}%`,  color: openRate >= 50 ? 'text-green-400' : openRate >= 20 ? 'text-amber-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#111520] border border-white/8 rounded-xl px-4 py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recipient table */}
      {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

      {!loading && recipients.length > 0 && (
        <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-6 py-4 text-gray-400 font-medium">User</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Sent at</th>
                <th className="text-center px-6 py-4 text-gray-400 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recipients.map(r => (
                <tr key={r.id} className={`transition-colors ${r.opened_at ? 'bg-green-950/30 hover:bg-green-950/40' : 'hover:bg-white/2'}`}>
                  <td className="px-6 py-4">
                    <p className={`font-medium ${r.opened_at ? 'text-green-200' : 'text-white'}`}>{r.display_name || '—'}</p>
                    <p className={`text-xs ${r.opened_at ? 'text-green-700' : 'text-gray-500'}`}>{r.email}</p>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap ${r.opened_at ? 'text-green-700' : 'text-gray-400'}`}>
                    {new Date(r.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.opened_at
                      ? <div>
                          <span className="text-green-400 font-bold">✓</span>
                          <p className="text-green-800 text-[10px] mt-0.5">
                            {new Date(r.opened_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
