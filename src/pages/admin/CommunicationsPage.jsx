import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getCommunications } from '../../api/users'

const TYPE_LABELS = {
  picks_open:    { label: 'Picks Open',     color: 'bg-green-900/40 text-green-400' },
  lock_reminder: { label: 'Lock Reminder',  color: 'bg-amber-900/40 text-amber-400' },
}

function StatCell({ value }) {
  return <p className="text-white font-semibold text-sm">{value}</p>
}

export default function CommunicationsPage() {
  const navigate = useNavigate()
  const { data, loading } = useApi(getCommunications)
  const comms = data?.communications ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Communications</h1>
        <p className="text-gray-500 text-sm mt-1">All email campaigns sent to users</p>
      </div>

      {loading && <div className="text-center py-20 text-gray-400">Loading…</div>}

      {!loading && comms.length === 0 && (
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-12 text-center">
          <p className="text-gray-500">No emails sent yet.</p>
        </div>
      )}

      {!loading && comms.length > 0 && (
        <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Type</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Subject</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Sent at</th>
                <th className="text-center px-4 py-4 text-gray-400 font-medium">Sent</th>
                <th className="text-center px-4 py-4 text-gray-400 font-medium">Opened</th>
                <th className="text-center px-4 py-4 text-gray-400 font-medium">Open %</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {comms.map((c, i) => {
                const cfg = TYPE_LABELS[c.type] ?? { label: c.type, color: 'bg-white/8 text-gray-400' }
                const openColor = c.open_rate >= 50 ? 'text-green-400' : c.open_rate >= 20 ? 'text-amber-400' : 'text-red-400'
                return (
                  <tr key={i} className="hover:bg-white/2 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/communications/detail?subject=${encodeURIComponent(c.subject)}&sent_at=${encodeURIComponent(c.sent_at)}`)}>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-200 max-w-xs">
                      <p className="truncate">{c.subject}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(c.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-white font-semibold">{c.total_sent}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StatCell value={c.opened} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-semibold ${openColor}`}>{c.open_rate ?? 0}%</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-gray-600 text-xs">→</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
