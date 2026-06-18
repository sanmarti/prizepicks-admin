import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getUsers, getUserEnergy } from '../../api/users'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'

const TABS = ['Overview', 'Picks History', 'Payments', 'Actions']

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Overview')

  const { data: users }  = useApi(getUsers)
  const { data: energy } = useApi(() => getUserEnergy(id), [id])

  const user = users?.find((u) => u.id === id)

  if (!user && users) return (
    <div className="text-center py-20 text-gray-400">User not found</div>
  )

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/users')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        ← Back to Users
      </button>

      {/* Header */}
      {user && (
        <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
            {user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-bold text-xl">{user.display_name ?? 'No name'}</h1>
              <StatusBadge status={user.role}/>
            </div>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <p className="text-gray-500 text-xs mt-1">Joined {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-yellow-400 text-2xl font-bold">⚡ {user.energy_balance ?? 0}</p>
            <p className="text-gray-500 text-xs">energy balance</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[#111520] border border-white/8 rounded-2xl p-6">
        {tab === 'Overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-white font-medium mb-3">Energy Transactions</h3>
              {(energy?.transactions ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm">No transactions yet</p>
              ) : (
                <div className="space-y-2">
                  {(energy?.transactions ?? []).slice(0, 10).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className={`text-sm font-medium ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </span>
                      <span className="text-gray-300 text-sm flex-1">{t.description}</span>
                      <StatusBadge status={t.type}/>
                      <span className="text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Picks History' && (
          <p className="text-gray-400 text-sm">Pick history requires additional API endpoint.</p>
        )}

        {tab === 'Payments' && (
          <p className="text-gray-400 text-sm">Payment history requires Stripe integration data.</p>
        )}

        {tab === 'Actions' && user && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <ActionButton variant="danger">🔒 Ban User</ActionButton>
              <ActionButton variant="secondary">🔄 Change Role</ActionButton>
              <ActionButton variant="secondary">⚡ Adjust Energy</ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
